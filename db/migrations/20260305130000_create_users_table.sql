-- migrate:up
BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id        TEXT        NOT NULL UNIQUE,
  email                TEXT        NOT NULL,
  display_name         TEXT,
  bio                  TEXT,
  avatar_url           TEXT,
  account_status       TEXT        NOT NULL DEFAULT 'pending_verification'
                                   CHECK (account_status IN (
                                     'pending_verification',
                                     'active',
                                     'suspended',
                                     'deactivated'
                                   )),
  onboarding_completed BOOLEAN     NOT NULL DEFAULT FALSE,
  onboarding_step      TEXT
                                   CHECK (onboarding_step IS NULL OR onboarding_step IN (
                                     'role_selection',
                                     'profiling',
                                     'notifications',
                                     'complete'
                                   )),
  roles                TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  notification_prefs   JSONB       NOT NULL DEFAULT '{
    "campaign_updates": true,
    "milestone_completions": true,
    "contribution_confirmations": true,
    "recommendations": true,
    "security_alerts": true,
    "platform_announcements": false
  }'::JSONB,
  kyc_status           TEXT        NOT NULL DEFAULT 'not_started'
                                   CHECK (kyc_status IN (
                                     'not_started',
                                     'pending',
                                     'in_review',
                                     'verified',
                                     'failed',
                                     'expired'
                                   )),
  last_seen_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_user_id ON users (clerk_user_id);
CREATE INDEX idx_users_email         ON users (email);
CREATE INDEX idx_users_account_status ON users (account_status);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP INDEX IF EXISTS idx_users_account_status;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_clerk_user_id;
DROP TABLE IF EXISTS users;

COMMIT;




























