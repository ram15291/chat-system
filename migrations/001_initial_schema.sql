-- Chat System - Initial Database Schema
-- Version: 001
-- Description: Create users, conversations, memberships, invites, and reads tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Conversations table
CREATE TABLE conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('DM', 'GROUP')),
  title VARCHAR(255), -- nullable for DMs
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Last message metadata (for conversation list)
  last_seq BIGINT DEFAULT 0,
  last_message_id VARCHAR(50),
  last_message_at TIMESTAMP,
  last_preview VARCHAR(200),
  last_has_more BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- Memberships table
CREATE TABLE memberships (
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP, -- nullable, null = active member
  
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_conversation_id ON memberships(conversation_id);
CREATE INDEX idx_memberships_active ON memberships(user_id, left_at) WHERE left_at IS NULL;

-- Invites table
CREATE TABLE invites (
  invite_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(user_id),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  UNIQUE(conversation_id, invited_user_id, status)
);

CREATE INDEX idx_invites_user ON invites(invited_user_id, status);
CREATE INDEX idx_invites_conversation ON invites(conversation_id);

-- Reads table (tracks last read message per conversation per user)
CREATE TABLE reads (
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  last_read_seq BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_reads_user_id ON reads(user_id);

-- Refresh tokens table (for JWT refresh token management)
CREATE TABLE refresh_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at) WHERE revoked = FALSE;
