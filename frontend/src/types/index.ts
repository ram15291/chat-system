export interface User {
  user_id: string;
  id?: string; // Alias for user_id
  username: string;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface Conversation {
  conversation_id: string;
  id?: string; // Alias for conversation_id for convenience
  type: 'DM' | 'GROUP';
  title?: string | null;
  name?: string; // Computed from title
  created_at: string;
  members?: Member[]; // Only populated for DMs
  last_message?: {
    preview: string;
    created_at: string;
    sender_id: string;
  };
  last_message_at?: string;
}

export interface Message {
  message_id: string;
  conversation_id: string;
  sender_id?: string; // Optional for backward compatibility
  seq: number;
  preview: string;
  full_body?: string;
  created_at: string;
  has_more: boolean;
}

export interface Member {
  user_id: string;
  username: string;
  role: string;
}

export interface MessageNewEvent {
  conversation_id: string;
  message_id: string;
  seq: number;
  sender_id: string;
  created_at: string;
  preview: string;
}
