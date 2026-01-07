import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3003),

  // JWT
  JWT_SECRET: Joi.string().required(),

  // PostgreSQL (for reads table)
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),

  // DynamoDB
  DYNAMODB_REGION: Joi.string().default('us-east-1'),
  DYNAMODB_ENDPOINT: Joi.string().optional(),
  DYNAMODB_TABLE: Joi.string().default('messages'),
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),

  // Kafka
  KAFKA_BROKERS: Joi.string().required(),
  KAFKA_CLIENT_ID: Joi.string().default('message-service'),
  KAFKA_CONSUMER_GROUP: Joi.string().default('message-service-group'),

  // Chat Service
  CHAT_SERVICE_URL: Joi.string().required(),
});

export default () => ({
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.PORT, 10) || 3003,
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  database: {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  },
  dynamodb: {
    region: process.env.DYNAMODB_REGION || process.env.AWS_DEFAULT_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    table: process.env.DYNAMODB_TABLE || 'messages',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
  kafka: {
    brokers: process.env.KAFKA_BROKERS.split(','),
    clientId: process.env.KAFKA_CLIENT_ID,
    consumerGroup: process.env.KAFKA_CONSUMER_GROUP,
  },
  chatService: {
    url: process.env.CHAT_SERVICE_URL,
  },
});
