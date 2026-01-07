import React, { useState } from 'react';

interface Props {
  onSend: (body: string) => Promise<void>;
}

export const MessageInput: React.FC<Props> = ({ onSend }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isSending) {
      return;
    }

    setIsSending(true);
    
    try {
      await onSend(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="message-input">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type a message..."
        disabled={isSending}
        rows={1}
      />
      <button type="submit" disabled={!message.trim() || isSending} className="send-btn">
        {isSending ? '...' : '➤'}
      </button>
    </form>
  );
};
