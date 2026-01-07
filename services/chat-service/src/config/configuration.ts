export default () => {
  const config = {
    port: parseInt(process.env.PORT, 10) || 3002,
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    },
    redis: {
      url: process.env.REDIS_URL,
    },
    kafka: {
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      clientId: process.env.KAFKA_CLIENT_ID || 'chat-service',
    },
    membershipCacheTTL: parseInt(process.env.MEMBERSHIP_CACHE_TTL, 10) || 60,
    jwt: {
      secret: process.env.JWT_SECRET,
    },
  };
  
  console.log('🔧 Chat Service Configuration:');
  console.log('  NODE_ENV:', config.nodeEnv);
  console.log('  PORT:', config.port);
  console.log('  POSTGRES_HOST:', config.database.host);
  console.log('  POSTGRES_DB:', config.database.database);
  console.log('  REDIS_URL:', config.redis.url);
  console.log('  MEMBERSHIP_CACHE_TTL:', config.membershipCacheTTL, 'seconds');
  
  return config;
};
