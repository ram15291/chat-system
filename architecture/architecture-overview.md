# Real-Time Chat System - MVP Architecture

## Project Overview

A scalable real-time chat system built with microservices architecture, supporting 1:1 DMs and private group chats (max 100 members) with multi-instance deployment capability.

## Tech Stack

### Backend
- **Language**: TypeScript
- **Framework**: NestJS
- **API**: REST (GraphQL post-MVP)
- **Database**: PostgreSQL (users, conversations, memberships)
- **Message Store**: DynamoDB (via LocalStack)
- **Cache/Registry**: Redis
- **Event Streaming**: Kafka (Confluent Platform 7.5.0 + Zookeeper)
- **Real-time**: Socket.IO (WebSocket with polling fallback)

### Frontend
- **Framework**: React
- **State Management**: Context API + Zustand
- **WebSocket Client**: socket.io-client
- **HTTP Client**: axios
- **Build**: Production build served by Nginx in Docker

### Infrastructure
- **Containerization**: Docker + docker-compose with deployment profiles
- **Local AWS Services**: LocalStack (DynamoDB only)
- **Message Queue**: Kafka (Confluent Platform) + Zookeeper
- **Load Balancer**: nginx (CORS, WebSocket upgrade, routing)
- **Observability**: Grafana + Loki + Promtail (optional profile)

---

## MVP Features (Locked)

### In Scope
-  Authentication + session management (JWT + refresh tokens)
-  1:1 chats (Direct Messages)
-  Private group chats (invite-only, max 100 members)
-  Send messages (up to 100,000 characters)
-  Real-time delivery via WebSocket (pointer-based)
-  Conversation list with last message preview
-  Message history with infinite scroll
-  Read state tracking (last read sequence per conversation)

### Out of Scope (Post-MVP)
- Message edit/delete
- Message search
- File attachments/media
- End-to-end encryption
- Message reactions
- Typing indicators
- Push notifications (mobile)
- GraphQL (will migrate post-MVP)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  - Conversation List    - Chat UI    - Message History      │
└────┬──────────────────────────────────────────────┬──────────┘
     │ REST API (HTTP)                               │ WebSocket
     │                                               │
┌────▼───────────────────────────────────────────────▼─────────┐
│                      nginx (Load Balancer)                    │
│  - Routes /api/users → User Service                          │
│  - Routes /api/chats → Chat Service                          │
│  - Routes /api/messages → Message Service                    │
│  - Routes /ws → Realtime Gateway (sticky sessions)           │
└──────────────┬──────────────┬──────────────┬─────────────────┘
               │              │              │
    ┌──────────▼─────┐ ┌─────▼──────┐ ┌─────▼─────────┐
    │ User Service   │ │Chat Service│ │Message Service│
    │  (x2 instances)│ │(x2 instances)│ │(x2 instances) │
    └────────┬───────┘ └──────┬─────┘ └───────┬───────┘
             │                │                │
             │         ┌──────▼────────────────▼───────┐
             │         │     PostgreSQL                 │
             │         │  - users                       │
             │         │  - conversations               │
             │         │  - memberships                 │
             │         │  - invites                     │
             │         │  - reads                       │
             │         └────────────────────────────────┘
             │
    ┌────────▼────────────────────────────────────────────────┐
    │                  Realtime Gateway                        │
    │                    (x2 instances)                        │
    │  - WebSocket connection management                      │
    │  - Auth on connect                                      │
    │  - Push pointer events to clients                       │
    └──────────┬──────────────────────────────────────────────┘
               │
    ┌──────────▼────────────────────────────────────────┐
    │              Fanout Worker                         │
    │  - Consumes Kafka events                          │
    │  - Resolves recipients                            │
    │  - Routes to gateway nodes                        │
    └──────────┬────────────────────────────────────────┘
               │
    ┌──────────▼────────────────────────────────────────┐
    │         LocalStack (AWS Services)                  │
    │  - Kafka (MSK): message.created events            │
    │  - DynamoDB: messages table                       │
    │  - Redis: presence, connection registry, cache    │
    └────────────────────────────────────────────────────┘
