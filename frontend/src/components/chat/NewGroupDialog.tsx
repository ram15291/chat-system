import React, { useState } from 'react';
import { UserSearch } from './UserSearch';
import { chatService } from '../../services/api';
import './Dialog.css';

interface User {
  user_id: string;
  username: string;
  email: string;
}

interface NewGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewGroupDialog: React.FC<NewGroupDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUserSelect = (user: User) => {
    const isSelected = selectedUsers.some((u) => u.user_id === user.user_id);
    
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter((u) => u.user_id !== user.user_id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
    setError(null);
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      setError('Please enter a group name and select at least one member');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await chatService.createGroup(
        groupName.trim(),
        selectedUsers.map((u) => u.user_id)
      );
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedUsers([]);
    setError(null);
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Create Group Chat</h2>
          <button className="dialog-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="dialog-body">
          <div className="form-group">
            <label htmlFor="group-name">Group Name</label>
            <input
              id="group-name"
              type="text"
              className="form-input"
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label>Add Members ({selectedUsers.length} selected)</label>
            <UserSearch
              onSelect={handleUserSelect}
              selectedIds={selectedUsers.map((u) => u.user_id)}
              placeholder="Search users to add..."
            />
          </div>

          {selectedUsers.length > 0 && (
            <div className="selected-users">
              {selectedUsers.map((user) => (
                <div key={user.user_id} className="selected-user-chip">
                  <span>{user.username}</span>
                  <button
                    className="chip-remove"
                    onClick={() => handleUserSelect(user)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
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
            disabled={!groupName.trim() || selectedUsers.length === 0 || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
};
