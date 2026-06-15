-- Section 6: add max_uses to invite_links for invite limits
ALTER TABLE invite_links ADD COLUMN IF NOT EXISTS max_uses INTEGER;
