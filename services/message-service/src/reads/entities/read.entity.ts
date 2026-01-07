import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('reads')
export class Read {
  @PrimaryColumn()
  user_id: string;

  @PrimaryColumn()
  conversation_id: string;

  @Column()
  last_read_seq: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
