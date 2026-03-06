-- migrate:up
CREATE TABLE IF NOT EXISTS kyc_verifications (
  id                 UUID        NOT NULL,
  user_id            UUID        NOT NULL,
  status             TEXT        NOT NULL,
  provider_reference TEXT        NULL,
  verified_at        TIMESTAMPTZ NULL,
  expires_at         TIMESTAMPTZ NULL,
  failure_count      INT         NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT kyc_verifications_user_id_unique UNIQUE (user_id),
  CONSTRAINT kyc_verifications_status_check CHECK (
    status IN (
      'not_verified',
      'pending',
      'pending_resubmission',
      'in_manual_review',
      'verified',
      'expired',
      're_verification_required',
      'rejected',
      'locked'
    )
  ),
  CONSTRAINT kyc_verifications_failure_count_check CHECK (failure_count >= 0),
  CONSTRAINT kyc_verifications_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_verifications_user_id ON kyc_verifications (user_id);

CREATE TRIGGER set_kyc_verifications_updated_at
  BEFORE UPDATE ON kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- migrate:down
DROP TABLE IF EXISTS kyc_verifications CASCADE;
