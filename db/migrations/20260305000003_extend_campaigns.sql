-- migrate:up

BEGIN;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS mars_alignment_statement TEXT,
  ADD COLUMN IF NOT EXISTS budget_breakdown         TEXT,
  ADD COLUMN IF NOT EXISTS team_info                TEXT,
  ADD COLUMN IF NOT EXISTS risk_disclosures         TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_url           TEXT;

COMMIT;

-- migrate:down

BEGIN;

ALTER TABLE campaigns
  DROP COLUMN IF EXISTS mars_alignment_statement,
  DROP COLUMN IF EXISTS budget_breakdown,
  DROP COLUMN IF EXISTS team_info,
  DROP COLUMN IF EXISTS risk_disclosures,
  DROP COLUMN IF EXISTS hero_image_url;

COMMIT;
