-- migrate:up
BEGIN;

CREATE TABLE IF NOT EXISTS campaign_audit_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID        NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  actor_user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_clerk_user_id TEXT        NOT NULL,
  action              TEXT        NOT NULL
                                  CHECK (action IN (
                                    'campaign.created',
                                    'campaign.updated',
                                    'campaign.submitted',
                                    'campaign.claimed',
                                    'campaign.approved',
                                    'campaign.rejected',
                                    'campaign.launched',
                                    'campaign.archived',
                                    'campaign.reassigned'
                                  )),
  previous_status     TEXT,
  new_status          TEXT        NOT NULL,
  rationale           TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_audit_campaign_id  ON campaign_audit_events (campaign_id);
CREATE INDEX idx_campaign_audit_created_at   ON campaign_audit_events (created_at);
CREATE INDEX idx_campaign_audit_actor_user_id ON campaign_audit_events (actor_user_id);

COMMIT;

-- migrate:down
BEGIN;

DROP INDEX IF EXISTS idx_campaign_audit_actor_user_id;
DROP INDEX IF EXISTS idx_campaign_audit_created_at;
DROP INDEX IF EXISTS idx_campaign_audit_campaign_id;
DROP TABLE IF EXISTS campaign_audit_events;

COMMIT;
