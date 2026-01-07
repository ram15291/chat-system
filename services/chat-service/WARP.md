# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Service Overview

This is the **Chat Service** - one of five microservices in the real-time chat system. It handles conversation management, memberships, and invites.

**Part of the larger chat-system architecture:**
- user-service - Authentication & user management
- **chat-service** (this service) - Conversation management, memberships, invites
- message-service - Message storage & retrieval via DynamoDB
- realtime-gateway - WebSocket connections for real-time delivery
- fanout-worker - Kafka event processing & message routing

## Development Commands

### Setup & Installation
```powershell
# Install dependencies
npm install
```

### Running the Service
```powershell
# Development mode with hot-reload
npm run start:dev

# Production build
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

### Testing
```powershell
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Code Quality
```powershell
# Linting
npm run lint
npm run lint -- --fix

# Format code
npm run format
```

## Architecture Context

### Technology Stack
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL (via TypeORM)
- **Auth**: JWT validation (tokens from user-service)
- **Port**: 3002
- **API Prefix**: /api/chats

### Key Responsibilities
1. **Conversation Management**: Create DMs and GROUP chats
2. **Membership Control**: ADMIN/MEMBER roles, join/leave tracking
3. **Invite System**: GROUP invites with 7-day expiry
4. **Sequence Allocation**: Atomic sequence number allocation for message ordering

### API Endpoints
- `POST /conversations/dm` - Create/get DM
- `POST /conversations/group` - Create group (max 100 members)
- `GET /conversations` - List user's conversations
- `GET /conversations/:id/members` - Get members
- `POST /conversations/:id/allocate-seq` - Allocate sequence number (critical for message ordering)
- `POST /conversations/:id/invite` - Invite user to group
- `POST /conversations/invites/:id/accept` - Accept invite

### Database Schema
Four main tables (all in shared PostgreSQL):
- **conversations**: conversation_id, type (DM|GROUP), title, last_seq
- **memberships**: conversation_id + user_id (PK), role, left_at (NULL = active)
- **invites**: invite_id, conversation_id, invited_user_id, status, expires_at
- **reads**: conversation_id + user_id (PK), last_read_seq

### Environment Configuration
```env
PORT=3002
DATABASE_URL=postgresql://chatuser:chatpass@localhost:5432/chatdb
REDIS_URL=redis://localhost:6379
MEMBERSHIP_CACHE_TTL=60
JWT_SECRET=dev-secret-key-change-in-production-12345
```

## Key Design Patterns

### Sequence Number Allocation
The most critical function - ensures message ordering:
```typescript
// Atomic increment using PostgreSQL
UPDATE conversations SET last_seq = last_seq + 1 WHERE conversation_id = :id RETURNING last_seq
```
- Message-service calls this BEFORE storing message
- Guarantees no duplicate sequence numbers
- Enables correct ordering even with multiple message-service instances

### Membership Verification
All endpoints verify active membership:
- Check `left_at IS NULL` to ensure user is active member
- Throw 403 Forbidden if not a member
- Used extensively in ConversationsService.verifyMembership()

### DM Deduplication
When creating DM:
1. Check if DM already exists between two users
2. A DM has type='DM' and exactly 2 active members
3. Return existing DM instead of creating duplicate

### Group Capacity Enforcement
- Max 100 members per group
- Validated on group creation
- Checked before accepting invites
- Creator counts as 1 of the 100

### Invite Expiry
- Invites expire after 7 days
- Status changes: PENDING → ACCEPTED/DECLINED/EXPIRED
- Expired invites cannot be accepted

## Integration Points

### With User Service
- Validates JWTs from user-service
- Must use same JWT_SECRET
- Extracts user_id from JWT payload for authorization

### With Message Service
- Message-service calls `/conversations/:id/allocate-seq`
- Returns next sequence number for the message
- Message-service then stores message with that seq in DynamoDB

### With Realtime Gateway & Fanout Worker
- They query conversation members to determine delivery targets
- Uses memberships table to find all active members (left_at IS NULL)

## Common Development Tasks

### Adding New Conversation Type
1. Update ConversationType enum in conversation.entity.ts
2. Add validation logic in ConversationsService
3. Update conversation creation endpoints
4. Consider membership rules for new type

### Modifying Membership Roles
1. Update MembershipRole enum in membership.entity.ts
2. Add role-based authorization checks
3. Update guards if needed for role-specific actions

### Changing Group Capacity Limit
- Search for "100" in codebase
- Update validations in: CreateGroupDto, ConversationsService.createGroup, InvitesService.createInvite

### Adding New Invite Status
1. Update InviteStatus enum in invite.entity.ts
2. Add status transition logic in InvitesService
3. Update status validation in accept/decline methods

## Testing Strategy

### Unit Tests
Focus on:
- ConversationsService business logic (DM deduplication, member validation)
- InvitesService validation (expiry, capacity, permissions)
- Sequence allocation (mock atomic increment)

### E2E Tests
Test complete flows:
1. Create DM → verify both users are members
2. Create group → verify creator is ADMIN, others are MEMBER
3. Invite flow → create invite → accept → verify membership
4. Sequence allocation → verify atomic increment

## Error Handling

### Common Errors
- **403 Forbidden**: User not a member of conversation
- **404 Not Found**: Conversation or invite doesn't exist
- **400 Bad Request**: Invalid input (e.g., DM with yourself, group >100 members)
- **409 Conflict**: Resource already exists (e.g., user already a member)

### Security Considerations
- All endpoints require JWT authentication (except /health)
- Membership verification on every conversation access
- Invite validation ensures only invited user can accept
- Group capacity enforced at multiple levels

## Database Operations

### Atomic Operations
- Sequence allocation uses PostgreSQL RETURNING clause
- Ensures consistency across multiple instances

### Soft Deletes
- Memberships use `left_at` timestamp instead of hard deletes
- Enables history tracking and analytics
- Active members have `left_at IS NULL`

### Indexes
Critical for performance:
- idx_memberships_user_id - for listing user's conversations
- idx_memberships_active - for finding active members
- idx_invites_user - for finding user's pending invites

## Related Documentation
- Main system README: `../../README.md`
- Database schema: `../../migrations/001_initial_schema.sql`
- Docker configuration: `../../docker-compose.yml`
- User service: `../user-service/`
