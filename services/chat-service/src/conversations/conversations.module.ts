import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConversationsController } from './conversations.controller';
import { InternalConversationsController } from './internal.controller';
import { ConversationsService } from './conversations.service';
import { InvitesService } from './invites.service';
import { KafkaModule } from '../kafka/kafka.module';
import { Conversation } from './entities/conversation.entity';
import { Membership } from './entities/membership.entity';
import { Invite } from './entities/invite.entity';
import { Read } from './entities/read.entity';
import { User } from '../users/user.entity';
import { JwtStrategy } from '../auth/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Membership, Invite, Read, User]),
    KafkaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ConversationsController, InternalConversationsController],
  providers: [ConversationsService, InvitesService, JwtStrategy],
  exports: [ConversationsService, InvitesService],
})
export class ConversationsModule {}
