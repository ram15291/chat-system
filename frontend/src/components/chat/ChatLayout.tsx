import React, { useState, useEffect } from 'react';
import { ConversationList } from './ConversationList';
import { MessageView } from './MessageView';
import { NewDMDialog } from './NewDMDialog';
import { NewGroupDialog } from './NewGroupDialog';
import { Conversation } from '../../types';
import { chatService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './Chat.css';

export const ChatLayout: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewDMDialog, setShowNewDMDialog] = useState(false);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await chatService.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversation(conversationId);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleConversationCreated = () => {
    loadConversations();
  };

  return (
    <div className="chat-layout">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <div className="user-info">
            <div className="user-avatar">{user?.username.charAt(0).toUpperCase()}</div>
            <span className="user-name">{user?.username}</span>
          </div>
          <div className="header-actions">
            <div className="new-chat-container">
              <button
                onClick={() => setShowNewMenu(!showNewMenu)}
                className="new-chat-btn"
                title="New Chat"
              >
                ✎
              </button>
              {showNewMenu && (
                <div className="new-chat-menu">
                  <button
                    onClick={() => {
                      setShowNewDMDialog(true);
                      setShowNewMenu(false);
                    }}
                  >
                    New Direct Message
                  </button>
                  <button
                    onClick={() => {
                      setShowNewGroupDialog(true);
                      setShowNewMenu(false);
                    }}
                  >
                    New Group Chat
                  </button>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="logout-btn" title="Logout">
              ⎋
            </button>
          </div>
        </div>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation}
          onSelect={handleConversationSelect}
          isLoading={isLoading}
        />
      </div>
      <div className="chat-main">
        {selectedConversation ? (
          <MessageView 
            conversationId={selectedConversation}
            conversation={conversations.find(c => c.conversation_id === selectedConversation)}
          />
        ) : (
          <div className="empty-state">
            <h2>Welcome to Chat!</h2>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>

      <NewDMDialog
        isOpen={showNewDMDialog}
        onClose={() => setShowNewDMDialog(false)}
        onSuccess={handleConversationCreated}
      />
      <NewGroupDialog
        isOpen={showNewGroupDialog}
        onClose={() => setShowNewGroupDialog(false)}
        onSuccess={handleConversationCreated}
      />
    </div>
  );
};
