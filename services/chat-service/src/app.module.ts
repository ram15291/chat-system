import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsModule } from './conversations/conversations.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthController } from './health/health.controller';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { Conversation } from './conversations/entities/conversation.entity';
import { Membership } from './conversations/entities/membership.entity';
import { Invite } from './conversations/entities/invite.entity';
import { Read } from './conversations/entities/read.entity';
import { User } from './users/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [Conversation, Membership, Invite, Read, User],
        synchronize: false,
        logging: configService.get<string>('nodeEnv') === 'development',
      }),
      inject: [ConfigService],
    }),
    KafkaModule,
    ConversationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
