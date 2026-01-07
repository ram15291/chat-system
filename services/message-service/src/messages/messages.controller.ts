import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Headers,
  Logger,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { UpdateReadDto } from './dto/update-read.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);
  
  constructor(private readonly messagesService: MessagesService) {}

  @Post(':id/messages')
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
    @Request() req,
    @Headers('authorization') authToken: string,
  ) {
    this.logger.log(`Sending message - JWT user: ${JSON.stringify(req.user)}, userId: ${req.user.userId}`);
    return await this.messagesService.sendMessage(
      conversationId,
      req.user.userId,
      dto,
      authToken,
    );
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Query() query: GetMessagesDto,
  ) {
    return await this.messagesService.getMessages(
      conversationId,
      query.after_seq,
      query.limit || 200,
    );
  }

  @Get(':id/messages/:messageId')
  async getMessageById(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return await this.messagesService.getMessageById(conversationId, messageId);
  }

  @Post(':id/read')
  async updateReadState(
    @Param('id') conversationId: string,
    @Body() dto: UpdateReadDto,
    @Request() req,
  ) {
    return await this.messagesService.updateReadState(
      req.user.userId,
      conversationId,
      dto.last_read_seq,
    );
  }

  @Get(':id/read')
  async getReadState(@Param('id') conversationId: string, @Request() req) {
    return await this.messagesService.getReadState(
      req.user.userId,
      conversationId,
    );
  }
}
