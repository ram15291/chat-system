import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, MessageNewEvent, Conversation, Member } from '../../types';
import { messageService, chatService } from '../../services/api';
import { wsService } from '../../services/websocket';
import { useAuth } from '../../context/AuthContext';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

interface Props {
  conversationId: string;
  conversation?: Conversation;
}

export const MessageView: React.FC<Props> = ({ conversationId, conversation }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [members, setMembers] = useState<Map<string, Member>>(new Map());
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await messageService.getMessages(conversationId, undefined, 50);
      setMessages(data.reverse()); // Reverse to show oldest first
      setHasMore(data.length === 50);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const loadMembers = useCallback(async () => {
    try {
      const membersList = await chatService.getMembers(conversationId);
      const membersMap = new Map<string, Member>();
      membersList.forEach(member => {
        membersMap.set(member.user_id, member);
      });
      setMembers(membersMap);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
    loadMembers();
    
    // Subscribe to real-time messages
    const unsubscribe = wsService.onMessage((event: MessageNewEvent) => {
      if (event.conversation_id === conversationId) {
        handleNewMessage(event);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [conversationId, loadMessages, loadMembers]);

  const loadMoreMessages = async () => {
    if (!hasMore || messages.length === 0) return;

    const oldestSeq = Math.min(...messages.map(m => m.seq));
    
    try {
      const data = await messageService.getMessages(conversationId, oldestSeq, 50);
      if (data.length > 0) {
        setMessages((prev) => [...data.reverse(), ...prev]);
        setHasMore(data.length === 50);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    }
  };

  const handleNewMessage = (event: MessageNewEvent) => {
    const newMessage: Message = {
      message_id: event.message_id,
      conversation_id: event.conversation_id,
      sender_id: event.sender_id,
      seq: event.seq,
      preview: event.preview,
      created_at: event.created_at,
      has_more: false,
    };

    setMessages((prev) => {
      // Check if message already exists
      if (prev.some(m => m.message_id === newMessage.message_id)) {
        return prev;
      }
      return [...prev, newMessage];
    });

    // Scroll to bottom for new messages
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (body: string) => {
    try {
      const newMessage = await messageService.sendMessage(conversationId, body);
      
      // Add optimistically if not already added by WebSocket
      setMessages((prev) => {
        if (prev.some(m => m.message_id === newMessage.message_id)) {
          return prev;
        }
        return [...prev, newMessage];
      });

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  const handleLoadFullMessage = async (messageId: string) => {
    try {
      const fullMessage = await messageService.getMessageFull(conversationId, messageId);
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.message_id === messageId
            ? { ...msg, full_body: fullMessage.full_body, has_more: false }
            : msg
        )
      );
    } catch (error) {
      console.error('Failed to load full message:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="message-view">
        <div className="loading-state">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="message-view">
      <MessageList
        messages={messages}
        currentUserId={user?.id || ''}
        isGroupChat={conversation?.type === 'GROUP'}
        members={members}
        hasMore={hasMore}
        onLoadMore={loadMoreMessages}
        onLoadFullMessage={handleLoadFullMessage}
        messagesEndRef={messagesEndRef}
      />
      <MessageInput onSend={handleSendMessage} />
    </div>
  );
};
