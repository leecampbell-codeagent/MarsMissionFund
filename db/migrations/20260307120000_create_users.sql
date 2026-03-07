-- migrate:up

CREATE TABLE IF NOT EXISTS users (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id             VARCHAR(255) NOT NULL UNIQUE,
    email                VARCHAR(255) NOT NULL UNIQUE,
    display_name         VARCHAR(255),
    avatar_url           VARCHAR(500),
    bio                  TEXT,
    roles                TEXT[]       NOT NULL DEFAULT '{backer}',
    kyc_status           VARCHAR(50)  NOT NULL DEFAULT 'not_verified',
    onboarding_completed BOOLEAN      NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_users_kyc_status CHECK (
        kyc_status IN ('not_verified', 'pending', 'in_review', 'verified', 'failed', 'expired')
    )
);

CREATE INDEX idx_users_clerk_id ON users (clerk_id);
CREATE INDEX idx_users_email ON users (email);

-- update_updated_at_column() is defined in 20260305120000_add_updated_at_trigger.sql
-- Do NOT redefine it here.
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- migrate:down

DROP TABLE IF EXISTS users;