```

---

## Service Breakdown

### 1. User Service
**Responsibility**: Authentication, user management, sessions

**Endpoints**:
- `POST /api/users/auth/login` - User login
- `POST /api/users/auth/refresh` - Refresh JWT token
- `POST /api/users/auth/logout` - Logout user
- `GET /api/users/me` - Get current user profile

**Tech**:
- NestJS REST API
- PostgreSQL (users table)
- JWT for authentication
- bcrypt for password hashing

**Instances**: Scalable via `docker-compose up --scale user-service=N` (stateless, nginx load balances automatically)

---

### 2. Chat Service
**Responsibility**: Conversation management, memberships, invites

**Endpoints**:
- `POST /api/chats/conversations/dm` - Create/get DM conversation
  - Body: `{other_user_id: string}`
  - Idempotent (returns existing if found)
- `POST /api/chats/conversations/group` - Create group chat
  - Body: `{title: string, member_ids: string[]}` (max 100)
- `POST /api/chats/conversations/{id}/invite` - Invite user to group
  - Body: `{user_id: string}`
- `POST /api/chats/conversations/{id}/join` - Join via invite
  - Body: `{invite_id: string}`
- `GET /api/chats/conversations` - List user's conversations
  - Returns: conversation list with last message preview + unread count
- `GET /api/chats/conversations/{id}/members` - Get conversation members
- `POST /api/chats/conversations/{id}/allocate-seq` - Allocate next sequence number
  - **Critical for message ordering**
  - Returns: `{seq: number}`

**Tech**:
- NestJS REST API
- PostgreSQL (conversations, memberships, invites, reads)
- Redis (membership cache, 30-60s TTL)

**Instances**: Scalable via `docker-compose up --scale chat-service=N` (stateless, nginx load balances automatically)

---

### 3. Message Service
**Responsibility**: Message creation, storage, retrieval

**Endpoints**:
- `POST /api/messages/conversations/{id}/messages` - Send message
  - Body: `{client_msg_id: string, body: string}`
  - Validates: `body.length <= 100,000`
  - Process:
    1. Call Chat Service to allocate seq
    2. Store in DynamoDB (preview + full body)
    3. Emit Kafka event
- `GET /api/messages/conversations/{id}/messages` - Get message history
  - Query: `?after_seq=N&limit=200`
  - Returns: preview-only messages (first 200 chars)
- `GET /api/messages/conversations/{id}/messages/{message_id}` - Get full message
  - Query: `?fields=full`
  - Returns: complete message body
- `POST /api/messages/conversations/{id}/read` - Update read state
  - Body: `{last_read_seq: number}`

**Tech**:
- NestJS REST API
- DynamoDB (messages table)
- Kafka producer (message.created events)
- PostgreSQL (reads table for read state)

**Instances**: Scalable via `docker-compose up --scale message-service=N` (stateless, nginx load balances automatically)

---

### 4. Realtime Gateway
**Responsibility**: WebSocket connection management, real-time event delivery

**Protocol**: Socket.IO over HTTP (`/ws/socket.io`)

**Flow**:
1. Client connects: Socket.IO client connects to `http://localhost/ws/socket.io`
2. Client emits 'authenticate' event with `{ token: <jwt> }`
3. Gateway validates JWT and associates userId with socketId
4. Gateway registers connection in Redis: `presence:user:{userId}` → `{gatewayId}:{socketId}`
5. Gateway subscribes to Redis channel: `gateway:{gateway_id}:channel`
6. On incoming message: push pointer event to client via `socket.emit('message:new', data)`

**Socket.IO Events**:

*Client → Server:*
- `authenticate`: `{ token: string }` - Authenticate the connection
- `ping`: Heartbeat from client

*Server → Client:*
- `authenticated`: `{ userId: string }` - Authentication successful
- `error`: `{ message: string }` - Authentication or connection errors
- `message:new`: New message pointer event
- `pong`: Heartbeat response

**Message Pointer Event Format** (`message:new`):
```json
{
  "conversation_id": "c123",
  "message_id": "m789",
  "seq": 98765,
  "sender_id": "u42",
  "created_at": "2026-01-07T12:34:56Z",
  "preview": "first 200 chars of message...",
  "has_more": true
}
```

**Tech**:
- NestJS with @nestjs/platform-socket.io
- Socket.IO server (WebSocket + polling fallback)
- Redis (connection registry, pub/sub)
- JWT authentication on connection
- Heartbeat mechanism (ping/pong every 30s)

**Instances**: Scalable via `docker-compose up --scale gateway=N`. Sticky sessions (nginx `ip_hash`) recommended but optional when scaling beyond 1 instance.

