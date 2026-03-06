-- migrate:up
CREATE TABLE IF NOT EXISTS escrow_ledger (
  id              UUID        NOT NULL,
  campaign_id     UUID        NOT NULL,
  entry_type      TEXT        NOT NULL,
  amount_cents    BIGINT      NOT NULL,
  contribution_id UUID        NULL,
  reference       TEXT        NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT escrow_ledger_pkey PRIMARY KEY (id),
  CONSTRAINT escrow_ledger_entry_type_check CHECK (
    entry_type IN ('contribution', 'disbursement', 'refund', 'interest')
  ),
  CONSTRAINT escrow_ledger_amount_cents_check CHECK (amount_cents > 0),
  CONSTRAINT escrow_ledger_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES campaigns (id) ON DELETE RESTRICT,
  CONSTRAINT escrow_ledger_contribution_id_fkey FOREIGN KEY (contribution_id)
    REFERENCES contributions (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_escrow_ledger_campaign_id ON escrow_ledger (campaign_id);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_contribution_id ON escrow_ledger (contribution_id);

-- migrate:down
DROP TABLE IF EXISTS escrow_ledger CASCADE;
