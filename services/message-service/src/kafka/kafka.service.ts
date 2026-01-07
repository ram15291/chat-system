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

  async publishMessageNew(message: {
    conversation_id: string;
    seq: number;
    message_id: string;
    sender_id: string;
    created_at: string;
    preview: string;
  }): Promise<void> {
    try {
      await this.producer.send({
        topic: 'message.new',
        messages: [
          {
            key: message.conversation_id,
            value: JSON.stringify(message),
          },
        ],
      });
      this.logger.debug(`Published message.new event for message ${message.message_id}`);
    } catch (error) {
      this.logger.error(`Failed to publish message.new event: ${error.message}`, error.stack);
      throw error;
    }
  }
}
