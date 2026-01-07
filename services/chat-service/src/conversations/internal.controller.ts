import { Controller, Get, Param } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

/**
 * Internal API endpoints for service-to-service communication
 * No authentication required - should only be accessible within Docker network
 */
@Controller('internal/conversations')
export class InternalConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get(':id/members')
  async getMembers(@Param('id') conversationId: string) {
    // For internal calls, we don't validate user membership
    // Just return all members of the conversation
    return this.conversationsService.getConversationMembersInternal(conversationId);
  }
}
