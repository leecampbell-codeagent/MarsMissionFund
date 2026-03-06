-- migrate:up
BEGIN;

-- Add CHECK constraint on onboarding_step (must be 1, 2, or 3 when not null)
ALTER TABLE users
  ADD CONSTRAINT chk_users_onboarding_step
    CHECK (onboarding_step IS NULL OR (onboarding_step >= 1 AND onboarding_step <= 3));

-- Add CHECK constraint on user_roles.role to enforce allowlist at DB layer
ALTER TABLE user_roles
  ADD CONSTRAINT chk_user_roles_role
    CHECK (role IN ('backer', 'creator', 'admin', 'moderator'));

COMMIT;

-- migrate:down
BEGIN;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_users_onboarding_step;

ALTER TABLE user_roles
  DROP CONSTRAINT IF EXISTS chk_user_roles_role;

COMMIT;