**Note**: Gateway maintains stateful Socket.IO connections. While Redis pub/sub enables cross-instance message delivery, sticky sessions improve efficiency by ensuring clients consistently hit the same gateway instance (especially for Socket.IO polling fallback).

---

### 5. Fanout Worker
**Responsibility**: Event processing, recipient resolution, message routing

**Flow**:
1. Consume `message.created` event from Kafka
2. Fetch conversation members from Chat Service (cached in Redis)
3. For each recipient:
   - Check Redis if user is online
   - If online: publish pointer event to user's gateway channel(s)
   - If offline: skip (user will catch up via history API)
4. Acknowledge Kafka message

**Tech**:
- NestJS microservice (Kafka consumer)
- Redis (for online presence lookup)
- Kafka consumer group (for horizontal scaling)

**Instances**: Scalable via `docker-compose up --scale fanout-worker=N` (Kafka consumer group handles load distribution)

---

## Data Models

### PostgreSQL Schema

#### users
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

#### conversations
```sql
CREATE TABLE conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('DM', 'GROUP')),
  title VARCHAR(255), -- nullable for DMs
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Last message metadata (for conversation list)
  last_seq BIGINT DEFAULT 0,
  last_message_id VARCHAR(50),
  last_message_at TIMESTAMP,
  last_preview VARCHAR(200),
  last_has_more BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);
```

#### memberships
```sql
CREATE TABLE memberships (
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP, -- nullable, null = active member
  
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_conversation_id ON memberships(conversation_id);
CREATE INDEX idx_memberships_active ON memberships(user_id, left_at) WHERE left_at IS NULL;
```

#### invites
```sql
CREATE TABLE invites (
  invite_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(user_id),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  UNIQUE(conversation_id, invited_user_id, status)
);

CREATE INDEX idx_invites_user ON invites(invited_user_id, status);
CREATE INDEX idx_invites_conversation ON invites(conversation_id);
```

#### reads
```sql
CREATE TABLE reads (
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  last_read_seq BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_reads_user_id ON reads(user_id);
```

---

### DynamoDB Schema (LocalStack)

#### messages Table

**Partition Key**: `conversation_id` (String)  
**Sort Key**: `seq` (Number)

**Attributes**:
```json
{
  "conversation_id": "c123",           // PK
  "seq": 98765,                        // SK (strict ordering)
  "message_id": "01HN8X...",           // ULID or UUID
  "sender_id": "u42",
  "created_at": "2026-01-07T12:34:56Z",
  "preview": "first 200 chars...",     // String (max 200 chars)
  "has_more": true,                    // Boolean
  "body": "full message up to 100k chars" // String (up to 100,000 chars)
}
```

**Queries**:
- Get messages after sequence: `conversation_id = :cid AND seq > :after_seq LIMIT :limit`
- Get single message: `conversation_id = :cid AND seq = :seq`

**GSI** (optional, for message_id lookup):
- GSI1PK: `message_id`
- GSI1SK: `conversation_id`

---

### Redis Data Structures

#### 1. Connection Registry
```
Key: presence:user:{user_id}
Type: Set
Value: ["gateway-1:conn-abc", "gateway-2:conn-xyz"]
TTL: 60 seconds (refreshed by heartbeat)
```

#### 2. Gateway Pub/Sub Channels
```
Channel: gateway:{gateway_id}:channel
Type: Pub/Sub
Purpose: Fanout worker publishes pointer events here
```

#### 3. Membership Cache
```
Key: members:conversation:{conversation_id}
Type: Set
Value: ["user-1", "user-2", "user-3", ...]
TTL: 30-60 seconds
```

#### 4. Online Presence
```
Key: online:user:{user_id}
Type: String
Value: "1" (or timestamp)
TTL: 60 seconds
```

---

## Kafka Topics (Confluent Platform)

**Infrastructure**: Kafka 7.5.0 + Zookeeper (Confluent Platform)  
**Brokers**:
- Internal (containers): `kafka:9093`
- External (host): `localhost:9092`

### Topic: `message.new`

**Partitions**: 3  
**Replication Factor**: 1  
**Partition Key**: `conversation_id` (ensures ordering per conversation)

**Event Schema**:
```json
{
  "conversation_id": "c123",
  "message_id": "m789",
  "seq": 98765,
  "sender_id": "u42",
  "created_at": "2026-01-07T12:34:56Z",
  "preview": "first 200 chars...",
  "has_more": true
}
```

**Producer**: Message Service  
**Consumer**: Fanout Worker (consumer group: `fanout-workers`)

