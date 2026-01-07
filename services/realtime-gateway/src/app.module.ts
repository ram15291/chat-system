import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { GatewayModule } from './gateway/gateway.module';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    RedisModule,
    GatewayModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
