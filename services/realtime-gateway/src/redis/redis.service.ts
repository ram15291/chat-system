import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis;
  private subscriber: Redis;
  private gatewayId: string;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redis.url');
    this.gatewayId = this.configService.get<string>('gatewayId');

    // Main Redis client for pub and general operations
    this.redisClient = new Redis(redisUrl);
    
    // Separate subscriber client (Redis requirement)
    this.subscriber = new Redis(redisUrl);

    this.redisClient.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis client error:', err);
    });

    this.subscriber.on('error', (err) => {
      this.logger.error('Redis subscriber error:', err);
    });
  }

  async onModuleInit() {
    this.logger.log(`Redis service initialized for gateway: ${this.gatewayId}`);
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
    await this.subscriber.quit();
    this.logger.log('Redis connections closed');
  }

  getClient(): Redis {
    return this.redisClient;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  getGatewayId(): string {
    return this.gatewayId;
  }

  /**
   * Track user connection in Redis
   */
  async trackConnection(userId: string): Promise<void> {
    const key = `user:${userId}:gateway`;
    this.logger.log(`REDIS SET: ${key} = ${this.gatewayId} (TTL: 60s)`);
    await this.redisClient.set(key, this.gatewayId, 'EX', 60); // 60 seconds TTL
    this.logger.log(`REDIS CONFIRMED: Tracking user ${userId}`);
  }

  /**
   * Remove user connection from Redis
   */
  async untrackConnection(userId: string): Promise<void> {
    const key = `user:${userId}:gateway`;
    const currentGateway = await this.redisClient.get(key);
    
    // Only delete if this gateway owns the connection
    if (currentGateway === this.gatewayId) {
      await this.redisClient.del(key);
      this.logger.debug(`Untracked user ${userId} from gateway ${this.gatewayId}`);
    }
  }

  /**
   * Refresh connection TTL (for heartbeat)
   */
  async refreshConnection(userId: string): Promise<void> {
    const key = `user:${userId}:gateway`;
    await this.redisClient.expire(key, 60);
  }

  /**
   * Publish message to gateway-specific channel
   */
  async publishToGateway(gatewayId: string, message: any): Promise<void> {
    const channel = `gateway:${gatewayId}`;
    await this.redisClient.publish(channel, JSON.stringify(message));
  }

  /**
   * Subscribe to this gateway's channel
   */
  async subscribeToGatewayChannel(callback: (message: any) => void): Promise<void> {
    const channel = `gateway:${this.gatewayId}`;
    
    await this.subscriber.subscribe(channel);
    
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          const message = JSON.parse(msg);
          callback(message);
        } catch (err) {
          this.logger.error('Failed to parse message from Redis:', err);
        }
      }
    });

    this.logger.log(`Subscribed to channel: ${channel}`);
  }
}
