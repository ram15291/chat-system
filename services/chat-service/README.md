# Chat Service

Conversation and membership management service for the real-time chat system.

## Overview

This service handles:
- DM (Direct Message) and GROUP conversation creation
- Membership management (ADMIN/MEMBER roles)
- Invites (create, accept, decline)
- Sequence number allocation for message ordering
- Conversation listing and member queries

## Tech Stack

- **Framework**: NestJS 10
- **Language**: TypeScript
- **Database**: PostgreSQL (via TypeORM)
- **Authentication**: JWT validation (tokens from user-service)
- **Validation**: class-validator

## Prerequisites

- Node.js 18+
- PostgreSQL running (via Docker or local)
- User-service running (for JWT token generation)

## Installation

```powershell
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```env
PORT=3002
NODE_ENV=development
DATABASE_URL=postgresql://chatuser:chatpass@localhost:5432/chatdb
REDIS_URL=redis://localhost:6379
MEMBERSHIP_CACHE_TTL=60
JWT_SECRET=dev-secret-key-change-in-production-12345
```

## Running the Service

### Development Mode
```powershell
npm run start:dev
```

### Production Mode
```powershell
npm run build
npm run start:prod
```

## API Endpoints

Base URL: `http://localhost:3002/api/chats`

### Health Check
- `GET /health` - Service health status

### Conversations (All require JWT authentication)

**Create DM:**
- `POST /conversations/dm`
  ```json
  {
    "other_user_id": "uuid"
  }
  ```
  - Returns existing DM if one already exists between the two users
  - Creates new DM if none exists

**Create Group:**
- `POST /conversations/group`
  ```json
  {
    "title": "My Group Chat",
    "member_ids": ["uuid1", "uuid2", ...] // Max 99 members (+ creator = 100)
  }
  ```
  - Creator becomes ADMIN
  - All other members become MEMBER role

**List User Conversations:**
- `GET /conversations`
  - Returns all conversations where user is an active member
  - Sorted by last message time (most recent first)

**Get Conversation Details:**
- `GET /conversations/:id`
  - Must be a member to access

**Get Conversation Members:**
- `GET /conversations/:id/members`
  - Returns list of active members with roles

**Allocate Sequence Number:**
- `POST /conversations/:id/allocate-seq`
  - Atomically allocates next sequence number for message ordering
  - Used by message-service before storing messages
  - Returns: `{ "seq": 123 }`

### Invites (GROUP conversations only)

**Create Invite:**
- `POST /conversations/:id/invite`
  ```json
  {
    "user_id": "uuid"
  }
  ```
  - Only works for GROUP conversations
  - Inviter must be a member
  - Invited user cannot already be a member
  - Group cannot exceed 100 members
  - Invites expire after 7 days

**Accept Invite:**
- `POST /conversations/invites/:inviteId/accept`
  - Creates membership as MEMBER role
  - Marks invite as ACCEPTED

**Decline Invite:**
- `POST /conversations/invites/:inviteId/decline`
  - Marks invite as DECLINED

**Get My Invites:**
- `GET /conversations/invites/my`
  - Returns all pending invites for current user

## Business Logic

### DM Creation
1. Validates users are different
2. Checks if DM already exists (exactly 2 members)
3. Creates conversation with type=DM (no title)
4. Creates memberships for both users (both MEMBER role)

### Group Creation
1. Validates member count (max 100 including creator)
2. Creates conversation with type=GROUP and title
3. Creates membership for creator as ADMIN
4. Creates memberships for all other users as MEMBER

### Sequence Allocation
- Uses PostgreSQL atomic increment: `UPDATE conversations SET last_seq = last_seq + 1 RETURNING last_seq`
- Ensures no duplicate sequence numbers across multiple message-service instances
- Critical for message ordering in conversations

### Membership Verification
- All conversation endpoints verify active membership (left_at IS NULL)
- Throws 403 Forbidden if user is not a member

### Invite Validation
- Checks conversation type (GROUP only)
- Validates inviter is member
- Prevents duplicate memberships
- Checks group capacity (100 max)
- Handles invite expiry (7 days)

## Database Schema

Uses tables from `../../migrations/001_initial_schema.sql`:

**conversations**
- conversation_id (PK)
- type (DM | GROUP)
- title (nullable for DMs)
- created_by
- last_seq (for message ordering)
- last_message metadata

**memberships**
- conversation_id, user_id (composite PK)
- role (ADMIN | MEMBER)
- joined_at
- left_at (NULL = active)

**invites**
- invite_id (PK)
- conversation_id
- invited_user_id
- invited_by
- status (PENDING | ACCEPTED | DECLINED | EXPIRED)
- expires_at

**reads**
- conversation_id, user_id (composite PK)
- last_read_seq
- updated_at

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3002 |
| NODE_ENV | Environment | development |
| DATABASE_URL | PostgreSQL connection | Required |
| REDIS_URL | Redis connection | Required |
| MEMBERSHIP_CACHE_TTL | Cache TTL in seconds | 60 |
| JWT_SECRET | JWT validation secret (must match user-service) | Required |

## Project Structure

```
src/
├── conversations/
│   ├── dto/                     # Request DTOs
│   ├── entities/               # TypeORM entities
│   ├── conversations.controller.ts
│   ├── conversations.service.ts
│   ├── invites.service.ts
│   └── conversations.module.ts
├── auth/
│   ├── jwt.strategy.ts         # JWT validation
│   └── jwt-auth.guard.ts
├── config/
│   ├── configuration.ts
│   └── validation.schema.ts
├── health/
│   └── health.controller.ts
├── app.module.ts
└── main.ts
```

## Integration with Other Services

### User Service
- Validates JWTs issued by user-service
- Uses same JWT_SECRET for token validation
- Extracts user_id from JWT payload

### Message Service
- Message-service calls `POST /conversations/:id/allocate-seq` before storing messages
- Sequence numbers ensure correct message ordering
- Updates last_message metadata in conversations table

### Realtime Gateway
- Uses membership data to determine who should receive real-time events
- Queries conversation members for fanout

## Development

### Linting
```powershell
npm run lint
```

### Format Code
```powershell
npm run format
```

## Testing

```powershell
npm test
npm run test:e2e
```

## Docker

```powershell
docker build -t chat-service .
docker run -p 3002:3002 --env-file .env chat-service
```

## License

MIT
