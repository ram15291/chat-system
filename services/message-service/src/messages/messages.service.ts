import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { DynamoDBService } from '../dynamodb/dynamodb.service';
import { KafkaService } from '../kafka/kafka.service';
import { Read } from '../reads/entities/read.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { Message, MessagePreview } from './interfaces/message.interface';

const PREVIEW_LENGTH = 200;

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly chatServiceUrl: string;

  constructor(
    private dynamoDBService: DynamoDBService,
    private kafkaService: KafkaService,
    private configService: ConfigService,
    @InjectRepository(Read)
    private readRepository: Repository<Read>,
  ) {
    this.chatServiceUrl = this.configService.get<string>('chatService.url');
  }

  /**
   * Send a message to a conversation
   * 1. Allocate sequence number from chat-service
   * 2. Store message in DynamoDB
   * 3. Publish event to Kafka
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
    authToken: string,
  ): Promise<Message> {
    // Step 1: Allocate sequence number from chat-service
    const seq = await this.allocateSequenceNumber(conversationId, authToken);

    // Step 2: Create message object
    const messageId = uuidv4();
    const createdAt = new Date().toISOString();
    const preview = dto.body.substring(0, PREVIEW_LENGTH);
    const hasMore = dto.body.length > PREVIEW_LENGTH;

    const message: Message = {
      conversation_id: conversationId,
      seq,
      message_id: messageId,
      sender_id: senderId,
      created_at: createdAt,
      body: dto.body,
      preview,
      has_more: hasMore,
    };

    // Step 3: Store in DynamoDB
    this.logger.log(`Storing message: ${JSON.stringify(message)}`);
    await this.dynamoDBService.putMessage(message);
    this.logger.log(`Message ${messageId} stored with seq ${seq}`);

    // Step 4: Publish to Kafka
    await this.kafkaService.publishMessageNew({
      conversation_id: conversationId,
      seq,
      message_id: messageId,
      sender_id: senderId,
      created_at: createdAt,
      preview,
    });

    return message;
  }

  /**
   * Allocate sequence number from chat-service
   */
  private async allocateSequenceNumber(
    conversationId: string,
    authToken: string,
  ): Promise<number> {
    try {
      const response = await axios.post(
        `${this.chatServiceUrl}/conversations/${conversationId}/allocate-seq`,
        {},
        {
          headers: {
            Authorization: authToken,
          },
        },
      );
      return response.data.seq;
    } catch (error) {
      this.logger.error(
        `Failed to allocate sequence number: ${error.message}`,
        error.stack,
      );
      if (error.response?.status === 404) {
        throw new NotFoundException('Conversation not found');
      }
      if (error.response?.status === 403) {
        throw new BadRequestException('Not a member of this conversation');
      }
      throw new BadRequestException('Failed to allocate sequence number');
    }
  }

  /**
   * Get message history for a conversation
   * Returns preview only (first 200 chars)
   */
  async getMessages(
    conversationId: string,
    afterSeq?: number,
    limit: number = 200,
  ): Promise<MessagePreview[]> {
    const messages = await this.dynamoDBService.queryMessages(
      conversationId,
      afterSeq,
      limit,
    );

    return messages.map((msg) => ({
      conversation_id: msg.conversation_id,
      seq: msg.seq,
      message_id: msg.message_id,
      sender_id: msg.sender_id,
      created_at: msg.created_at,
      preview: msg.preview,
      has_more: msg.has_more,
    }));
  }

  /**
   * Get full message body by message ID
   */
  async getMessageById(
    conversationId: string,
    messageId: string,
  ): Promise<Message> {
    const message = await this.dynamoDBService.getMessageById(
      conversationId,
      messageId,
    );

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  /**
   * Update read state for a user in a conversation
   */
  async updateReadState(
    userId: string,
    conversationId: string,
    lastReadSeq: number,
  ): Promise<Read> {
    const existing = await this.readRepository.findOne({
      where: { user_id: userId, conversation_id: conversationId },
    });

    if (existing) {
      // Only update if new seq is greater
      if (lastReadSeq > existing.last_read_seq) {
        existing.last_read_seq = lastReadSeq;
        return await this.readRepository.save(existing);
      }
      return existing;
    }

    // Create new read record
    const read = this.readRepository.create({
      user_id: userId,
      conversation_id: conversationId,
      last_read_seq: lastReadSeq,
    });

    return await this.readRepository.save(read);
  }

  /**
   * Get read state for a user in a conversation
   */
  async getReadState(
    userId: string,
    conversationId: string,
  ): Promise<Read | null> {
    return await this.readRepository.findOne({
      where: { user_id: userId, conversation_id: conversationId },
    });
  }
}
