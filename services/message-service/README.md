# Message Service

Message service for the chat system. Handles message storage in DynamoDB, retrieval, and event publishing to Kafka.

## Overview

The message service is responsible for:
- Storing messages in DynamoDB with conversation_id + seq as composite key
- Allocating sequence numbers from chat-service for message ordering
- Publishing message.new events to Kafka for real-time delivery
- Managing read state in PostgreSQL
- Retrieving message history with pagination
- Providing full message body on demand

## Architecture

### Key Design Decisions

1. **DynamoDB for Message Storage**
   - Partition key: `conversation_id`
   - Sort key: `seq`
   - GSI on `message_id` for ID-based lookups
   - Enables efficient range queries for conversation history

2. **Sequence Number Allocation**
   - Calls chat-service `/conversations/:id/allocate-seq` before storing
   - Ensures total ordering of messages within a conversation
   - Prevents race conditions with atomic increment

3. **Message Preview**
   - Stores first 200 characters as preview
   - Full body stored but only returned on explicit request
   - Optimizes bandwidth for message list endpoints

4. **Read State Tracking**
   - Stored in PostgreSQL for relational queries
   - Composite primary key: (user_id, conversation_id)
   - Tracks last_read_seq per user per conversation

## Technology Stack

- **Framework**: NestJS
- **Database**: DynamoDB (messages), PostgreSQL (reads)
- **Event Streaming**: Kafka
- **Authentication**: JWT (validated from user-service)
- **AWS SDK**: @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb
- **Kafka Client**: kafkajs

## API Endpoints

Base URL: `http://localhost:3003/api/messages`

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Send Message

```http
POST /conversations/:id/messages
```

Request body:
```json
{
  "body": "Hello world! This is a message."
}
```

Response:
```json
{
  "conversation_id": "uuid",
  "seq": 5,
  "message_id": "uuid",
  "sender_id": "user-uuid",
  "created_at": "2024-01-01T00:00:00.000Z",
  "body": "Hello world! This is a message.",
  "preview": "Hello world! This is a message.",
  "has_more": false
}
```

**Business Logic**:
1. Validates JWT token
2. Calls chat-service to allocate sequence number (verifies membership)
3. Creates message_id (UUID v4)
4. Stores full message in DynamoDB
5. Publishes message.new event to Kafka
6. Returns complete message

### Get Message History

```http
GET /conversations/:id/messages?after_seq=10&limit=50
```

Query parameters:
- `after_seq` (optional): Return messages with seq > after_seq
- `limit` (optional, default=200, max=200): Number of messages to return

Response:
```json
[
  {
    "conversation_id": "uuid",
    "seq": 11,
    "message_id": "uuid",
    "sender_id": "user-uuid",
    "created_at": "2024-01-01T00:00:00.000Z",
    "preview": "First 200 characters of message...",
    "has_more": true
  }
]
```

**Note**: Returns preview only. Use Get Full Message endpoint for complete body.

### Get Full Message

```http
GET /conversations/:id/messages/:messageId?fields=full
```

Response:
```json
{
  "conversation_id": "uuid",
  "seq": 11,
  "message_id": "uuid",
  "sender_id": "user-uuid",
  "created_at": "2024-01-01T00:00:00.000Z",
  "body": "Full message body here...",
  "preview": "First 200 characters of message...",
  "has_more": true
}
```

### Update Read State

```http
POST /conversations/:id/read
```

Request body:
```json
{
  "last_read_seq": 15
}
```

Response:
```json
{
  "user_id": "user-uuid",
  "conversation_id": "uuid",
  "last_read_seq": 15,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

**Business Logic**:
- Updates only if new seq > existing seq
- Creates new record if none exists

### Get Read State

```http
GET /conversations/:id/read
```

Response:
```json
{
  "user_id": "user-uuid",
  "conversation_id": "uuid",
  "last_read_seq": 15,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "message-service"
}
```

## Environment Variables

```env
NODE_ENV=development
PORT=3003

# JWT Secret (shared with user-service)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# PostgreSQL (for reads table)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=chatuser
POSTGRES_PASSWORD=chatpass
POSTGRES_DB=chatdb

# DynamoDB (LocalStack)
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localhost:4566
DYNAMODB_TABLE=Messages
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Kafka (LocalStack)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=message-service
KAFKA_CONSUMER_GROUP=message-service-group

# Chat Service
CHAT_SERVICE_URL=http://localhost:3002/api/chats
```

## Database Schema

### DynamoDB Table: Messages

```
Table: Messages
Partition Key: conversation_id (String)
Sort Key: seq (Number)

Attributes:
- conversation_id: String
- seq: Number
- message_id: String (UUID)
- sender_id: String (UUID)
- created_at: String (ISO 8601)
- body: String (max 10,000 chars)
- preview: String (first 200 chars)
- has_more: Boolean

