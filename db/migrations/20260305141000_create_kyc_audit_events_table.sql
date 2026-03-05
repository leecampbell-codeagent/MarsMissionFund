-- migrate:up
BEGIN;

CREATE TABLE IF NOT EXISTS kyc_audit_events (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_clerk_user_id  TEXT        NOT NULL,
  action               TEXT        NOT NULL
                                   CHECK (action IN ('kyc.status.change')),
  previous_status      TEXT
                                   CHECK (previous_status IS NULL OR previous_status IN (
                                     'not_started',
                                     'pending',
                                     'in_review',
                                     'verified',
                                     'rejected',
                                     'expired'
                                   )),
  new_status           TEXT        NOT NULL
                                   CHECK (new_status IN (
                                     'not_started',
                                     'pending',
                                     'in_review',
                                     'verified',
                                     'rejected',
                                     'expired'
                                   )),
  trigger_reason       TEXT,
  metadata             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_audit_events_user_id   ON kyc_audit_events(user_id);
CREATE INDEX idx_kyc_audit_events_created_at ON kyc_audit_events(created_at);

COMMIT;

-- migrate:down
BEGIN;

DROP INDEX IF EXISTS idx_kyc_audit_events_created_at;
DROP INDEX IF EXISTS idx_kyc_audit_events_user_id;
DROP TABLE IF EXISTS kyc_audit_events;

COMMIT;
