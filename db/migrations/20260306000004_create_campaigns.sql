-- migrate:up
CREATE TABLE IF NOT EXISTS campaigns (
  id                   UUID        NOT NULL,
  creator_id           UUID        NOT NULL,
  title                TEXT        NOT NULL,
  summary              TEXT        NULL,
  description          TEXT        NULL,
  category             TEXT        NOT NULL,
  status               TEXT        NOT NULL,
  funding_goal_cents   BIGINT      NOT NULL,
  funding_cap_cents    BIGINT      NOT NULL,
  amount_raised_cents  BIGINT      NOT NULL DEFAULT 0,
  deadline             TIMESTAMPTZ NULL,
  launched_at          TIMESTAMPTZ NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_status_check CHECK (
    status IN (
      'draft',
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'live',
      'funded',
      'suspended',
      'failed',
      'settlement',
      'complete',
      'cancelled'
    )
  ),
  CONSTRAINT campaigns_category_check CHECK (
    category IN (
      'propulsion',
      'entry_descent_landing',
      'power_energy',
      'habitats_construction',
      'life_support_crew_health',
      'food_water_production',
      'in_situ_resource_utilisation',
      'radiation_protection',
      'robotics_automation',
      'communications_navigation'
    )
  ),
  CONSTRAINT campaigns_funding_goal_cents_min_check CHECK (funding_goal_cents >= 100000000),
  CONSTRAINT campaigns_funding_cap_cents_max_check CHECK (funding_cap_cents <= 100000000000),
  CONSTRAINT campaigns_funding_cap_cents_min_check CHECK (funding_cap_cents >= 100000000),
  CONSTRAINT campaigns_funding_cap_gte_goal_check CHECK (funding_cap_cents >= funding_goal_cents),
  CONSTRAINT campaigns_amount_raised_cents_check CHECK (amount_raised_cents >= 0),
  CONSTRAINT campaigns_creator_id_fkey FOREIGN KEY (creator_id)
    REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_campaigns_creator_id ON campaigns (creator_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_status_deadline ON campaigns (status, deadline);

CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- migrate:down
DROP TABLE IF EXISTS campaigns CASCADE;
