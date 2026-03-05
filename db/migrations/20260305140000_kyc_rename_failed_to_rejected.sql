-- migrate:up
BEGIN;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_kyc_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_kyc_status_check
    CHECK (kyc_status IN (
      'not_started',
      'pending',
      'in_review',
      'verified',
      'rejected',
      'expired'
    ));

-- Migrate any existing 'failed' values to 'rejected'
UPDATE users SET kyc_status = 'rejected' WHERE kyc_status = 'failed';

COMMIT;

-- migrate:down
BEGIN;

UPDATE users SET kyc_status = 'failed' WHERE kyc_status = 'rejected';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_kyc_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_kyc_status_check
    CHECK (kyc_status IN (
      'not_started',
      'pending',
      'in_review',
      'verified',
      'failed',
      'expired'
    ));

COMMIT;
