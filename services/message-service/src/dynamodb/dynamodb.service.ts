import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDBService implements OnModuleInit {
  private readonly logger = new Logger(DynamoDBService.name);
  private client: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const region = this.configService.get<string>('dynamodb.region');
    const endpoint = this.configService.get<string>('dynamodb.endpoint');
    const credentials = this.configService.get('dynamodb.credentials');
    this.tableName = this.configService.get<string>('dynamodb.table');

    this.client = new DynamoDBClient({
      region,
      endpoint,
      credentials,
    });

    this.docClient = DynamoDBDocumentClient.from(this.client);
    this.logger.log(`DynamoDB client initialized for table: ${this.tableName}`);
  }

  async putMessage(message: any): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: message,
      }),
    );
  }

  async getMessage(conversationId: string, seq: number): Promise<any> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          conversation_id: conversationId,
          seq: seq,
        },
      }),
    );
    return result.Item;
  }

  async queryMessages(
    conversationId: string,
    beforeSeq?: number,
    limit: number = 200,
  ): Promise<any[]> {
    const params: any = {
      TableName: this.tableName,
      KeyConditionExpression: 'conversation_id = :cid',
      ExpressionAttributeValues: {
        ':cid': conversationId,
      },
      Limit: limit,
      ScanIndexForward: false, // descending order by seq (newest first)
    };

    if (beforeSeq !== undefined) {
      params.KeyConditionExpression += ' AND seq < :beforeSeq';
      params.ExpressionAttributeValues[':beforeSeq'] = beforeSeq;
    }

    const result = await this.docClient.send(new QueryCommand(params));
    return result.Items || [];
  }

  async getMessageById(
    conversationId: string,
    messageId: string,
  ): Promise<any> {
    // Query using GSI on message_id
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'MessageIdIndex',
        KeyConditionExpression: 'message_id = :mid',
        ExpressionAttributeValues: {
          ':mid': messageId,
        },
        Limit: 1,
      }),
    );
    return result.Items?.[0];
  }

  getDocClient(): DynamoDBDocumentClient {
    return this.docClient;
  }

  getTableName(): string {
    return this.tableName;
  }
}
