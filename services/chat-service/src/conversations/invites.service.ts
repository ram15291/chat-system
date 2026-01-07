import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Invite, InviteStatus } from './entities/invite.entity';
import { Membership, MembershipRole } from './entities/membership.entity';
import { Conversation, ConversationType } from './entities/conversation.entity';
import { CreateInviteDto } from './dto/create-invite.dto';

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invite)
    private invitesRepository: Repository<Invite>,
    @InjectRepository(Membership)
    private membershipsRepository: Repository<Membership>,
    @InjectRepository(Conversation)
    private conversationsRepository: Repository<Conversation>,
  ) {}

  async createInvite(
    conversationId: string,
    inviterId: string,
    createInviteDto: CreateInviteDto,
  ): Promise<Invite> {
    const { user_id: invitedUserId } = createInviteDto;

    // Get conversation
    const conversation = await this.conversationsRepository.findOne({
      where: { conversation_id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Only GROUP conversations support invites
    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Only group conversations support invites');
    }

    // Verify inviter is a member
    const inviterMembership = await this.membershipsRepository.findOne({
      where: {
        conversation_id: conversationId,
        user_id: inviterId,
        left_at: IsNull(),
      },
    });

    if (!inviterMembership) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    // Check if invited user is already a member
    const existingMembership = await this.membershipsRepository.findOne({
      where: {
        conversation_id: conversationId,
        user_id: invitedUserId,
        left_at: IsNull(),
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member');
    }

    // Check for pending invite
    const existingInvite = await this.invitesRepository.findOne({
      where: {
        conversation_id: conversationId,
        invited_user_id: invitedUserId,
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      return existingInvite; // Return existing pending invite
    }

    // Check member count (max 100)
    const memberCount = await this.membershipsRepository.count({
      where: {
        conversation_id: conversationId,
        left_at: IsNull(),
      },
    });

    if (memberCount >= 100) {
      throw new BadRequestException('Group is at maximum capacity (100 members)');
    }

    // Create invite
    const invite = this.invitesRepository.create({
      conversation_id: conversationId,
      invited_user_id: invitedUserId,
      invited_by: inviterId,
      status: InviteStatus.PENDING,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return await this.invitesRepository.save(invite);
  }

  async acceptInvite(inviteId: string, userId: string): Promise<{ conversation_id: string }> {
    const invite = await this.invitesRepository.findOne({
      where: { invite_id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // Verify invite is for this user
    if (invite.invited_user_id !== userId) {
      throw new ForbiddenException('This invite is not for you');
    }

    // Check invite status
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Invite is ${invite.status.toLowerCase()}`);
    }

    // Check expiry
    if (invite.expires_at && invite.expires_at < new Date()) {
      // Mark as expired
      await this.invitesRepository.update(inviteId, { status: InviteStatus.EXPIRED });
      throw new BadRequestException('Invite has expired');
    }

    // Check member count
    const memberCount = await this.membershipsRepository.count({
      where: {
        conversation_id: invite.conversation_id,
        left_at: IsNull(),
      },
    });

    if (memberCount >= 100) {
      throw new BadRequestException('Group is at maximum capacity');
    }

    // Create membership
    await this.membershipsRepository.save({
      conversation_id: invite.conversation_id,
      user_id: userId,
      role: MembershipRole.MEMBER,
    });

    // Update invite status
    await this.invitesRepository.update(inviteId, { status: InviteStatus.ACCEPTED });

    return { conversation_id: invite.conversation_id };
  }

  async declineInvite(inviteId: string, userId: string): Promise<void> {
    const invite = await this.invitesRepository.findOne({
      where: { invite_id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // Verify invite is for this user
    if (invite.invited_user_id !== userId) {
      throw new ForbiddenException('This invite is not for you');
    }

    // Check invite status
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Invite is already ${invite.status.toLowerCase()}`);
    }

    // Update invite status
    await this.invitesRepository.update(inviteId, { status: InviteStatus.DECLINED });
  }

  async getUserInvites(userId: string): Promise<Invite[]> {
    return await this.invitesRepository.find({
      where: {
        invited_user_id: userId,
        status: InviteStatus.PENDING,
      },
      order: {
        created_at: 'DESC',
      },
    });
  }
}
