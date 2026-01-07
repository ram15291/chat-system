# User Service

User authentication and management service for the real-time chat system.

## Overview

This service handles:
- User registration
- JWT-based authentication (access & refresh tokens)
- Token refresh and revocation
- User profile management

## Tech Stack

- **Framework**: NestJS 10
- **Language**: TypeScript
- **Database**: PostgreSQL (via TypeORM)
- **Authentication**: JWT with Passport
- **Validation**: class-validator
- **Password Hashing**: bcrypt

## Prerequisites

- Node.js 18+
- PostgreSQL running (via Docker or local)
- Redis running (optional, for future caching)

## Installation

```powershell
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://chatuser:chatpass@localhost:5432/chatdb
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
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

### Debug Mode
```powershell
npm run start:debug
```

## Testing

### Unit Tests
```powershell
npm test
```

### E2E Tests
```powershell
npm run test:e2e
```

### Test Coverage
```powershell
npm run test:cov
```

## API Endpoints

Base URL: `http://localhost:3001/api/users`

### Health Check
- `GET /health` - Service health status

### Authentication (Public)
- `POST /auth/register` - Register new user
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "username": "optional"
  }
  ```

- `POST /auth/login` - Login
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

- `POST /auth/refresh` - Refresh access token
  ```json
  {
    "refresh_token": "your-refresh-token"
  }
  ```

### User Management (Protected)
- `GET /users/me` - Get current user profile (requires access token)
- `POST /auth/logout` - Logout (revoke refresh tokens)

## Docker

### Build Image
```powershell
docker build -t user-service .
```

### Run Container
```powershell
docker run -p 3001:3001 --env-file .env user-service
```

## Authentication Flow

1. **Register/Login** → Receive access token (15min) + refresh token (7 days)
2. **Use Access Token** → Include in `Authorization: Bearer <token>` header
3. **Token Expires** → Use refresh token to get new access token
4. **Logout** → Revoke refresh token in database

## Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens signed with HS256
- Refresh tokens stored hashed in database
- Input validation on all endpoints
- CORS enabled for cross-origin requests

## Database Schema

Uses tables from `../../migrations/001_initial_schema.sql`:
- `users` - User accounts
- `refresh_tokens` - Token management

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| NODE_ENV | Environment | development |
| DATABASE_URL | PostgreSQL connection string | Required |
| REDIS_URL | Redis connection string | Required |
| JWT_SECRET | JWT signing secret | Required |
| JWT_EXPIRES_IN | Access token expiry | 15m |
| REFRESH_TOKEN_EXPIRES_IN | Refresh token expiry | 7d |

## Project Structure

```
src/
├── auth/                   # Authentication module
│   ├── dto/               # Login, register DTOs
│   ├── guards/            # JWT guards
│   ├── strategies/        # Passport strategies
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── users/                 # Users module
│   ├── dto/
│   ├── entities/          # TypeORM entities
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
├── config/                # Configuration
├── health/                # Health check
├── app.module.ts
└── main.ts
```

## Development

### Linting
```powershell
npm run lint
```

### Format Code
```powershell
npm run format
```

## License

MIT
