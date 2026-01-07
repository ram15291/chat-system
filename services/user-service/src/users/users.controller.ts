import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserResponseDto } from './dto/user-response.dto';
import { plainToInstance } from 'class-transformer';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req): Promise<UserResponseDto> {
    const user = await this.usersService.findById(req.user.user_id);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchUsers(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ): Promise<UserResponseDto[]> {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const users = await this.usersService.searchUsers(query, limitNum);
    return users.map((user) =>
      plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true }),
    );
  }
}
