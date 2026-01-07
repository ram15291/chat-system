import { Controller, Get } from '@nestjs/common';
import { EventsGateway } from '../gateway/events.gateway';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly eventsGateway: EventsGateway,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      gatewayId: this.redisService.getGatewayId(),
      activeConnections: this.eventsGateway.getConnectionCount(),
      timestamp: new Date().toISOString(),
    };
  }
}
