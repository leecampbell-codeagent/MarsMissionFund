-- migrate:up
BEGIN;

ALTER TABLE accounts ADD COLUMN bio TEXT;
ALTER TABLE accounts ADD COLUMN avatar_url TEXT;
ALTER TABLE accounts ADD COLUMN onboarding_step TEXT NOT NULL DEFAULT 'welcome';
ALTER TABLE accounts ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{
  "campaign_updates": true,
  "milestone_completions": true,
  "contribution_confirmations": true,
  "new_campaign_recommendations": true,
  "security_alerts": true,
  "platform_announcements": false
}';

ALTER TABLE accounts ADD CONSTRAINT chk_accounts_onboarding_step CHECK (
  onboarding_step IN ('welcome', 'role_selection', 'profile', 'preferences', 'completed')
);

COMMIT;

-- migrate:down
BEGIN;

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS chk_accounts_onboarding_step;
ALTER TABLE accounts DROP COLUMN IF EXISTS notification_preferences;
ALTER TABLE accounts DROP COLUMN IF EXISTS onboarding_step;
ALTER TABLE accounts DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE accounts DROP COLUMN IF EXISTS bio;

COMMIT;
