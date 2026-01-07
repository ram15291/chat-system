import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Global prefix for all routes
  app.setGlobalPrefix('api/chats');

  // CORS is handled by nginx

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('port');
  await app.listen(port);

  console.log(`Chat Service running on port ${port}`);
  console.log(`Environment: ${configService.get<string>('nodeEnv')}`);
}

bootstrap();
