import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 100, nullable: true })
  username: string;
}
