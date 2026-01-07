import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('reads')
export class Read {
  @PrimaryColumn('uuid')
  conversation_id: string;

  @PrimaryColumn('uuid')
  user_id: string;

  @Column({ type: 'bigint', default: 0 })
  last_read_seq: number;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.reads)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;
}
