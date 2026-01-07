import React from 'react';
import { Message, Member } from '../../types';

interface Props {
  messages: Message[];
  currentUserId: string;
  isGroupChat?: boolean;
  members: Map<string, Member>;
  hasMore: boolean;
  onLoadMore: () => void;
  onLoadFullMessage: (messageId: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const MessageList: React.FC<Props> = ({
  messages,
  currentUserId,
  isGroupChat = false,
  members,
  hasMore,
  onLoadMore,
  onLoadFullMessage,
  messagesEndRef,
}) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (messages.length === 0) {
    return (
      <div className="message-list">
        <div className="empty-messages">
          <p>No messages yet</p>
          <small>Send a message to start the conversation</small>
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {hasMore && (
        <div className="load-more-container">
          <button onClick={onLoadMore} className="load-more-btn">
            Load more messages
          </button>
        </div>
      )}
      
      {messages.map((message) => {
        // If sender_id is missing, treat as other user's message (safest default)
        const isOwnMessage = message.sender_id ? message.sender_id === currentUserId : false;
        const displayText = message.full_body || message.preview;
        
        // Get member info for avatar
        const member = message.sender_id ? members.get(message.sender_id) : null;
        const avatarText = member?.username
          ? member.username.substring(0, 2).toUpperCase() 
          : message.sender_id 
            ? message.sender_id.substring(0, 2).toUpperCase() 
            : '?';
        
        return (
          <div
            key={message.message_id}
            className={`message-item ${isOwnMessage ? 'own-message' : 'other-message'}`}
          >
            {/* Show avatar for group chat messages from others */}
            {isGroupChat && !isOwnMessage && (
              <div className="message-avatar" title={member?.username || message.sender_id}>
                {avatarText}
              </div>
            )}
            <div className="message-bubble">
              <div className="message-text">{displayText}</div>
              <div className="message-footer">
                <span className="message-time">{formatTime(message.created_at)}</span>
                {message.has_more && !message.full_body && (
                  <button
                    onClick={() => onLoadFullMessage(message.message_id)}
                    className="load-full-btn"
                  >
                    Load full message
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      
      <div ref={messagesEndRef} />
    </div>
  );
};