### Topic: `message.fanout`

**Partitions**: 3  
**Replication Factor**: 1  
**Purpose**: Reserved for future use (additional fanout patterns)

---

## Message Ordering Strategy

### Problem
With multiple Message Service instances, how do we guarantee strict message ordering?

### Solution: Centralized Sequence Allocation

1. **Chat Service maintains `conversations.last_seq`** (PostgreSQL)
2. When Message Service receives a new message:
   ```
   seq = await chatService.allocateSeq(conversation_id)
   // Chat Service does: UPDATE conversations SET last_seq = last_seq + 1 WHERE id = ? RETURNING last_seq
   ```
3. Message Service uses `seq` to write to DynamoDB
4. DynamoDB Sort Key on `seq` ensures strict ordering

**Why this works**:
- PostgreSQL atomic increment guarantees no duplicate seq
- Single source of truth for ordering
- No distributed counter complexity
- Clean separation: Chat Service owns conversation metadata

**Trade-off**:
- Extra network hop for seq allocation
- Chat Service becomes bottleneck (but stateless, can scale)

**Optimization (post-MVP)**:
- Co-locate seq allocation in Message Service with its own counter store
- Use Redis INCR for faster allocation

---

## Real-Time Flow (Pointer-Based)

### Option A: Pointer + Preview (MVP Choice)

**Why**:
- WebSocket payload is tiny (200 chars max)
- Scales to 100,000 char messages without blowing up WS
- Clients can lazy-load full body only when needed

**Flow**:
```
1. User A sends message (5,000 chars) to Chat Service
2. Message Service:
   - Allocates seq from Chat Service
   - Stores full body in DynamoDB
   - Extracts first 200 chars as preview
   - Emits Kafka event with preview
3. Fanout Worker:
   - Reads Kafka event
   - Finds User B is online (Redis lookup)
   - Publishes pointer to User B's gateway
4. Gateway:
   - Pushes pointer to User B's WebSocket
5. User B's client:
   - Renders preview (200 chars) + "Read more" button
   - If clicked: GET /messages/{id}?fields=full
```

**Benefits**:
- Consistent WS payload size
- No memory bloat on gateway
- Natural UX for long messages

---

## Client-Side Behavior

### Conversation List
```
GET /api/chats/conversations
Response:
[
  {
    "conversation_id": "c123",
    "type": "GROUP",
    "title": "Team Chat",
    "last_message_at": "2026-01-07T12:34:56Z",
    "last_preview": "Hey everyone, let's meet at...",
    "last_has_more": true,
    "unread_count": 5
  }
]
```

### Message History (Infinite Scroll)
```
GET /api/messages/conversations/c123/messages?after_seq=0&limit=50
Response:
{
  "messages": [
    {
      "message_id": "m1",
      "seq": 1,
      "sender_id": "u1",
      "preview": "Hello world",
      "has_more": false,
      "created_at": "2026-01-07T10:00:00Z"
    },
    {
      "message_id": "m2",
      "seq": 2,
      "sender_id": "u2",
      "preview": "This is a very long message that exceeds 200 characters so we truncate it here and show a read more button to the user when they want to expand...",
      "has_more": true,
      "created_at": "2026-01-07T10:05:00Z"
    }
  ],
  "has_more": true,
  "next_seq": 3
}
```

### Full Message Load
```
GET /api/messages/conversations/c123/messages/m2?fields=full
Response:
{
  "message_id": "m2",
  "seq": 2,
  "sender_id": "u2",
  "body": "This is a very long message that exceeds 200 characters so we truncate it here and show a read more button to the user when they want to expand. Here is the rest of the message content that was not visible in the preview...",
  "created_at": "2026-01-07T10:05:00Z"
}
```

### UX Rules
- Default: Render preview only
- If `has_more === true`: Show "Read more" button
- On "Read more" click: Fetch full body and expand inline
- Scrolling loads preview-only batches (cheap)
- On reconnect: Fetch messages `after_seq = last_seen_seq`

---

## Authentication Flow

### Login
```
POST /api/users/auth/login
Body: { "email": "user@example.com", "password": "secret" }

Response:
{
  "access_token": "eyJhbGc...",  // JWT, expires in 15 min
  "refresh_token": "abc123...",  // expires in 7 days
  "user": {
    "user_id": "u42",
    "email": "user@example.com",
    "username": "john_doe"
  }
}
```

