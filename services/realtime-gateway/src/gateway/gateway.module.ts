import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    JwtModule.register({}), // JWT config passed via ConfigService
    RedisModule,
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
