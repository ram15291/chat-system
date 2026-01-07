import React from 'react';
import { Conversation } from '../../types';

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  currentUserId?: string;
}

export const ConversationList: React.FC<Props> = ({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  currentUserId,
}) => {
  const getDisplayName = (conv: Conversation) => {
    if (conv.type === 'DM' && conv.members) {
      // Find the other user (not the current user)
      const otherMember = conv.members.find(m => m.user_id !== currentUserId);
      return otherMember?.username || 'Unknown User';
    }
    return conv.title || 'Group Chat';
  };
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (hours < 24 * 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className="conversation-list">
        <div className="loading-state">Loading conversations...</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="conversation-list">
        <div className="empty-conversations">
          <p>No conversations yet</p>
          <small>Start a new chat to begin</small>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map((conv) => (
        <div
          key={conv.conversation_id}
          className={`conversation-item ${selectedId === conv.conversation_id ? 'active' : ''}`}
          onClick={() => onSelect(conv.conversation_id)}
        >
          <div className="conversation-avatar">
            {getDisplayName(conv).charAt(0).toUpperCase()}
          </div>
          <div className="conversation-details">
            <div className="conversation-header">
              <span className="conversation-name">
                {getDisplayName(conv)}
              </span>
              {conv.last_message && (
                <span className="conversation-time">
                  {formatTime(conv.last_message.created_at)}
                </span>
              )}
            </div>
            {conv.last_message && (
              <div className="conversation-preview">
                {conv.last_message.preview}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
