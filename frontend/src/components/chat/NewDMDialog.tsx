import React, { useState } from 'react';
import { UserSearch } from './UserSearch';
import { chatService } from '../../services/api';
import './Dialog.css';

interface User {
  user_id: string;
  username: string;
  email: string;
}

interface NewDMDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewDMDialog: React.FC<NewDMDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setError(null);
  };

  const handleCreate = async () => {
    if (!selectedUser) return;

    setIsCreating(true);
    setError(null);

    try {
      await chatService.createDM(selectedUser.user_id);
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create conversation');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedUser(null);
    setError(null);
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>New Direct Message</h2>
          <button className="dialog-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="dialog-body">
          <UserSearch
            onSelect={handleUserSelect}
            selectedIds={selectedUser ? [selectedUser.user_id] : []}
            placeholder="Search for a user to message..."
          />

          {selectedUser && (
            <div className="selected-user">
              <strong>Starting conversation with:</strong> {selectedUser.username}
            </div>
          )}

          {error && <div className="dialog-error">{error}</div>}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={handleClose} disabled={isCreating}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!selectedUser || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create DM'}
          </button>
        </div>
      </div>
    </div>
  );
};
