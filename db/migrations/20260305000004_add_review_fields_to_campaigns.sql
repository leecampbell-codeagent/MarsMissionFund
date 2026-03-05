-- migrate:up
BEGIN;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS reviewer_id      UUID        REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_comment TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_campaigns_reviewer_id ON campaigns (reviewer_id);

COMMIT;

-- migrate:down

DROP INDEX IF EXISTS idx_campaigns_reviewer_id;

ALTER TABLE campaigns
  DROP COLUMN IF EXISTS reviewer_id,
  DROP COLUMN IF EXISTS reviewer_comment,
  DROP COLUMN IF EXISTS reviewed_at;
