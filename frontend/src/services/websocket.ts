import { io, Socket } from 'socket.io-client';
import { MessageNewEvent } from '../types';

interface ConversationNewEvent {
  conversation_id: string;
  type: 'DM' | 'GROUP';
  title?: string;
  members?: Array<{ user_id: string; username: string }>;
  created_by: string;
  created_at: string;
}

// ✅ Prefer NGINX/frontdoor by default (http://localhost)
// Set REACT_APP_WS_URL=http://localhost to override if needed
const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost';

class WebSocketService {
  private socket: Socket | null = null;
  private messageHandlers: Array<(event: MessageNewEvent) => void> = [];
  private conversationHandlers: Array<(event: ConversationNewEvent) => void> = [];
  private connectionHandlers: Array<(connected: boolean) => void> = [];

  // Optional: keep the latest token so reconnects work consistently
  private token: string | null = null;

  connect(token: string) {
    this.token = token;

    console.log(
      'WebSocket connect() called. URL:',
      WS_URL,
      'token:',
      token?.substring(0, 20) + '...'
    );

    // If already connected, do nothing
    if (this.socket?.connected) {
      console.log('WebSocket already connected:', this.socket.id);
      return;
    }

    // If a socket exists but is in weird state, clean it up
    if (this.socket && !this.socket.connected) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch (_) {}
      this.socket = null;
    }

    // ✅ Create socket connection through NGINX with the correct path
    // ✅ Send token via "auth" only (avoid leaking token in query logs)
    // ✅ Force websocket first for debugging; once stable, you can add polling back.
    console.log('Creating socket.io connection to:', WS_URL);
    this.socket = io(WS_URL, {
      path: '/ws/socket.io',
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // --- Core lifecycle logs ---
    this.socket.on('connect', () => {
      console.log('WebSocket connected. socketId=', this.socket?.id);
      this.connectionHandlers.forEach((handler) => handler(true));
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('WebSocket disconnected. reason=', reason);
      this.connectionHandlers.forEach((handler) => handler(false));
    });

    // 🔥 Most important: see WHY connect is failing
    this.socket.on('connect_error', (err: any) => {
      console.error('WebSocket connect_error:', err?.message || err, err);
    });

    // Socket-level errors
    this.socket.on('error', (err: any) => {
      console.error('WebSocket error event:', err?.message || err, err);
    });

    // Manager-level logs (helpful when proxy breaks polling/upgrade)
    this.socket.io.on('reconnect_attempt', (n) => {
      console.log('WebSocket reconnect_attempt:', n);
    });

    this.socket.io.on('reconnect', (n) => {
      console.log('WebSocket reconnected after attempts:', n);
    });

    this.socket.io.on('reconnect_error', (err) => {
      console.error('WebSocket reconnect_error:', err);
    });

    this.socket.io.on('error', (err) => {
      console.error('WebSocket manager error:', err);
    });

    // --- App events ---
    this.socket.on('connected', (data) => {
      console.log('Connected to gateway:', data);
    });

    this.socket.on('message.new', (data: MessageNewEvent) => {
      console.log('Received message.new:', data);
      this.messageHandlers.forEach((handler) => handler(data));
    });

    this.socket.on('conversation.new', (data: ConversationNewEvent) => {
      console.log('Received conversation.new:', data);
      this.conversationHandlers.forEach((handler) => handler(data));
    });

    this.socket.on('pong', (data) => {
      console.log('Pong received:', data);
    });
  }

  /**
   * Enable polling after you've confirmed websocket works end-to-end.
   * Call this once your nginx config is correct and connect is stable.
   */
  enablePollingTransport() {
    if (!this.token) {
      console.warn('enablePollingTransport() called but no token available');
      return;
    }
    console.log('Reconnecting with websocket + polling transports enabled...');

    this.disconnect();
    this.socket = io(WS_URL, {
      path: '/ws/socket.io',
      auth: { token: this.token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch (_) {}
      this.socket = null;
    }
  }

  onMessage(handler: (event: MessageNewEvent) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onConversation(handler: (event: ConversationNewEvent) => void) {
    this.conversationHandlers.push(handler);
    return () => {
      this.conversationHandlers = this.conversationHandlers.filter((h) => h !== handler);
    };
  }

  onConnectionChange(handler: (connected: boolean) => void) {
    this.connectionHandlers.push(handler);
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter((h) => h !== handler);
    };
  }

  ping() {
    if (this.socket?.connected) {
      this.socket.emit('ping');
    } else {
      console.warn('ping() called but socket not connected');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const wsService = new WebSocketService();
export default wsService;
