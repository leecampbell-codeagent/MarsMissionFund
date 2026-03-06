-- migrate:up
CREATE TABLE IF NOT EXISTS contributions (
  id                UUID        NOT NULL,
  donor_id          UUID        NOT NULL,
  campaign_id       UUID        NOT NULL,
  amount_cents      BIGINT      NOT NULL,
  status            TEXT        NOT NULL,
  gateway_reference TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT contributions_pkey PRIMARY KEY (id),
  CONSTRAINT contributions_status_check CHECK (
    status IN ('pending_capture', 'captured', 'failed', 'refunded', 'partially_refunded')
  ),
  CONSTRAINT contributions_amount_cents_check CHECK (amount_cents > 0),
  CONSTRAINT contributions_donor_id_fkey FOREIGN KEY (donor_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT contributions_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES campaigns (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_contributions_donor_id ON contributions (donor_id);
CREATE INDEX IF NOT EXISTS idx_contributions_campaign_id ON contributions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions (status);

CREATE TRIGGER set_contributions_updated_at
  BEFORE UPDATE ON contributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- migrate:down
DROP TABLE IF EXISTS contributions CASCADE;
