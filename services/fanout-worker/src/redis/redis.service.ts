import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redis.url');
    this.redisClient = new Redis(redisUrl);

    this.redisClient.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis client error:', err);
    });
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
    this.logger.log('Redis connection closed');
  }

  /**
   * Get the gateway ID that a user is connected to
   */
  async getUserGateway(userId: string): Promise<string | null> {
    const key = `user:${userId}:gateway`;
    return await this.redisClient.get(key);
  }

  /**
   * Publish message to a specific gateway's channel
   */
  async publishToGateway(gatewayId: string, message: any): Promise<void> {
    const channel = `gateway:${gatewayId}`;
    await this.redisClient.publish(channel, JSON.stringify(message));
    this.logger.debug(`Published to ${channel}`);
  }
}
