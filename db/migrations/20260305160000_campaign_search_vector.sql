-- migrate:up
BEGIN;

-- 1. Add search_vector column for pre-computed full-text search tokens
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- 2. Backfill search_vector for existing rows
UPDATE campaigns
SET search_vector = to_tsvector(
  'english',
  COALESCE(title, '') || ' ' ||
  COALESCE(short_description, '') || ' ' ||
  COALESCE(description, '')
);

-- 3. GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_campaigns_search_vector
  ON campaigns USING GIN (search_vector);

-- 4. Index for "ending_soon" sort and filter
CREATE INDEX IF NOT EXISTS idx_campaigns_deadline
  ON campaigns (deadline)
  WHERE deadline IS NOT NULL;

-- 5. Index for "newest" sort
CREATE INDEX IF NOT EXISTS idx_campaigns_launched_at
  ON campaigns (launched_at)
  WHERE launched_at IS NOT NULL;

-- 6. Index for category browse and filter
CREATE INDEX IF NOT EXISTS idx_campaigns_category
  ON campaigns (category)
  WHERE category IS NOT NULL;

-- 7. Trigger function: auto-update search_vector on INSERT or UPDATE
CREATE OR REPLACE FUNCTION campaigns_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector(
    'english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.short_description, '') || ' ' ||
    COALESCE(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Attach trigger
DROP TRIGGER IF EXISTS campaigns_search_vector_trigger ON campaigns;
CREATE TRIGGER campaigns_search_vector_trigger
  BEFORE INSERT OR UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION campaigns_search_vector_update();

COMMIT;

-- migrate:down
BEGIN;
DROP TRIGGER IF EXISTS campaigns_search_vector_trigger ON campaigns;
DROP FUNCTION IF EXISTS campaigns_search_vector_update();
DROP INDEX IF EXISTS idx_campaigns_category;
DROP INDEX IF EXISTS idx_campaigns_launched_at;
DROP INDEX IF EXISTS idx_campaigns_deadline;
DROP INDEX IF EXISTS idx_campaigns_search_vector;
ALTER TABLE campaigns DROP COLUMN IF EXISTS search_vector;
COMMIT;
