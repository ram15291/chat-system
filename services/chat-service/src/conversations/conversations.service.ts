import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Conversation, ConversationType } from './entities/conversation.entity';
import { Membership, MembershipRole } from './entities/membership.entity';
import { User } from '../users/user.entity';
import { CreateDmDto } from './dto/create-dm.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private conversationsRepository: Repository<Conversation>,
    @InjectRepository(Membership)
    private membershipsRepository: Repository<Membership>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createDm(userId: string, createDmDto: CreateDmDto): Promise<Conversation> {
    const { other_user_id } = createDmDto;

    if (userId === other_user_id) {
      throw new BadRequestException('Cannot create DM with yourself');
    }

    // Check if DM already exists between these two users
    const existingDm = await this.findExistingDm(userId, other_user_id);
    if (existingDm) {
      return existingDm;
    }

    // Create new DM conversation
    const conversation = this.conversationsRepository.create({
      type: ConversationType.DM,
      created_by: userId,
      title: null, // DMs don't have titles - computed on frontend
    });

    const savedConversation = await this.conversationsRepository.save(conversation);

    // Create memberships for both users
    await this.membershipsRepository.save([
      {
        conversation_id: savedConversation.conversation_id,
        user_id: userId,
        role: MembershipRole.MEMBER,
      },
      {
        conversation_id: savedConversation.conversation_id,
        user_id: other_user_id,
        role: MembershipRole.MEMBER,
      },
    ]);

    return savedConversation;
  }

  async createGroup(userId: string, createGroupDto: CreateGroupDto): Promise<Conversation> {
    const { title, member_ids } = createGroupDto;

    // Validate member count (creator + members <= 100)
    if (member_ids.length + 1 > 100) {
      throw new BadRequestException('Group cannot exceed 100 members');
    }

    // Ensure creator is not in member list (we'll add them as ADMIN)
    const uniqueMemberIds = [...new Set(member_ids.filter(id => id !== userId))];

    // Create group conversation
    const conversation = this.conversationsRepository.create({
      type: ConversationType.GROUP,
      title,
      created_by: userId,
    });

    const savedConversation = await this.conversationsRepository.save(conversation);

    // Create memberships: creator as ADMIN, others as MEMBER
    const memberships = [
      {
        conversation_id: savedConversation.conversation_id,
        user_id: userId,
        role: MembershipRole.ADMIN,
      },
      ...uniqueMemberIds.map(memberId => ({
        conversation_id: savedConversation.conversation_id,
        user_id: memberId,
        role: MembershipRole.MEMBER,
      })),
    ];

    await this.membershipsRepository.save(memberships);

    return savedConversation;
  }

  async findUserConversations(userId: string): Promise<Conversation[]> {
    const memberships = await this.membershipsRepository.find({
      where: {
        user_id: userId,
        left_at: IsNull(),
      },
      relations: ['conversation'],
    });

    return memberships
      .map(m => m.conversation)
      .sort((a, b) => {
        // Sort by last message time, nulls last
        if (!a.last_message_at) return 1;
        if (!b.last_message_at) return -1;
        return b.last_message_at.getTime() - a.last_message_at.getTime();
      });
  }

  async findUserDMs(userId: string): Promise<any[]> {
    // Get DM conversations with member info in a single query
    const dms = await this.conversationsRepository
      .createQueryBuilder('conv')
      .innerJoin('memberships', 'm1', 'm1.conversation_id = conv.conversation_id AND m1.user_id = :userId AND m1.left_at IS NULL', { userId })
      .innerJoin('memberships', 'm2', 'm2.conversation_id = conv.conversation_id AND m2.user_id != :userId AND m2.left_at IS NULL', { userId })
      .innerJoin('users', 'u', 'u.user_id = m2.user_id')
      .where('conv.type = :type', { type: ConversationType.DM })
      .select([
        'conv.conversation_id AS conversation_id',
        'conv.type AS type',
        'conv.title AS title',
        'conv.created_by AS created_by',
        'conv.created_at AS created_at',
        'conv.last_seq AS last_seq',
        'conv.last_message_id AS last_message_id',
        'conv.last_message_at AS last_message_at',
        'conv.last_preview AS last_preview',
        'conv.last_has_more AS last_has_more',
        'u.user_id AS other_user_id',
        'u.username AS other_username',
      ])
      .getRawMany();

    return dms.map(dm => ({
      conversation_id: dm.conversation_id,
      type: dm.type,
      title: dm.title,
      created_by: dm.created_by,
      created_at: dm.created_at,
      last_seq: Number(dm.last_seq),
      last_message_id: dm.last_message_id,
      last_message_at: dm.last_message_at,
      last_preview: dm.last_preview,
      last_has_more: dm.last_has_more,
      members: [
        { user_id: userId, username: null }, // Current user
        { user_id: dm.other_user_id, username: dm.other_username },
      ],
    }));
  }

  async findUserGroups(userId: string): Promise<Conversation[]> {
    const memberships = await this.membershipsRepository.find({
      where: {
        user_id: userId,
        left_at: IsNull(),
      },
      relations: ['conversation'],
    });

    return memberships
      .map(m => m.conversation)
      .filter(c => c.type === ConversationType.GROUP);
  }

  async findConversationById(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { conversation_id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify user is a member
    await this.verifyMembership(conversationId, userId);

    return conversation;
  }

  async getConversationMembers(conversationId: string, userId: string): Promise<any[]> {
    // Verify requester is a member
    await this.verifyMembership(conversationId, userId);

    const memberships = await this.membershipsRepository.find({
      where: {
        conversation_id: conversationId,
        left_at: IsNull(),
      },
    });

    // Fetch user details for all members
    const userIds = memberships.map(m => m.user_id);
    const users = await this.usersRepository.find({
      where: {
        user_id: In(userIds),
      },
      select: ['user_id', 'username'],
    });

    // Create a map for quick lookup
    const userMap = new Map(users.map(u => [u.user_id, u.username]));

    // Combine membership data with usernames
    return memberships.map(m => ({
      user_id: m.user_id,
      username: userMap.get(m.user_id) || null,
      role: m.role,
      joined_at: m.joined_at,
      left_at: m.left_at,
    }));
  }

  /**
   * Internal method for service-to-service calls - no auth check
   */
  async getConversationMembersInternal(conversationId: string): Promise<Membership[]> {
    return await this.membershipsRepository.find({
      where: {
        conversation_id: conversationId,
        left_at: IsNull(),
      },
    });
  }

  async allocateSequenceNumber(conversationId: string, userId: string): Promise<{ seq: number }> {
    // Verify user is a member
    await this.verifyMembership(conversationId, userId);

    // Atomic increment of last_seq using PostgreSQL
    const result = await this.conversationsRepository
      .createQueryBuilder()
      .update(Conversation)
      .set({ last_seq: () => 'last_seq + 1' })
      .where('conversation_id = :conversationId', { conversationId })
      .returning('last_seq')
      .execute();

    const newSeq = result.raw[0].last_seq;

    return { seq: Number(newSeq) };
  }

  async verifyMembership(conversationId: string, userId: string): Promise<Membership> {
    const membership = await this.membershipsRepository.findOne({
      where: {
        conversation_id: conversationId,
        user_id: userId,
        left_at: IsNull(),
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    return membership;
  }

  async isUserMember(conversationId: string, userId: string): Promise<boolean> {
    const membership = await this.membershipsRepository.findOne({
      where: {
        conversation_id: conversationId,
        user_id: userId,
        left_at: IsNull(),
      },
    });

    return !!membership;
  }

  private async findExistingDm(userId1: string, userId2: string): Promise<Conversation | null> {
    // Find DM conversations where both users are members
    const conversations = await this.conversationsRepository
      .createQueryBuilder('c')
      .innerJoin('c.memberships', 'm1', 'm1.user_id = :userId1 AND m1.left_at IS NULL', { userId1 })
      .innerJoin('c.memberships', 'm2', 'm2.user_id = :userId2 AND m2.left_at IS NULL', { userId2 })
      .where('c.type = :type', { type: ConversationType.DM })
      .getMany();

    // For DMs, ensure only 2 members
    for (const conversation of conversations) {
      const memberCount = await this.membershipsRepository.count({
        where: {
          conversation_id: conversation.conversation_id,
          left_at: IsNull(),
        },
      });

      if (memberCount === 2) {
        return conversation;
      }
    }

    return null;
  }
}
