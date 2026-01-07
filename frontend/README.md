# Chat System Frontend

React + TypeScript frontend for the real-time chat system.

## Features

- User authentication (login/register)
- Real-time messaging via WebSocket
- Conversation list
- Message history with infinite scroll
- Message preview (first 200 chars) + load full message on demand
- Responsive design

## Tech Stack

- React 18
- TypeScript
- Socket.IO Client (WebSocket)
- Axios (HTTP client)
- React Router (routing)

## Development

### Prerequisites

- Node.js 18+
- Backend services running (user-service, chat-service, message-service, realtime-gateway)

### Install Dependencies

```bash
npm install
```

### Configure Environment

Update `.env` file with your backend URLs:

```
REACT_APP_API_URL=http://localhost
REACT_APP_WS_URL=http://localhost:3004
```

### Start Development Server

```bash
npm start
```

The app will open at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── auth/          # Login and Register components
│   ├── chat/          # Chat UI components
│   └── common/        # Shared components (ProtectedRoute)
├── context/           # React Context (AuthContext)
├── services/          # API and WebSocket services
├── types/             # TypeScript type definitions
├── App.tsx            # Main app component with routing
└── index.tsx          # Entry point
```

## Key Components

### Authentication
- `Login.tsx` - User login form
- `Register.tsx` - User registration form
- `AuthContext.tsx` - Authentication state management

### Chat
- `ChatLayout.tsx` - Main chat layout with sidebar and message view
- `ConversationList.tsx` - List of user conversations
- `MessageView.tsx` - Message display and WebSocket integration
- `MessageList.tsx` - Individual message rendering
- `MessageInput.tsx` - Message composition and sending

### Services
- `api.ts` - REST API client with interceptors for auth
- `websocket.ts` - Socket.IO client for real-time updates

## Docker

Build and run with Docker:

```bash
docker build -t chat-frontend .
docker run -p 3000:80 chat-frontend
```

## Environment Variables

- `REACT_APP_API_URL` - Backend API base URL (default: `http://localhost`)
- `REACT_APP_WS_URL` - WebSocket gateway URL (default: `http://localhost:3004`)
