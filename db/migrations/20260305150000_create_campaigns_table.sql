-- migrate:up
BEGIN;

CREATE TABLE IF NOT EXISTS campaigns (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title                 VARCHAR(200)  NOT NULL,
  short_description     VARCHAR(500),
  description           TEXT
                                      CHECK (description IS NULL OR length(description) <= 10000),
  category              TEXT
                                      CHECK (category IS NULL OR category IN (
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
                                      )),
  hero_image_url        TEXT,
  funding_goal_cents    BIGINT        CHECK (funding_goal_cents IS NULL OR funding_goal_cents > 0),
  funding_cap_cents     BIGINT        CHECK (funding_cap_cents IS NULL OR funding_cap_cents > 0),
  deadline              TIMESTAMPTZ,
  milestones            JSONB         NOT NULL DEFAULT '[]'::JSONB,
  team_members          JSONB         NOT NULL DEFAULT '[]'::JSONB,
  risk_disclosures      JSONB         NOT NULL DEFAULT '[]'::JSONB,
  budget_breakdown      JSONB         NOT NULL DEFAULT '[]'::JSONB,
  alignment_statement   TEXT,
  tags                  TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  status                TEXT          NOT NULL DEFAULT 'draft'
                                      CHECK (status IN (
                                        'draft', 'submitted', 'under_review',
                                        'approved', 'rejected', 'live',
                                        'funded', 'suspended', 'failed',
                                        'settlement', 'complete', 'cancelled', 'archived'
                                      )),
  rejection_reason      TEXT,
  resubmission_guidance TEXT,
  review_notes          TEXT,
  reviewed_by_user_id   UUID          REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,
  launched_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_creator_user_id     ON campaigns (creator_user_id);
CREATE INDEX idx_campaigns_status              ON campaigns (status);
CREATE INDEX idx_campaigns_submitted_at        ON campaigns (submitted_at);
CREATE INDEX idx_campaigns_reviewed_by_user_id ON campaigns (reviewed_by_user_id);

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS campaigns_updated_at ON campaigns;
DROP INDEX IF EXISTS idx_campaigns_reviewed_by_user_id;
DROP INDEX IF EXISTS idx_campaigns_submitted_at;
DROP INDEX IF EXISTS idx_campaigns_status;
DROP INDEX IF EXISTS idx_campaigns_creator_user_id;
DROP TABLE IF EXISTS campaigns;

COMMIT;
