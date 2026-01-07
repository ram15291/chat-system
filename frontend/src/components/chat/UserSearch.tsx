import React, { useState, useEffect } from 'react';
import { authService } from '../../services/api';
import './UserSearch.css';

interface User {
  user_id: string;
  username: string;
  email: string;
}

interface UserSearchProps {
  onSelect: (user: User) => void;
  selectedIds?: string[];
  placeholder?: string;
}

export const UserSearch: React.FC<UserSearchProps> = ({
  onSelect,
  selectedIds = [],
  placeholder = 'Search users by username or email...',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const users = await authService.searchUsers(query);
        setResults(users);
      } catch (error) {
        console.error('Failed to search users:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  return (
    <div className="user-search">
      <input
        type="text"
        className="user-search-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {isSearching && <div className="user-search-loading">Searching...</div>}
      {results.length > 0 && (
        <div className="user-search-results">
          {results.map((user) => (
            <div
              key={user.user_id}
              className={`user-search-item ${
                selectedIds.includes(user.user_id) ? 'selected' : ''
              }`}
              onClick={() => onSelect(user)}
            >
              <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <div className="user-username">{user.username}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && !isSearching && results.length === 0 && (
        <div className="user-search-empty">No users found</div>
      )}
    </div>
  );
};
