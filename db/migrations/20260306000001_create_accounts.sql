-- migrate:up
CREATE TABLE IF NOT EXISTS users (
  id               UUID        NOT NULL,
  clerk_id         TEXT        NOT NULL,
  email            TEXT        NOT NULL,
  display_name     TEXT        NULL,
  avatar_url       TEXT        NULL,
  bio              TEXT        NULL,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  account_status   TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_clerk_id_unique UNIQUE (clerk_id),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_account_status_check CHECK (
    account_status IN ('pending_verification', 'active', 'suspended', 'deactivated', 'deleted')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_id ON users (clerk_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- migrate:down
DROP TABLE IF EXISTS users CASCADE;