### Socket.IO Auth
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost/ws', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  autoConnect: false
});

// Connect and authenticate
socket.connect();
socket.emit('authenticate', { token: access_token });

// Listen for authentication response
socket.on('authenticated', ({ userId }) => {
  console.log('Connected as:', userId);
});

socket.on('error', ({ message }) => {
  console.error('Auth failed:', message);
  socket.disconnect();
});

// Listen for new messages
socket.on('message:new', (data) => {
  console.log('New message:', data);
});
```

### Token Refresh
```
POST /api/users/auth/refresh
Body: { "refresh_token": "abc123..." }

Response:
{
  "access_token": "eyJhbGc...",  // new JWT
  "refresh_token": "xyz789..."   // new refresh token
}
```

---

## Multi-Instance Coordination

### Challenge
User A connects to Gateway-1, User B connects to Gateway-2. How does message from A reach B?

### Solution: Redis Pub/Sub

```
1. Fanout Worker determines User B is online
2. Fanout Worker reads from Redis: presence:user:B → ["gateway-2:conn-xyz"]
3. Fanout Worker publishes to Redis channel: gateway:gateway-2:channel
4. Gateway-2 subscribes to gateway:gateway-2:channel
5. Gateway-2 receives event and pushes to User B's WebSocket connection
```

**Why Redis Pub/Sub**:
- Low latency (sub-millisecond)
- Built-in pattern for this exact use case
- Scales horizontally with Redis Cluster
- Industry standard (used by Slack, Discord)

---

## Docker Compose Architecture

### Docker Compose Profiles

The deployment uses **profiles** for flexible service management:

- **`infra`**: Core infrastructure (Postgres, Redis, LocalStack, Kafka, Zookeeper)
- **`apps`**: Backend microservices (user, chat, message, gateway, fanout-worker)
- **`edge`**: Nginx load balancer
- **`ui`**: React frontend
- **`obs`**: Observability stack (Grafana, Loki, Promtail)

**Deployment Commands**:
```bash
# Full stack with observability
docker-compose --profile infra --profile apps --profile edge --profile ui --profile obs up --build

# Backend only (for frontend development)
docker-compose --profile infra --profile apps --profile edge up

# UI profile (automatically includes apps + edge)
docker-compose --profile infra --profile ui up --build

# Scale services
docker-compose --profile infra --profile apps --profile edge up --scale message-service=3 --scale gateway=2
```

### Service Configuration

**See `docker-compose.yml` for complete configuration.**

**Key Services**:
- **Infrastructure**: postgres, redis, localstack (DynamoDB), kafka, zookeeper
- **Backend**: user-service, chat-service, message-service, gateway, fanout-worker
- **Edge**: nginx (load balancer with CORS)
- **Frontend**: React app (Nginx serves production build)
- **Observability**: loki, promtail, grafana (optional)

**Key Features**:
- Health checks on all infrastructure services
- Auto-initialization scripts (DynamoDB tables, Kafka topics)
- Migrations run automatically via Postgres initdb
- Docker network: `chat-network`
- All services scalable via `--scale` flag

### nginx Configuration

**See `nginx.conf` for complete configuration.**

**Key Features**:
- **CORS headers** for all API routes (supports http://localhost:3000)
- **Socket.IO routing** at `/ws/socket.io` with proper upgrade handling
- **Docker DNS resolver** (127.0.0.11) for service discovery
- **Load balancing** for all backend services (automatic with `--scale`)
- **Sticky sessions** via `ip_hash` (commented out, recommended when scaling gateway for efficiency)
- **Long timeouts** for WebSocket connections (86400s)
- **Health check** endpoint at `/health`

---

## Testing Strategy

### Unit Tests
- Service layer logic (message validation, seq allocation)
- Repository/DAO methods
- Utility functions

**Tools**: Jest, @nestjs/testing

### Integration Tests
- REST API endpoints with real PostgreSQL
- DynamoDB operations with LocalStack
- Kafka producer/consumer with LocalStack
- Redis pub/sub

**Tools**: Supertest, TestContainers (or LocalStack)

### End-to-End Test (Critical)

**Scenario**: Multi-instance message delivery

```
Given:
  - User A connects to Gateway-1
  - User B connects to Gateway-2
  - Both in conversation C

When:
  - User A sends message "Hello B" to conversation C

