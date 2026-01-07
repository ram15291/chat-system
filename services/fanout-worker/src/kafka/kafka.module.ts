import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { RedisModule } from '../redis/redis.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [RedisModule, ChatModule],
  providers: [KafkaService],
})
export class KafkaModule {}
