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

interface ConversationNewEvent {
  conversation_id: string;
  type: string;
  title?: string;
  member_ids: string[];
  members?: Array<{ user_id: string; username: string }>;
  created_by: string;
  created_at: string;
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

    // Subscribe to topics
    await this.consumer.subscribe({ topics: ['message.new', 'conversation.new'], fromBeginning: false });
    this.logger.log('Subscribed to topics: message.new, conversation.new');

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

      if (topic === 'message.new') {
        const event: MessageNewEvent = JSON.parse(value);
        this.logger.log(
          `Received message.new: conversation=${event.conversation_id}, seq=${event.seq}`,
        );
        await this.fanoutMessage(event);
      } else if (topic === 'conversation.new') {
        const event: ConversationNewEvent = JSON.parse(value);
        this.logger.log(
          `Received conversation.new: conversation=${event.conversation_id}, type=${event.type}`,
        );
        await this.fanoutConversation(event);
      }
    } catch (error) {
      this.logger.error(`Failed to process ${topic} event:`, error);
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

          this.logger.log(`→ Published to user ${userId} via gateway ${gatewayId}`);
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

  /**
   * Fanout new conversation to all members
   */
  private async fanoutConversation(event: ConversationNewEvent) {
    try {
      this.logger.debug(
        `Fanout conversation to ${event.member_ids.length} members: ${event.member_ids.join(', ')}`,
      );

      // For each member, notify them about the new conversation
      const deliveryPromises = event.member_ids.map(async (userId) => {
        // Skip creator (they already have it from the API response)
        if (userId === event.created_by) {
          this.logger.debug(`Skipping creator ${userId}`);
          return;
        }

        // Check if user is connected to a gateway
        const gatewayId = await this.redisService.getUserGateway(userId);

        if (gatewayId) {
          // Publish to the gateway's Redis channel
          await this.redisService.publishToGateway(gatewayId, {
            userId,
            event: 'conversation.new',
            data: {
              conversation_id: event.conversation_id,
              type: event.type,
              title: event.title,
              members: event.members, // Include if present (DMs only)
              created_by: event.created_by,
              created_at: event.created_at,
            },
          });

          this.logger.log(`→ Published conversation to user ${userId} via gateway ${gatewayId}`);
        } else {
          this.logger.debug(`User ${userId} not connected (offline)`);
        }
      });

      await Promise.all(deliveryPromises);
      this.logger.log(`Fanout completed for conversation ${event.conversation_id}`);
    } catch (error) {
      this.logger.error(`Fanout failed for conversation ${event.conversation_id}:`, error);
      throw error;
    }
  }
}
