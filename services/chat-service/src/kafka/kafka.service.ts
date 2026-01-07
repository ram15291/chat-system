import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const brokers = this.configService.get<string[]>('kafka.brokers');
    const clientId = this.configService.get<string>('kafka.clientId');

    this.kafka = new Kafka({
      clientId,
      brokers,
    });

    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    this.logger.log('Kafka producer disconnected');
  }

  async publishConversationNew(conversation: {
    conversation_id: string;
    type: string;
    title?: string;
    member_ids: string[];
    members?: Array<{ user_id: string; username: string }>;
    created_by: string;
    created_at: string;
  }): Promise<void> {
    try {
      await this.producer.send({
        topic: 'conversation.new',
        messages: [
          {
            key: conversation.conversation_id,
            value: JSON.stringify(conversation),
          },
        ],
      });
      this.logger.log(`Published conversation.new event for conversation ${conversation.conversation_id}`);
    } catch (error) {
      this.logger.error(`Failed to publish conversation.new event: ${error.message}`, error.stack);
      throw error;
    }
  }
}
