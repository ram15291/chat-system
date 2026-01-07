export default () => ({
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    groupId: process.env.KAFKA_GROUP_ID || 'fanout-workers',
    clientId: process.env.KAFKA_CLIENT_ID || 'fanout-worker',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  chatService: {
    url: process.env.CHAT_SERVICE_URL || 'http://localhost:3002/api/chats',
  },
});
