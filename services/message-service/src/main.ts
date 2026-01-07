import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/messages');

  // CORS is handled by nginx

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');

  await app.listen(port);
  console.log(`Message Service running on port ${port}`);
}
bootstrap();
