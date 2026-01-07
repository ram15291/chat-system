import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration, { configValidationSchema } from './config/configuration';
import { MessagesModule } from './messages/messages.module';
import { DynamoDBModule } from './dynamodb/dynamodb.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthController } from './health/health.controller';
import { Read } from './reads/entities/read.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: configValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [Read],
        synchronize: true, // For development only
      }),
      inject: [ConfigService],
    }),
    DynamoDBModule,
    KafkaModule,
    MessagesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
