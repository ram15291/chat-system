import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Membership } from './membership.entity';
import { Invite } from './invite.entity';
import { Read } from './read.entity';

export enum ConversationType {
  DM = 'DM',
  GROUP = 'GROUP',
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  conversation_id: string;

  @Column({
    type: 'varchar',
    length: 10,
    enum: ConversationType,
  })
  type: ConversationType;

  @Column({ length: 255, nullable: true })
  title: string;

  @Column('uuid')
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  // Last message metadata
  @Column({ type: 'bigint', default: 0 })
  last_seq: number;

  @Column({ length: 50, nullable: true })
  last_message_id: string;

  @Column({ type: 'timestamp', nullable: true })
  last_message_at: Date;

  @Column({ length: 200, nullable: true })
  last_preview: string;

  @Column({ default: false })
  last_has_more: boolean;

  @OneToMany(() => Membership, (membership) => membership.conversation)
  memberships: Membership[];

  @OneToMany(() => Invite, (invite) => invite.conversation)
  invites: Invite[];

  @OneToMany(() => Read, (read) => read.conversation)
  reads: Read[];
}
