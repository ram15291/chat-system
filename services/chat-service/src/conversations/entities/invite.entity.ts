import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

@Entity('invites')
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  invite_id: string;

  @Column('uuid')
  conversation_id: string;

  @Column('uuid')
  invited_user_id: string;

  @Column('uuid')
  invited_by: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status: InviteStatus;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.invites)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;
}
