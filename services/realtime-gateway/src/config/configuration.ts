export default () => ({
  port: parseInt(process.env.PORT, 10) || 3004,
  gatewayId: process.env.GATEWAY_ID || 'gateway-unknown',
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret',
  },
  heartbeat: {
    interval: parseInt(process.env.HEARTBEAT_INTERVAL, 10) || 30000,
  },
});
