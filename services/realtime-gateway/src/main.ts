import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = configService.get<number>('port');
  const gatewayId = configService.get<string>('gatewayId');

  // CORS is handled by nginx

  // HTTP-level logging for Socket.IO requests
  app.use((req, res, next) => {
    if (req.url.startsWith('/ws/socket.io')) {
      logger.log(`[HTTP] ${req.method} ${req.url}`, {
        upgrade: req.headers['upgrade'],
        connection: req.headers['connection'],
        origin: req.headers['origin'],
      });
    }
    next();
  });

  await app.listen(port);
  
  logger.log(`🚀 Realtime Gateway (${gatewayId}) running on port ${port}`);
  logger.log(`📡 WebSocket endpoint: ws://localhost:${port}/ws/socket.io`);
  logger.log(`🏥 Health check: http://localhost:${port}/health`);
}

bootstrap();
