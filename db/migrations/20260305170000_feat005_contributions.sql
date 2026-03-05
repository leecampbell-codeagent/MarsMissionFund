-- migrate:up
BEGIN;

-- ─── 1. Add funding progress columns to campaigns ────────────────────────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS total_raised_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contributor_count  INTEGER NOT NULL DEFAULT 0;

-- CHECK constraint: cannot be negative
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_total_raised_cents_non_negative
    CHECK (total_raised_cents >= 0),
  ADD CONSTRAINT campaigns_contributor_count_non_negative
    CHECK (contributor_count >= 0);

-- ─── 2. contributions table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contributions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  campaign_id       UUID          NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  amount_cents      BIGINT        NOT NULL,
  payment_token     VARCHAR(500)  NOT NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'pending_capture',
  transaction_ref   VARCHAR(500)  NULL,
  failure_reason    VARCHAR(500)  NULL,
  idempotency_key   VARCHAR(255)  NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT contributions_amount_cents_positive
    CHECK (amount_cents > 0),
  CONSTRAINT contributions_status_values
    CHECK (status IN ('pending_capture', 'captured', 'failed')),
  CONSTRAINT contributions_idempotency_key_unique
    UNIQUE (idempotency_key)  -- partial unique index below handles NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contributions_donor_user_id
  ON contributions (donor_user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_campaign_id
  ON contributions (campaign_id);
-- Composite index to support duplicate-detection window query
CREATE INDEX IF NOT EXISTS idx_contributions_duplicate_check
  ON contributions (donor_user_id, campaign_id, amount_cents, created_at DESC)
  WHERE status != 'failed';

-- Auto-update trigger for updated_at
CREATE TRIGGER contributions_updated_at_trigger
  BEFORE UPDATE ON contributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 3. escrow_ledger table ──────────────────────────────────────────────────
-- Append-only — NO updated_at. Never DELETE or UPDATE rows.
CREATE TABLE IF NOT EXISTS escrow_ledger (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID          NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  contribution_id       UUID          NOT NULL REFERENCES contributions(id) ON DELETE RESTRICT,
  entry_type            VARCHAR(20)   NOT NULL,
  amount_cents          BIGINT        NOT NULL,
  running_balance_cents BIGINT        NOT NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT escrow_ledger_entry_type_values
    CHECK (entry_type IN ('credit')),    -- 'debit' added when feat-006 disbursements implemented
  CONSTRAINT escrow_ledger_amount_cents_positive
    CHECK (amount_cents > 0),
  CONSTRAINT escrow_ledger_running_balance_non_negative
    CHECK (running_balance_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_escrow_ledger_campaign_id
  ON escrow_ledger (campaign_id);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_contribution_id
  ON escrow_ledger (contribution_id);

-- ─── 4. contribution_audit_events table ─────────────────────────────────────
-- Append-only — NO updated_at. Immutable audit trail.
CREATE TABLE IF NOT EXISTS contribution_audit_events (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id  UUID         NOT NULL REFERENCES contributions(id) ON DELETE RESTRICT,
  campaign_id      UUID         NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  donor_user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_status  VARCHAR(20)  NULL,
  new_status       VARCHAR(20)  NOT NULL,
  amount_cents     BIGINT       NOT NULL,
  event_type       VARCHAR(50)  NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT contribution_audit_events_new_status_values
    CHECK (new_status IN ('pending_capture', 'captured', 'failed')),
  CONSTRAINT contribution_audit_events_event_type_values
    CHECK (event_type IN ('contribution.created', 'contribution.captured', 'contribution.failed'))
);

CREATE INDEX IF NOT EXISTS idx_contribution_audit_events_contribution_id
  ON contribution_audit_events (contribution_id);
CREATE INDEX IF NOT EXISTS idx_contribution_audit_events_campaign_id
  ON contribution_audit_events (campaign_id);
CREATE INDEX IF NOT EXISTS idx_contribution_audit_events_donor_user_id
  ON contribution_audit_events (donor_user_id);

COMMIT;

-- migrate:down
BEGIN;
DROP TABLE IF EXISTS contribution_audit_events;
DROP TABLE IF EXISTS escrow_ledger;
DROP TABLE IF EXISTS contributions;
ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_contributor_count_non_negative,
  DROP CONSTRAINT IF EXISTS campaigns_total_raised_cents_non_negative,
  DROP COLUMN IF EXISTS contributor_count,
  DROP COLUMN IF EXISTS total_raised_cents;
COMMIT;