GSI: MessageIdIndex
- Partition Key: message_id
```

### PostgreSQL Table: reads

```sql
CREATE TABLE reads (
  user_id VARCHAR PRIMARY KEY,
  conversation_id VARCHAR PRIMARY KEY,
  last_read_seq INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Setup DynamoDB Table (LocalStack)

```bash
# Create Messages table
aws dynamodb create-table \
  --endpoint-url http://localhost:4566 \
  --table-name Messages \
  --attribute-definitions \
    AttributeName=conversation_id,AttributeType=S \
    AttributeName=seq,AttributeType=N \
    AttributeName=message_id,AttributeType=S \
  --key-schema \
    AttributeName=conversation_id,KeyType=HASH \
    AttributeName=seq,KeyType=RANGE \
  --global-secondary-indexes \
    '[{
      "IndexName": "MessageIdIndex",
      "KeySchema": [{"AttributeName":"message_id","KeyType":"HASH"}],
      "Projection": {"ProjectionType":"ALL"},
      "ProvisionedThroughput": {"ReadCapacityUnits":5,"WriteCapacityUnits":5}
    }]' \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-east-1

# Verify table
aws dynamodb list-tables --endpoint-url http://localhost:4566 --region us-east-1
```

## Installation

```bash
npm install
```

## Running the Service

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## Docker Build

```bash
docker build -t message-service:latest .
```

## Dependencies

- User-service: JWT validation (shared secret)
- Chat-service: Sequence number allocation, membership verification
- PostgreSQL: Read state storage
- DynamoDB (LocalStack): Message storage
- Kafka (LocalStack): Event publishing

## Message Flow

1. Client sends message via POST /conversations/:id/messages
2. Service validates JWT token
3. Service calls chat-service to allocate sequence number
   - Chat-service verifies user is a member
   - Chat-service atomically increments conversation.last_seq
4. Service generates message_id (UUID)
5. Service stores complete message in DynamoDB
6. Service publishes message.new event to Kafka
   - WebSocket service will consume this event
7. Service returns message to client

## Kafka Events

### message.new

Published when a new message is sent.

```json
{
  "conversation_id": "uuid",
  "seq": 5,
  "message_id": "uuid",
  "sender_id": "user-uuid",
  "created_at": "2024-01-01T00:00:00.000Z",
  "preview": "First 200 characters..."
}
```

Key: conversation_id (for topic partitioning)

## Error Handling

- 400: Invalid request body or sequence allocation failure
- 401: Unauthorized (invalid/missing JWT)
- 403: Not a member of conversation (from chat-service)
- 404: Conversation or message not found
- 500: Internal server error (DynamoDB/Kafka failure)

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Project Structure

```
src/
├── auth/                    # JWT authentication
│   ├── jwt.strategy.ts
│   └── jwt-auth.guard.ts
├── config/                  # Configuration
│   └── configuration.ts
├── dynamodb/                # DynamoDB client
│   ├── dynamodb.service.ts
│   └── dynamodb.module.ts
├── kafka/                   # Kafka producer
│   ├── kafka.service.ts
│   └── kafka.module.ts
├── messages/                # Core message logic
│   ├── dto/
│   │   ├── send-message.dto.ts
│   │   ├── get-messages.dto.ts
│   │   └── update-read.dto.ts
│   ├── interfaces/
│   │   └── message.interface.ts
│   ├── messages.controller.ts
│   ├── messages.service.ts
│   └── messages.module.ts
├── reads/                   # Read state entities
│   └── entities/
│       └── read.entity.ts
├── health/                  # Health check
│   └── health.controller.ts
├── app.module.ts
└── main.ts
```

## Performance Considerations

1. **DynamoDB Capacity**
   - Monitor read/write capacity units
   - Consider on-demand pricing for variable traffic
   - Use DAX for read caching if needed

2. **Message Size**
   - Current limit: 10,000 characters
   - Consider S3 for large messages/attachments
   - Preview optimization reduces bandwidth

3. **Kafka Throughput**
   - Partitioned by conversation_id for scalability
   - Consider batch size tuning
   - Monitor consumer lag

4. **PostgreSQL Reads Table**
   - Indexed on (user_id, conversation_id)
   - Consider read replicas for scale
   - Relatively low write volume

## Security

- JWT validation on all endpoints
- Membership verification via chat-service
- No direct database access from clients
- CORS enabled (configure for production)
- Secrets managed via environment variables

## Monitoring

Key metrics to monitor:
- DynamoDB read/write capacity
- Kafka producer lag
- Message send latency
- Error rates (400/403/404/500)
- Database connection pool

## Future Enhancements

- Message reactions
- Message edits/deletes
- Rich media attachments (S3 integration)
- Full-text search (Elasticsearch)
- Message encryption at rest
- Read receipts via WebSocket
