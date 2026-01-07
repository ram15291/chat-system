import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  token_id: string;

  @Column('uuid')
  user_id: string;

  @Column({ length: 255 })
  token_hash: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @Column({ default: false })
  revoked: boolean;

  @ManyToOne(() => User, (user) => user.refresh_tokens)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
