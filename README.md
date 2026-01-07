# Real-Time Chat System

A production-ready, scalable microservices chat system supporting 1:1 DMs and group chats (up to 100 members) with real-time delivery, message history, and horizontal scalability.

**Built with**: TypeScript, NestJS, React, PostgreSQL, DynamoDB, Kafka, Redis, Socket.IO, Docker

## 📚 Documentation

- **[Architecture Overview](./architecture/architecture-overview.md)** - Complete system design, data models, API specs
- **[Quick Start](#-quick-start)** - Get running in 5 minutes (below)
- **[API Reference](#-api-endpoints)** - REST endpoints and Socket.IO events
- **[Deployment](#-deployment)** - Docker profiles and scaling

## ✨ Features

- **Authentication** - JWT + refresh tokens
- **1:1 & Group Chats** - Direct messages and private groups (max 100 members)
- **Real-time Delivery** - Socket.IO (WebSocket + polling fallback)
- **Message Ordering** - Guaranteed ordering via centralized sequence allocation
- **Infinite Scroll** - Preview-based loading (200 char previews, lazy-load full messages)
- **Read States** - Per-user read tracking
- **Horizontal Scaling** - All services scalable via `docker-compose --scale`
- **Observability** - Grafana + Loki + Promtail (optional)

## 🏭️ Architecture

**5 Microservices:**
1. User Service - Auth & sessions
2. Chat Service - Conversations & memberships  
3. Message Service - Message storage & retrieval
4. Realtime Gateway - Socket.IO connections
5. Fanout Worker - Kafka consumer & event routing

**Data Stores:**
- PostgreSQL (users, conversations, memberships, read states)
- DynamoDB (messages with seq-based ordering)
- Redis (presence, pub/sub, caching)
- Kafka (event streaming)

**See [architecture/architecture-overview.md](./architecture/architecture-overview.md) for complete details.**

## 🚀 Quick Start

**Requirements:** Docker & Docker Compose

```bash
# Clone repository
git clone <repository-url>
cd chat-system

# Start entire stack (infrastructure + backend + frontend)
docker-compose --profile infra --profile ui up --build
```

**That's it!** Everything auto-initializes (migrations, Kafka topics, DynamoDB tables).

**Access:**
- **Frontend**: http://localhost:3000
- **API**: http://localhost/api/*
- **Grafana**: http://localhost:3005 (add `--profile obs` to enable)

**First time?** Create test users via the frontend registration or use:
```bash
curl -X POST http://localhost/api/users/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"test123","username":"testuser"}'
```

## 📦 Deployment

### Docker Profiles

```bash
# Full stack with observability
docker-compose --profile infra --profile apps --profile ui --profile obs up --build

# Backend only (for frontend development)
docker-compose --profile infra --profile apps --profile edge up

# Stop everything
docker-compose down

# Clean slate (remove volumes)
docker-compose down -v
```

### Scaling Services

```bash
# Scale horizontally
docker-compose --profile infra --profile ui up \
  --scale user-service=2 \
  --scale message-service=3 \
  --scale gateway=2

# Note: For gateway scaling > 1, enable nginx ip_hash in nginx.conf for efficiency
```

### Local Development (Optional)

Run services locally outside Docker:

**1. Start infrastructure only:**
```bash
docker-compose --profile infra up
```

**2. Install dependencies:**

```bash
# Install for all services
for dir in services/*/ frontend/; do
  (cd "$dir" && npm install)
done
```

**3. Run services** (each in separate terminal):
```bash
cd services/user-service && npm run start:dev
cd services/chat-service && npm run start:dev
cd services/message-service && npm run start:dev
cd services/realtime-gateway && npm run start:dev
cd services/fanout-worker && npm run start:dev
cd frontend && npm start  # http://localhost:3000
```

## 🧪 Testing

```bash
# Unit tests
cd services/<service-name> && npm test

# Integration tests
cd services/<service-name> && npm run test:e2e
```

**Note:** E2E test suite planned but not yet implemented. Manual testing via frontend currently.

## 📡 API Endpoints

### User Service - `/api/users`
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh token
- `GET /me` - Current user info

### Chat Service - `/api/chats`
- `POST /conversations/dm` - Create/get DM
- `POST /conversations/group` - Create group
- `GET /conversations` - List conversations
- `POST /conversations/{id}/invite` - Invite user

### Message Service - `/api/messages`
- `POST /conversations/{id}/messages` - Send message
- `GET /conversations/{id}/messages?after_seq=N&limit=200` - Get history
- `GET /conversations/{id}/messages/{id}?fields=full` - Get full message

**Full API documentation:** See [architecture/architecture-overview.md](./architecture/architecture-overview.md#service-breakdown)

### Socket.IO (`/ws/socket.io`)

Connect and authenticate:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost/ws', {
  path: '/socket.io',
  transports: ['websocket', 'polling']
});

socket.emit('authenticate', { token: YOUR_JWT_TOKEN });

socket.on('authenticated', ({ userId }) => {
  console.log('Connected as:', userId);
});

socket.on('message:new', (data) => {
  console.log('New message:', data);
});
```

**Message Event Format (`message:new`):**
```json
{
  "conversation_id": "uuid",
  "message_id": "uuid",
  "seq": 12345,
  "sender_id": "uuid",
  "created_at": "2026-01-07T12:34:56Z",
  "preview": "First 200 chars...",
  "has_more": true
}
```

## 🔧 Configuration

All configuration in `docker-compose.yml`. Key environment variables:
- `POSTGRES_*` - Database credentials
- `JWT_SECRET` - Auth secret (change in production!)
- `KAFKA_BROKERS` - Kafka endpoints
- `REDIS_URL` - Redis connection

For local development .env files, see service directories.

## 🐳 Common Docker Commands

```bash
# View logs
docker-compose logs -f message-service

# Restart specific service
docker-compose restart message-service

# Rebuild after code changes
docker-compose up -d --build message-service
```

## 🛠️ Troubleshooting

```bash
# Check service health
docker-compose ps

# View service logs
docker-compose logs -f <service-name>

# LocalStack health
curl http://localhost:4566/_localstack/health

# PostgreSQL shell
docker exec -it chat-app-postgres-1 psql -U chatuser -d chatdb

# Clean restart
docker-compose down -v && docker-compose --profile infra --profile ui up --build
```

**Common Issues:**
- **Socket.IO connection fails**: Check JWT token validity, verify gateway service is running
- **Port conflicts**: Stop existing services on ports 80, 3000, 5432, 6379, 9092, 4566
- **Slow startup**: First run takes longer (building images, downloading dependencies)

---

## 📚 Resources

- **[Architecture Documentation](./architecture/architecture-overview.md)** - Complete system design
- **[NestJS Docs](https://docs.nestjs.com/)** - Backend framework
- **[Socket.IO Docs](https://socket.io/docs/)** - Real-time communication

## 📝 License & Status

**License**: MIT  
**Status**: MVP - Production-ready architecture, case study implementation  
**Version**: 1.0.0 (January 2026)

**Production Checklist:**
- [ ] Replace LocalStack with AWS (DynamoDB, MSK)
- [ ] Add monitoring (Prometheus, DataDog)
- [ ] Implement rate limiting & security hardening
- [ ] Add E2E test suite
- [ ] Set up CI/CD pipeline
- [ ] Configure auto-scaling & load balancing
