import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(email: string, password: string, username?: string) {
    const user = await this.usersService.create(email, password, username);
    return this.generateTokens(user);
  }

  async login(usernameOrEmail: string, password: string) {
    // Try to find user by email or username
    let user = await this.usersService.findByEmail(usernameOrEmail);
    
    if (!user) {
      user = await this.usersService.findByUsername(usernameOrEmail);
    }
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.usersService.validatePassword(user, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.updateLastLogin(user.user_id);
    return this.generateTokens(user);
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      // Verify refresh token signature
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      // Hash the token for database lookup
      const tokenHash = await bcrypt.hash(refreshToken, 10);
      
      // Find the refresh token in database
      const storedToken = await this.refreshTokenRepository.findOne({
        where: {
          user_id: payload.user_id,
          revoked: false,
        },
        order: {
          created_at: 'DESC',
        },
      });

      if (!storedToken || storedToken.expires_at < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Verify the token hash matches
      const isValidToken = await bcrypt.compare(refreshToken, storedToken.token_hash);
      if (!isValidToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new access token
      const user = await this.usersService.findById(payload.user_id);
      const accessToken = this.generateAccessToken(user);

      return {
        access_token: accessToken,
        token_type: 'Bearer',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      if (payload.user_id !== userId) {
        throw new UnauthorizedException('Invalid token');
      }

      // Revoke all refresh tokens for this user (simple approach)
      await this.refreshTokenRepository.update(
        { user_id: userId, revoked: false },
        { revoked: true },
      );

      return { message: 'Logged out successfully' };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(user: User) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.configService.get<string>('jwt.expiresIn'),
      user: {
        user_id: user.user_id,
        email: user.email,
        username: user.username,
      },
    };
  }

  private generateAccessToken(user: User): string {
    const payload = {
      user_id: user.user_id,
      email: user.email,
      username: user.username,
    };

    return this.jwtService.sign(payload);
  }

  private async generateRefreshToken(user: User): Promise<string> {
    const payload = {
      user_id: user.user_id,
      type: 'refresh',
    };

    const expiresIn = this.configService.get<string>('refreshToken.expiresIn');
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn,
    });

    // Store hashed refresh token in database
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.refreshTokenRepository.save({
      user_id: user.user_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    // Clean up expired tokens
    await this.cleanupExpiredTokens();

    return refreshToken;
  }

  private async cleanupExpiredTokens() {
    await this.refreshTokenRepository.delete({
      expires_at: LessThan(new Date()),
    });
  }
}
