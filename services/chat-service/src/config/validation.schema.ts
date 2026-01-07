import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3002),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  MEMBERSHIP_CACHE_TTL: Joi.number().default(60),
  JWT_SECRET: Joi.string().required(),
});
