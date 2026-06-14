-- Таблиця пропозицій змін від редакторів
CREATE TABLE IF NOT EXISTS change_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('person', 'relationship', 'media')),
  entity_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('update', 'delete')),
  proposed_by BIGINT NOT NULL REFERENCES users(telegram_id),
  diff JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by BIGINT REFERENCES users(telegram_id),
  reviewed_at TIMESTAMP,
  review_note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_tree ON change_proposals(tree_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON change_proposals(tree_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_entity ON change_proposals(entity_id);
