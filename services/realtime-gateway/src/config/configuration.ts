import * as os from 'os';

export default () => ({
  port: parseInt(process.env.PORT, 10) || 3004,
  // Use container hostname for unique gateway ID when scaled
  // Docker sets HOSTNAME to container name (e.g., chat-app-gateway-1, chat-app-gateway-2)
  gatewayId: process.env.GATEWAY_ID || process.env.HOSTNAME || os.hostname() || `gateway-${Math.random().toString(36).substr(2, 9)}`,
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
