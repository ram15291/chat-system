# Message Service - WARP Documentation

## Service Overview

The message-service is a critical microservice in the chat system that handles message persistence, retrieval, and event publishing. It uses DynamoDB for message storage, PostgreSQL for read state tracking, and Kafka for real-time event streaming.

## Core Responsibilities

1. **Message Storage**: Store messages in DynamoDB with conversation_id + seq composite key
2. **Sequence Allocation**: Coordinate with chat-service to allocate monotonic sequence numbers
3. **Event Publishing**: Publish message.new events to Kafka for WebSocket delivery
4. **Read Tracking**: Maintain read state per user per conversation in PostgreSQL
5. **Message Retrieval**: Serve message history with pagination and on-demand full message body

## Architecture Patterns

### Sequence Number Coordination

The service does NOT generate sequence numbers itself. Instead, it:
1. Receives a send message request
2. Calls chat-service `/conversations/:id/allocate-seq` with auth token
3. Chat-service verifies membership and atomically increments conversation.last_seq
4. Returns allocated sequence number
5. Message-service stores message with that sequence number

This pattern ensures:
- Total ordering within a conversation
- No race conditions between multiple senders
- Membership verification before message storage
- Atomic sequence allocation

### Message Preview Pattern

Messages are stored with two representations:
- **Preview**: First 200 characters (always returned in list endpoints)
- **Body**: Full message content (only returned on explicit request)

Benefits:
- Reduces bandwidth for message history endpoints
- Faster initial load times
- Client can request full body only when needed (e.g., user clicks "show more")

### Read State Management

Read state is tracked separately in PostgreSQL:
- Composite PK: (user_id, conversation_id)
- Stores last_read_seq
- Updates only if new seq > existing seq (monotonic)
- Used for unread badge calculations (in notification-service)

## Key Technologies

- **NestJS**: Framework with dependency injection, modules, decorators
- **DynamoDB**: NoSQL database for message storage
  - AWS SDK v3 (@aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb)
  - Document client for simplified CRUD operations
- **PostgreSQL**: Relational database for read state
  - TypeORM for entity management and migrations
- **Kafka**: Event streaming via kafkajs
  - Producer only (no consumers in this service)
- **JWT**: Token validation using passport-jwt

## Database Design

### DynamoDB Messages Table

```
Partition Key: conversation_id (enables queries per conversation)
Sort Key: seq (enables range queries and ordering)

GSI: MessageIdIndex
- Partition Key: message_id
- Purpose: Lookup messages by ID for "Get Full Message" endpoint
```

**Query Patterns**:
1. Get messages after seq: Query by conversation_id where seq > N
2. Get message by ID: Query GSI by message_id
3. Get message by conversation + seq: Direct get by composite key

### PostgreSQL Reads Table

```sql
CREATE TABLE reads (
  user_id VARCHAR,
  conversation_id VARCHAR,
  last_read_seq INTEGER NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  PRIMARY KEY (user_id, conversation_id)
);
```

**Query Pattern**: Single lookup by (user_id, conversation_id)

## Service Dependencies

### Upstream Dependencies (services this service calls)

1. **chat-service**
   - Endpoint: POST `/conversations/:id/allocate-seq`
   - Purpose: Allocate sequence number and verify membership
   - Auth: Forwards client JWT token
   - Configured via: `CHAT_SERVICE_URL` environment variable

### Downstream Dependencies (services that call this service)

1. **WebSocket Service** (future)
   - Consumes Kafka message.new events
   - Delivers messages to connected clients in real-time

2. **API Gateway / Client Applications**
   - Call REST endpoints to send/retrieve messages
   - Authenticated via JWT tokens from user-service

### Infrastructure Dependencies

