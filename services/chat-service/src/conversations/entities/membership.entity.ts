import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

export enum MembershipRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

@Entity('memberships')
export class Membership {
  @PrimaryColumn('uuid')
  conversation_id: string;

  @PrimaryColumn('uuid')
  user_id: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: MembershipRole,
    default: MembershipRole.MEMBER,
  })
  role: MembershipRole;

  @CreateDateColumn()
  joined_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  left_at: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.memberships)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;
}
