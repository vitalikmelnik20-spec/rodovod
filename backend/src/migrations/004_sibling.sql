-- Add sibling relation type
ALTER TABLE relationships DROP CONSTRAINT IF EXISTS relationships_relation_type_check;
ALTER TABLE relationships ADD CONSTRAINT relationships_relation_type_check
  CHECK (relation_type IN ('parent_child', 'spouse', 'adoption', 'sibling', 'other'));
