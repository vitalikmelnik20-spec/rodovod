-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (Telegram accounts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  username VARCHAR(255),
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trees (родовідні дерева)
CREATE TABLE IF NOT EXISTS trees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_by BIGINT NOT NULL REFERENCES users(telegram_id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tree members (учасники дерева)
CREATE TABLE IF NOT EXISTS tree_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL REFERENCES users(telegram_id),
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected')),
  invited_by BIGINT REFERENCES users(telegram_id),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tree_id, telegram_user_id)
);

-- Persons (записи людей у дереві)
CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  patronymic VARCHAR(255),
  birth_date DATE,
  death_date DATE,
  birth_place VARCHAR(500),
  living_place VARCHAR(500),
  biography TEXT,
  avatar_url TEXT,
  is_alive BOOLEAN DEFAULT TRUE,
  telegram_user_id BIGINT REFERENCES users(telegram_id),
  tags JSONB DEFAULT '[]',
  created_by BIGINT NOT NULL REFERENCES users(telegram_id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Relationships (зв'язки між людьми)
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  person_a_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person_b_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  relation_type VARCHAR(30) NOT NULL CHECK (relation_type IN ('parent_child', 'spouse', 'adoption', 'other')),
  marriage_date DATE,
  divorce_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT no_self_relation CHECK (person_a_id != person_b_id)
);

-- Media (медіа-файли)
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('photo', 'video', 'audio', 'document')),
  url TEXT NOT NULL,
  title VARCHAR(500),
  description TEXT,
  is_avatar BOOLEAN DEFAULT FALSE,
  uploaded_by BIGINT NOT NULL REFERENCES users(telegram_id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Change history (журнал змін)
CREATE TABLE IF NOT EXISTS change_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('person', 'relationship', 'media')),
  entity_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  changed_by BIGINT NOT NULL REFERENCES users(telegram_id),
  diff JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  reverted_at TIMESTAMP
);

-- Events (події часової шкали)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('birth', 'death', 'marriage', 'other')),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_date DATE,
  media_ids JSONB DEFAULT '[]',
  created_by BIGINT NOT NULL REFERENCES users(telegram_id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Family chat (чат родини)
CREATE TABLE IF NOT EXISTS family_chat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(telegram_id),
  message TEXT,
  media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Memory board (дошка пам'яті)
CREATE TABLE IF NOT EXISTS memory_board (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(telegram_id),
  content TEXT,
  media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Invite links
CREATE TABLE IF NOT EXISTS invite_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(telegram_id),
  expires_at TIMESTAMP,
  used_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log (адмін-дії)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID REFERENCES trees(id) ON DELETE SET NULL,
  user_id BIGINT NOT NULL REFERENCES users(telegram_id),
  action VARCHAR(100) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_persons_tree_id ON persons(tree_id);
CREATE INDEX IF NOT EXISTS idx_relationships_tree_id ON relationships(tree_id);
CREATE INDEX IF NOT EXISTS idx_relationships_person_a ON relationships(person_a_id);
CREATE INDEX IF NOT EXISTS idx_relationships_person_b ON relationships(person_b_id);
CREATE INDEX IF NOT EXISTS idx_tree_members_tree_id ON tree_members(tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_members_user ON tree_members(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_media_person_id ON media(person_id);
CREATE INDEX IF NOT EXISTS idx_change_history_tree ON change_history(tree_id);
CREATE INDEX IF NOT EXISTS idx_events_tree_id ON events(tree_id);
CREATE INDEX IF NOT EXISTS idx_family_chat_tree_id ON family_chat(tree_id);
CREATE INDEX IF NOT EXISTS idx_memory_board_person ON memory_board(person_id);
