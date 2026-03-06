-- migrate:up
BEGIN;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_step INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}';
COMMIT;

-- migrate:down
BEGIN;
ALTER TABLE users
  DROP COLUMN IF EXISTS onboarding_step,
  DROP COLUMN IF EXISTS notification_preferences;
COMMIT;
