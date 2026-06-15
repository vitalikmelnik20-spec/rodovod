ALTER TABLE trees ADD COLUMN IF NOT EXISTS invite_code VARCHAR(8);
UPDATE trees SET invite_code = UPPER(SUBSTRING(MD5(id::TEXT || NOW()::TEXT), 1, 6)) WHERE invite_code IS NULL;
ALTER TABLE trees ALTER COLUMN invite_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trees_invite_code_idx ON trees(invite_code);
