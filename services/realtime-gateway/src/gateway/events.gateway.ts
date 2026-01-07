import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  path: '/ws/socket.io',
  transports: ['websocket', 'polling'],
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private heartbeatInterval: NodeJS.Timeout;
  private readonly connections = new Map<string, AuthenticatedSocket>(); // userId -> socket

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  async afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Engine.IO level instrumentation (lower level than Socket.IO)
    const eio = (server as any).engine;
    eio.on('connection', (rawSocket) => {
      this.logger.log(`[EIO] connection: id=${rawSocket.id} transport=${rawSocket.transport.name}`);
      rawSocket.on('upgrade', (t) => this.logger.log(`[EIO] upgrade: id=${rawSocket.id} -> ${t.name}`));
      rawSocket.on('close', (reason) => this.logger.warn(`[EIO] close: id=${rawSocket.id} reason=${reason}`));
      rawSocket.on('error', (err) => this.logger.error(`[EIO] error: id=${rawSocket.id} ${err?.message || err}`));
    });

    // Socket.IO level instrumentation (namespace '/')
    server.on('connection', (socket) => {
      this.logger.log(`[SIO] connection event: socketId=${socket.id} nsp=${socket.nsp.name}`);
      socket.on('disconnect', (reason) => this.logger.warn(`[SIO] disconnect: socketId=${socket.id} reason=${reason}`));
      socket.on('error', (err) => this.logger.error(`[SIO] socket error: socketId=${socket.id} ${err?.message || err}`));
    });

    server.of('/').on('connect_error', (err) => {
      this.logger.error(`[SIO] connect_error: ${err?.message || err}`);
    });

    // Socket.IO middleware logging
    server.use((socket, next) => {
      this.logger.log('[SIO] middleware', {
        id: socket.id,
        query: socket.handshake.query,
        auth: socket.handshake.auth,
      });
      next();
    });

    // Subscribe to Redis channel for incoming messages
    await this.redisService.subscribeToGatewayChannel((message) => {
      this.handleRedisMessage(message);
    });

    // Start heartbeat to refresh Redis connection TTLs
    const heartbeatInterval = this.configService.get<number>('heartbeat.interval');
    this.heartbeatInterval = setInterval(() => {
      this.refreshConnections();
    }, heartbeatInterval);

    this.logger.log(`Heartbeat interval set to ${heartbeatInterval}ms`);
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`===== NEW CONNECTION ATTEMPT =====`);
    this.logger.log(`Socket ID: ${client.id}`);
    this.logger.log(`Query: ${JSON.stringify(client.handshake.query)}`);
    this.logger.log(`Auth: ${JSON.stringify(client.handshake.auth)}`);
    this.logger.log(`Headers: ${JSON.stringify(client.handshake.headers)}`);
    
    try {
      const token = 
        client.handshake.query.token as string ||
        client.handshake.auth.token as string;

      if (!token) {
        this.logger.warn('REJECTED: No token');
        client.disconnect();
        return;
      }

      this.logger.log(`Token: ${token.substring(0, 20)}...`);

      const jwtSecret = this.configService.get<string>('jwt.secret');
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
      });

      const userId = payload.user_id || payload.sub;
      if (!userId) {
        this.logger.warn('REJECTED: No user_id');
        client.disconnect();
        return;
      }
      client.userId = userId;

      this.connections.set(userId, client);
      this.logger.log(`Memory: ${this.connections.size} connections`);
      
      await this.redisService.trackConnection(userId);

      const gatewayId = this.redisService.getGatewayId();
      this.logger.log(`CONNECTED: user=${userId} gateway=${gatewayId}`);
      
      client.emit('connected', {
        userId,
        gatewayId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('AUTH FAILED:', error.message);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connections.delete(client.userId);
      await this.redisService.untrackConnection(client.userId);
      this.logger.log(`Client disconnected: user=${client.userId}, socket=${client.id}`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: AuthenticatedSocket): void {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  /**
   * Handle messages received from Redis pub/sub
   */
  private handleRedisMessage(message: any) {
    const { userId, event, data } = message;

    if (!userId || !event) {
      this.logger.warn('Invalid message from Redis:', message);
      return;
    }

    const socket = this.connections.get(userId);
    const gatewayId = this.redisService.getGatewayId();
    
    if (socket) {
      // Send message to the user's socket
      socket.emit(event, data);
      this.logger.log(`✓ Delivered ${event} to user ${userId} via gateway ${gatewayId}`);
    } else {
      this.logger.debug(`User ${userId} not connected to gateway ${gatewayId}`);
    }
  }

  /**
   * Refresh all active connections in Redis (heartbeat)
   */
  private async refreshConnections() {
    const userIds = Array.from(this.connections.keys());
    
    if (userIds.length > 0) {
      this.logger.debug(`Refreshing ${userIds.length} connections`);
      
      for (const userId of userIds) {
        try {
          await this.redisService.refreshConnection(userId);
        } catch (error) {
          this.logger.error(`Failed to refresh connection for user ${userId}:`, error);
        }
      }
    }
  }

  /**
   * Send message to a specific user (can be called from other services)
   */
  async sendToUser(userId: string, event: string, data: any): Promise<boolean> {
    const socket = this.connections.get(userId);
    
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    
    return false;
  }

  /**
   * Get count of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