1. **DynamoDB** (via LocalStack for dev)
   - Endpoint: `AWS_ENDPOINT` (http://localhost:4566 for LocalStack)
   - Table: Configured via `DYNAMODB_TABLE` (default: Messages)
   - Credentials: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

2. **Kafka** (via LocalStack for dev)
   - Brokers: `KAFKA_BROKERS` (localhost:9092 for LocalStack)
   - Client ID: `KAFKA_CLIENT_ID` (message-service)
   - Topic: message.new (auto-created by producer)

3. **PostgreSQL**
   - Database: `POSTGRES_DB` (chatdb)
   - Schema: reads table (auto-created via TypeORM synchronize)

## API Design

### Authentication
All endpoints (except /health) require JWT authentication:
```
Authorization: Bearer <token>
```

Token payload must contain:
- `sub`: User ID
- `email`: User email

### Endpoint Structure

Base path: `/api/messages`

Pattern: `/conversations/:id/...`
- Consistent with chat-service naming
- Conversation ID is primary resource identifier

### Error Responses

The service returns standard HTTP status codes:
- 400: Bad Request (validation errors, sequence allocation failure)
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (not a member, from chat-service)
- 404: Not Found (conversation or message doesn't exist)
- 500: Internal Server Error (DynamoDB/Kafka/PostgreSQL failures)

## Message Flow Sequence

**Send Message Flow**:
```
Client → message-service: POST /conversations/123/messages
  ↓
message-service → chat-service: POST /conversations/123/allocate-seq
  ↓
chat-service: Verify membership, increment seq atomically
  ↓
chat-service → message-service: { seq: 42 }
  ↓
message-service: Generate message_id (UUID v4)
  ↓
message-service → DynamoDB: PutItem (conversation_id=123, seq=42)
  ↓
message-service → Kafka: Publish message.new event
  ↓
message-service → Client: Return complete message
```

**Get Messages Flow**:
```
Client → message-service: GET /conversations/123/messages?after_seq=10&limit=50
  ↓
message-service → DynamoDB: Query (conversation_id=123, seq>10, limit=50)
  ↓
message-service: Map to preview-only format
  ↓
message-service → Client: Return message previews
```

## Configuration Management

Configuration is validated at startup using Joi schema.

Required variables:
- JWT_SECRET (must match user-service)
- POSTGRES_* (database connection)
- AWS_* (DynamoDB connection)
- KAFKA_* (Kafka connection)
- CHAT_SERVICE_URL (chat-service URL)

Default values:
- PORT: 3003
- NODE_ENV: development
- DYNAMODB_TABLE: Messages
- KAFKA_CLIENT_ID: message-service

Validation errors will prevent startup (fail-fast).

## Development Setup

### Prerequisites
1. PostgreSQL running on localhost:5432 (or configure POSTGRES_HOST)
2. LocalStack running on localhost:4566 (for DynamoDB and Kafka)
3. Chat-service running on localhost:3002
4. User-service running on localhost:3001 (for JWT validation)

### First-Time Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (.env file)

3. Start LocalStack and create DynamoDB table:
```bash
# See README.md for aws dynamodb create-table command
```

4. Start PostgreSQL:
```bash
docker compose up postgres -d
```

5. Run service:
```bash
npm run start:dev
```

The service will:
- Connect to PostgreSQL and auto-create reads table (TypeORM synchronize)
- Connect to DynamoDB (table must exist)
- Connect to Kafka (will auto-create message.new topic)
- Start HTTP server on port 3003

## Testing Strategy

### Unit Tests
- Test message service business logic in isolation
- Mock DynamoDB, Kafka, chat-service HTTP client
- Verify sequence allocation, preview generation, error handling

### E2E Tests
- Test full request/response cycle
- Use test database and LocalStack
- Verify JWT authentication
- Test pagination logic

### Manual Testing with curl

```bash
# 1. Get JWT token from user-service
TOKEN=$(curl -X POST http://localhost:3001/api/users/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.access_token')

# 2. Create a conversation (via chat-service)
CONV_ID=$(curl -X POST http://localhost:3002/api/chats/conversations/dm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participant_id":"other-user-id"}' \
  | jq -r '.id')

# 3. Send a message
curl -X POST http://localhost:3003/api/messages/conversations/$CONV_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Hello world!"}'

# 4. Get message history
curl -X GET "http://localhost:3003/api/messages/conversations/$CONV_ID/messages?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

## Common Development Tasks

### Adding a New Endpoint

1. Add DTO in `src/messages/dto/`
2. Add method to `MessagesService`
3. Add route to `MessagesController`
4. Add tests

### Modifying DynamoDB Schema

1. Update table creation script in README.md
2. Update DynamoDB service methods
3. Recreate table in LocalStack
4. Update interfaces in `src/messages/interfaces/`

### Adding a New Kafka Event

1. Add method to `KafkaService`
2. Call from `MessagesService` at appropriate point
3. Document event schema in README.md

## Production Considerations

### Database Configuration
- Set `synchronize: false` in TypeORM config
- Use migrations for schema changes
- Configure connection pooling

### DynamoDB
- Use on-demand billing or provision adequate capacity
- Monitor throttling and capacity metrics
- Consider enabling DynamoDB Streams for replication

### Kafka
- Configure producer retries and idempotence
- Monitor producer lag
- Use separate Kafka cluster from LocalStack

### Security
- Rotate JWT_SECRET regularly
- Use secrets manager for sensitive env vars
- Enable HTTPS/TLS for all communications
- Configure CORS restrictively

### Monitoring
- CloudWatch metrics for DynamoDB
- Application logs for errors
- Health check endpoint for load balancer
- Distributed tracing (e.g., OpenTelemetry)

## Troubleshooting

### "Failed to allocate sequence number"
- Check chat-service is running on CHAT_SERVICE_URL
- Verify JWT token is valid and not expired
- Check user is a member of the conversation

### DynamoDB connection errors
- Verify LocalStack is running (or AWS credentials for production)
- Check AWS_ENDPOINT is correct
- Verify Messages table exists

### Kafka connection errors
- Check Kafka broker is running on KAFKA_BROKERS
- Verify network connectivity to Kafka
- Check Kafka logs for authentication issues

### PostgreSQL connection errors
- Verify POSTGRES_* environment variables
- Check PostgreSQL is running and accepting connections
- Verify database exists (chatdb by default)

## File Organization

```
src/
├── auth/                 # JWT validation (shared pattern across services)
├── config/               # Environment configuration with Joi validation
├── dynamodb/             # DynamoDB client wrapper
├── kafka/                # Kafka producer wrapper
├── messages/             # Core domain logic
│   ├── dto/              # Request/response DTOs with validation
│   ├── interfaces/       # TypeScript interfaces for messages
│   ├── messages.controller.ts  # HTTP routes
│   ├── messages.service.ts     # Business logic
│   └── messages.module.ts      # NestJS module
├── reads/                # PostgreSQL read state entities
├── health/               # Health check endpoint
├── app.module.ts         # Root module
└── main.ts               # Application bootstrap
```

## Integration Points

### With chat-service
- REST API call for sequence allocation
- Passes through JWT token for authentication
- Handles 403/404 errors from chat-service

### With user-service
- Shares JWT_SECRET for token validation
- No direct HTTP communication
- JWT payload provides user_id

### With WebSocket service (future)
- Kafka message.new events
- WebSocket service subscribes to topic
- Delivers to connected clients

## Performance Characteristics

**Write Path**:
- Sequential: Chat-service call → DynamoDB write → Kafka publish
- Latency: ~50-100ms (depends on network)
- Bottleneck: Chat-service sequence allocation (single atomic operation)

**Read Path**:
- Single DynamoDB query for message history
- Latency: ~10-20ms
- Scalable via DynamoDB read capacity

**Read State Updates**:
- Single PostgreSQL upsert
- Latency: ~5-10ms
- Relatively low write volume

## Future Enhancements

1. **Message Reactions**
   - New DynamoDB GSI or separate table
   - Track reaction counts per message

2. **Message Edits**
   - Store edit history in DynamoDB
   - Add edited_at field
   - Publish message.edited event

3. **Rich Media**
   - S3 integration for attachments
   - Store S3 URLs in message body
   - Pre-signed URL generation

4. **Full-Text Search**
   - Elasticsearch integration
   - Index messages asynchronously via Kafka
   - Provide search API

5. **Read Receipts**
   - Real-time updates via WebSocket
   - Aggregate read state across users
   - Display "read by N users"