Then:
  1. Message stored in DynamoDB with correct seq
  2. Kafka event produced to message.created topic
  3. Fanout Worker consumes event
  4. User B receives pointer event via Gateway-2 WebSocket
  5. User B fetches history and sees message in correct order
  6. User B clicks "Read more" and sees full body
```

**Tools**: Jest, WebSocket client, Docker Compose

---

## Development Workflow

### 1. Start Infrastructure
```bash
docker-compose up -d postgres redis localstack
```

### 2. Initialize Databases (Development)
```bash
# Run migrations
npm run migrate:up

# Create DynamoDB table in LocalStack
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name messages \
  --attribute-definitions \
    AttributeName=conversation_id,AttributeType=S \
    AttributeName=seq,AttributeType=N \
  --key-schema \
    AttributeName=conversation_id,KeyType=HASH \
    AttributeName=seq,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

### 3. Start Services Locally (Development)
```bash
# Terminal 1
cd services/user-service && npm run start:dev

# Terminal 2
cd services/chat-service && npm run start:dev

# Terminal 3
cd services/message-service && npm run start:dev

# Terminal 4
cd services/realtime-gateway && npm run start:dev

# Terminal 5
cd services/fanout-worker && npm run start:dev
```

### 4. Start Frontend (optional - separate testing)
Frontend is also part of docker-compose; use below to test frontend separately:
```bash
cd frontend && npm start
```

### 5. Full Docker Deployment

**All services with observability:**
```bash
docker-compose --profile infra --profile apps --profile edge --profile ui --profile obs up --build
```

**Backend only (for frontend development):**
```bash
docker-compose --profile infra --profile apps --profile edge up
```

**UI stack (auto-includes apps + edge):**
```bash
docker-compose --profile infra --profile ui up --build
```

**Scale services:**
```bash
docker-compose --profile infra --profile ui up --scale message-service=3 --scale gateway=2
# Note: Recommended to enable nginx ip_hash for gateway when scaling > 1 (for efficiency)
```

**Stop and cleanup:**
```bash
docker-compose down
docker-compose down -v  # Remove volumes too
```

---

## Trade-offs & Limitations (MVP)

### Acknowledged Trade-offs

1. **Seq Allocation Network Hop**
   - Extra call to Chat Service for seq allocation
   - can optimize later with Redis INCR

2. **No Message Edit/Delete**
   - Simplifies ordering and event sourcing
   - Add post-MVP with tombstone/edit events

3. **Preview Truncation at 200 chars**
   - Fixed length, doesn't account for word boundaries
   - Improve later with smart truncation (word-aware)

4. **No Push Notifications**
   - Offline users miss messages until they reconnect
   - Add APNs/FCM integration post-MVP

5. **Single Postgres Instance**
   - No replication or sharding
   - Production would use managed RDS with read replicas

6. **LocalStack + Confluent Kafka**
   - Using Confluent Kafka instead of LocalStack MSK for better stability
   - LocalStack only provides DynamoDB (not production-grade)
   - Kafka + Zookeeper run as separate containers
   - Good enough for local development and testing

7. **No E2E Encryption**
   - Messages stored in plaintext
   - Add Signal Protocol or similar post-MVP

### Performance Considerations

- **DynamoDB Query Cost**: Fetching 200 messages per scroll is cheap (single query)
- **Redis Memory**: Connection registry for 50M users = ~5GB (100 bytes per entry)
- **Kafka Throughput**: 60B messages/day = ~700K msgs/sec peak (needs partitioning strategy)
- **WebSocket Connections**: 1M concurrent = ~10GB RAM across gateways (10KB per conn)

---

## Folder Structure

```
chat-system/
├── docker-compose.yml
├── nginx.conf
├── README.md
├── services/
│   ├── user-service/
│   │   ├── src/
│   │   ├── test/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── chat-service/
│   │   ├── src/
│   │   ├── test/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── message-service/
│   │   ├── src/
│   │   ├── test/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── realtime-gateway/
│   │   ├── src/
│   │   ├── test/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── fanout-worker/
│       ├── src/
│       ├── test/
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
├── frontend/
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── migrations/
│   └── 001_initial_schema.sql
└── scripts/
    ├── init-localstack.sh
    └── seed-data.sh
```
---

## References

- [System Design Interview Vol 2 - Chat System](https://www.amazon.com/System-Design-Interview-Insiders-Guide/dp/1736049119)
- [NestJS WebSocket Documentation](https://docs.nestjs.com/websockets/gateways)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Kafka Documentation](https://kafka.apache.org/documentation/)

---

