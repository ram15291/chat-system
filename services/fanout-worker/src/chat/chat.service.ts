import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface Member {
  user_id: string;
  role: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get<string>('chatService.url');
  }

  /**
   * Fetch all members of a conversation
   */
  async getConversationMembers(conversationId: string): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/internal/conversations/${conversationId}/members`;
      
      const response = await firstValueFrom(
        this.httpService.get<Member[]>(url),
      );

      const userIds = response.data.map(member => member.user_id);
      this.logger.debug(`Fetched ${userIds.length} members for conversation ${conversationId}`);
      
      return userIds;
    } catch (error) {
      this.logger.error(
        `Failed to fetch members for conversation ${conversationId}:`,
        error.message,
      );
      throw error;
    }
  }
}
