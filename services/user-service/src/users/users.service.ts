import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(email: string, password: string, username?: string): Promise<User> {
    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = this.usersRepository.create({
      email,
      password_hash,
      username: username || email.split('@')[0], // Default username from email
    });

    return await this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { username } });
  }

  async findById(user_id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { user_id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password_hash);
  }

  async updateLastLogin(user_id: string): Promise<void> {
    await this.usersRepository.update(user_id, {
      updated_at: new Date(),
    });
  }

  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    return await this.usersRepository
      .createQueryBuilder('user')
      .where('user.username ILIKE :query', { query: `%${query}%` })
      .orWhere('user.email ILIKE :query', { query: `%${query}%` })
      .take(limit)
      .getMany();
  }
}
