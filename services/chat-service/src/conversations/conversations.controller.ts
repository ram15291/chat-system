import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDmDto } from './dto/create-dm.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateInviteDto } from './dto/create-invite.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly invitesService: InvitesService,
  ) {}

  @Post('dm')
  async createDm(@Request() req, @Body() createDmDto: CreateDmDto) {
    return this.conversationsService.createDm(req.user.user_id, createDmDto);
  }

  @Post('group')
  async createGroup(@Request() req, @Body() createGroupDto: CreateGroupDto) {
    return this.conversationsService.createGroup(req.user.user_id, createGroupDto);
  }

  @Get()
  async getUserConversations(@Request() req) {
    return this.conversationsService.findUserConversations(req.user.user_id);
  }

  @Get('dms')
  async getUserDMs(@Request() req) {
    return this.conversationsService.findUserDMs(req.user.user_id);
  }

  @Get('groups')
  async getUserGroups(@Request() req) {
    return this.conversationsService.findUserGroups(req.user.user_id);
  }

  @Get(':id')
  async getConversation(@Request() req, @Param('id') conversationId: string) {
    return this.conversationsService.findConversationById(
      conversationId,
      req.user.user_id,
    );
  }

  @Get(':id/members')
  async getMembers(@Request() req, @Param('id') conversationId: string) {
    return this.conversationsService.getConversationMembers(
      conversationId,
      req.user.user_id,
    );
  }

  @Post(':id/allocate-seq')
  @HttpCode(HttpStatus.OK)
  async allocateSequence(@Request() req, @Param('id') conversationId: string) {
    return this.conversationsService.allocateSequenceNumber(
      conversationId,
      req.user.user_id,
    );
  }

  @Post(':id/invite')
  async createInvite(
    @Request() req,
    @Param('id') conversationId: string,
    @Body() createInviteDto: CreateInviteDto,
  ) {
    return this.invitesService.createInvite(
      conversationId,
      req.user.user_id,
      createInviteDto,
    );
  }

  @Post('invites/:inviteId/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(@Request() req, @Param('inviteId') inviteId: string) {
    return this.invitesService.acceptInvite(inviteId, req.user.user_id);
  }

  @Post('invites/:inviteId/decline')
  @HttpCode(HttpStatus.OK)
  async declineInvite(@Request() req, @Param('inviteId') inviteId: string) {
    await this.invitesService.declineInvite(inviteId, req.user.user_id);
    return { message: 'Invite declined' };
  }

  @Get('invites/my')
  async getMyInvites(@Request() req) {
    return this.invitesService.getUserInvites(req.user.user_id);
  }
}
