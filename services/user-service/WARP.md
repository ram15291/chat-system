# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Service Overview

This is the **User Service** - one of five microservices in the real-time chat system. It handles authentication, user management, and JWT token lifecycle.

**Part of the larger chat-system architecture:**
- **user-service** (this service) - Authentication & user management
- chat-service - Conversation management, memberships, invites
- message-service - Message storage & retrieval via DynamoDB
- realtime-gateway - WebSocket connections for real-time delivery
- fanout-worker - Kafka event processing & message routing

## Development Commands

### Setup & Installation
```powershell
# Install dependencies
npm install

# Run database migrations (from root chat-system/)
docker exec -i chat-postgres psql -U chatuser -d chatdb < migrations/001_initial_schema.sql
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

# Unit tests with coverage
npm run test:cov

# Watch mode for development
npm run test:watch

# Integration/E2E tests
npm run test:e2e
```

### Code Quality
```powershell
# Linting (check)
npm run lint

# Linting (fix)
npm run lint -- --fix

# Format code (if prettier configured)
npm run format
```

## Architecture Context

### Technology Stack
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL (via `DATABASE_URL` environment variable)
- **Cache**: Redis (via `REDIS_URL` environment variable)
- **Auth**: JWT tokens (access token: 15 min expiry, refresh token: 7 days)
- **Password Hashing**: bcrypt

### API Endpoints (Expected)
This service exposes endpoints under `/api/users`:
- `POST /auth/login` - User authentication, returns JWT access & refresh tokens
- `POST /auth/refresh` - Refresh access token using refresh token
- `POST /auth/logout` - Invalidate refresh token
- `GET /me` - Get current authenticated user info

### Dependencies & Integration
- **PostgreSQL**: Stores user accounts, credentials
- **Redis**: Caches active sessions, blacklists revoked tokens
- **Other Services**: This is a foundational service - other microservices validate JWTs issued by user-service

### Environment Configuration
Required environment variables (see `docker-compose.yml` in root for full list):
```
PORT=3001
DATABASE_URL=postgresql://chatuser:chatpass@localhost:5432/chatdb
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
```

For local development, create `.env` file with these variables.

## Infrastructure Setup

### Prerequisites for Development
1. Docker & Docker Compose running
2. PostgreSQL, Redis, and LocalStack containers running:
   ```powershell
   docker-compose up -d postgres redis localstack
   ```
3. LocalStack initialized (DynamoDB tables, Kafka topics):
   ```bash
   # On Windows, run AWS CLI commands from scripts/init-localstack.sh manually
   ```

### Database Access
```powershell
# Connect to PostgreSQL
docker exec -it chat-postgres psql -U chatuser -d chatdb

# Check database status
docker-compose ps postgres
```

### Docker Operations
```powershell
# View service logs
docker-compose logs -f user-service-1

# Rebuild and restart this service
docker-compose up -d --build user-service-1

# Run entire system
docker-compose up -d --build

# Clean slate (remove volumes)
docker-compose down -v
```

## Key Design Patterns

### Authentication Flow
1. User logs in with credentials → validate against PostgreSQL
2. Generate JWT access token (short-lived) + refresh token (long-lived)
3. Store refresh token in Redis with user ID mapping
4. Return both tokens to client
5. Client uses access token for API calls (Bearer token in Authorization header)
6. On access token expiry, client uses refresh token to get new access token
7. On logout, blacklist refresh token in Redis

### Security Considerations
- All passwords must be hashed with bcrypt before storage
- JWT_SECRET must be kept secure and consistent across service instances
- Validate all user input to prevent injection attacks
- WebSocket connections in realtime-gateway will use JWTs from this service

### Multi-Instance Support
This service is designed to be horizontally scalable:
- Stateless: no in-memory session storage
- Shared state via PostgreSQL (user data) and Redis (token blacklist)
- Multiple instances can run behind nginx load balancer

## Testing Strategy

### Unit Tests
Focus on:
- Authentication logic (login, token generation)
- Password hashing and validation
- Token refresh logic
- Input validation and error handling

### E2E Tests
Test complete auth flow:
1. User registration (if implemented)
2. Login → receive tokens
3. Access protected endpoint with access token
4. Refresh access token using refresh token
5. Logout → verify token invalidation

### Integration Points to Mock
When testing in isolation, mock:
- PostgreSQL queries (use test database or mocks)
- Redis operations
- External HTTP calls to other services

## Common Development Tasks

### Adding New Endpoints
1. Create/update DTOs in `src/dto/` with validation decorators
2. Add controller method in `src/auth/auth.controller.ts` (or similar)
3. Implement business logic in service layer
4. Add guards for JWT validation if endpoint is protected
5. Write unit tests for new logic
6. Update API documentation/contracts

### Working with Database
- Use TypeORM or Prisma (check package.json for ORM)
- Migrations should be created in `../../migrations/` directory (PostgreSQL shared across services)
- Always use parameterized queries to prevent SQL injection

### Token Management
- Access tokens should contain: `user_id`, `username`, `exp` (expiry)
- Refresh tokens should be stored in Redis with TTL matching expiry
- On token refresh, optionally rotate the refresh token for security

## Project-Specific Rules

### Code Organization (NestJS)
- Controllers: Handle HTTP requests, validation
- Services: Business logic
- Guards: Authentication/authorization checks
- DTOs: Data transfer objects with class-validator decorators
- Entities: Database models

### Error Handling
- Use NestJS built-in exception filters
- Return appropriate HTTP status codes (401 for unauthorized, 403 for forbidden, etc.)
- Log errors but don't expose sensitive details in API responses

### Secrets & Configuration
- NEVER commit JWT_SECRET or database credentials
- Use environment variables for all configuration
- Reference variables via process.env or ConfigService in NestJS

## Related Documentation
- Main system README: `../../README.md`
- Database schema: `../../migrations/001_initial_schema.sql`
- Docker configuration: `../../docker-compose.yml`
- nginx load balancer: `../../nginx.conf`
