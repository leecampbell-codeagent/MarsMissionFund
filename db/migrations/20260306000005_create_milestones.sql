-- migrate:up
CREATE TABLE IF NOT EXISTS milestones (
  id                    UUID        NOT NULL,
  campaign_id           UUID        NOT NULL,
  title                 TEXT        NOT NULL,
  description           TEXT        NULL,
  target_date           TIMESTAMPTZ NULL,
  funding_percentage    INT         NOT NULL,
  verification_criteria TEXT        NULL,
  status                TEXT        NOT NULL,
  order_index           INT         NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT milestones_pkey PRIMARY KEY (id),
  CONSTRAINT milestones_campaign_id_order_index_unique UNIQUE (campaign_id, order_index),
  CONSTRAINT milestones_status_check CHECK (
    status IN ('pending', 'submitted', 'verified', 'returned')
  ),
  CONSTRAINT milestones_funding_percentage_check CHECK (
    funding_percentage > 0 AND funding_percentage <= 100
  ),
  CONSTRAINT milestones_order_index_check CHECK (order_index >= 0),
  CONSTRAINT milestones_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES campaigns (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_milestones_campaign_id ON milestones (campaign_id);

CREATE TRIGGER set_milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- migrate:down
DROP TABLE IF EXISTS milestones CASCADE;
