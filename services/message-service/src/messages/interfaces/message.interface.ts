export interface Message {
  conversation_id: string;
  seq: number;
  message_id: string;
  sender_id: string;
  created_at: string;
  body: string;
  preview: string;
  has_more: boolean;
}

export interface MessagePreview {
  conversation_id: string;
  seq: number;
  message_id: string;
  sender_id: string;
  created_at: string;
  preview: string;
  has_more: boolean;
}
