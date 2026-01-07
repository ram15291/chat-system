import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { RedisService } from '../redis/redis.service';
import { ChatService } from '../chat/chat.service';

interface MessageNewEvent {
  conversation_id: string;
  message_id: string;
  seq: number;
  sender_id: string;
  created_at: string;
  preview: string;
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private chatService: ChatService,
  ) {}

  async onModuleInit() {
    const brokers = this.configService.get<string[]>('kafka.brokers');
    const clientId = this.configService.get<string>('kafka.clientId');
    const groupId = this.configService.get<string>('kafka.groupId');

    this.kafka = new Kafka({
      clientId,
      brokers,
    });

    this.consumer = this.kafka.consumer({ groupId });

    await this.consumer.connect();
    this.logger.log('Kafka consumer connected');

    // Subscribe to message.new topic
    await this.consumer.subscribe({ topic: 'message.new', fromBeginning: false });
    this.logger.log('Subscribed to topic: message.new');

    // Start consuming messages
    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });

    this.logger.log('Kafka consumer started');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    this.logger.log('Kafka consumer disconnected');
  }

  /**
   * Handle incoming Kafka message
   */
  private async handleMessage(payload: EachMessagePayload) {
    const { topic, partition, message } = payload;

    try {
      const value = message.value?.toString();
      if (!value) {
        this.logger.warn('Received empty message');
        return;
      }

      const event: MessageNewEvent = JSON.parse(value);
      this.logger.log(
        `Received message: conversation=${event.conversation_id}, seq=${event.seq}, sender=${event.sender_id}`,
      );

      await this.fanoutMessage(event);
    } catch (error) {
      this.logger.error('Failed to process message:', error);
    }
  }

  /**
   * Fanout message to all conversation members
   */
  private async fanoutMessage(event: MessageNewEvent) {
    try {
      // 1. Fetch conversation members from Chat Service
      const memberIds = await this.chatService.getConversationMembers(
        event.conversation_id,
      );

      if (memberIds.length === 0) {
        this.logger.warn(`No members found for conversation ${event.conversation_id}`);
        return;
      }

      this.logger.debug(
        `Fanout to ${memberIds.length} members: ${memberIds.join(', ')}`,
      );

      // 2. For each member, find their gateway and publish message
      const deliveryPromises = memberIds.map(async (userId) => {
        // Skip sender (they already have the message)
        if (userId === event.sender_id) {
          this.logger.debug(`Skipping sender ${userId}`);
          return;
        }

        // Check if user is connected to a gateway
        const gatewayId = await this.redisService.getUserGateway(userId);

        if (gatewayId) {
          // Publish to the gateway's Redis channel
          await this.redisService.publishToGateway(gatewayId, {
            userId,
            event: 'message.new',
            data: {
              conversation_id: event.conversation_id,
              message_id: event.message_id,
              seq: event.seq,
              sender_id: event.sender_id,
              created_at: event.created_at,
              preview: event.preview,
            },
          });

          this.logger.debug(`Delivered to user ${userId} via gateway ${gatewayId}`);
        } else {
          this.logger.debug(`User ${userId} not connected (offline)`);
        }
      });

      await Promise.all(deliveryPromises);
      this.logger.log(`Fanout completed for message ${event.message_id}`);
    } catch (error) {
      this.logger.error(`Fanout failed for message ${event.message_id}:`, error);
      throw error;
    }
  }
}
