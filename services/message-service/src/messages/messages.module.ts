import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { DynamoDBModule } from '../dynamodb/dynamodb.module';
import { KafkaModule } from '../kafka/kafka.module';
import { Read } from '../reads/entities/read.entity';
import { JwtStrategy } from '../auth/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Read]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
    DynamoDBModule,
    KafkaModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, JwtStrategy],
})
export class MessagesModule {}
