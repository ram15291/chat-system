import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('Bootstrap');

  logger.log('🚀 Fanout Worker started');
  logger.log('📨 Listening for Kafka messages on topic: message.new');
  logger.log('📡 Publishing to Redis gateway channels');

  // Keep the application running
  process.on('SIGINT', async () => {
    logger.log('Shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.log('Shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
