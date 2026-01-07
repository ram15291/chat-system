export default () => {
  const config = {
    port: parseInt(process.env.PORT, 10) || 3001,
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
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },
    refreshToken: {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    },
  };
  
  console.log('🔧 Configuration loaded:');
  console.log('  NODE_ENV:', config.nodeEnv);
  console.log('  PORT:', config.port);
  console.log('  POSTGRES_HOST:', config.database.host);
  console.log('  POSTGRES_DB:', config.database.database);
  console.log('  REDIS_URL:', config.redis.url);
  
  return config;
};
