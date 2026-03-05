-- migrate:up
BEGIN;

ALTER TABLE kyc_verifications
  ADD COLUMN IF NOT EXISTS front_document_ref TEXT,
  ADD COLUMN IF NOT EXISTS back_document_ref  TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at       TIMESTAMPTZ;

COMMIT;

-- migrate:down
BEGIN;

ALTER TABLE kyc_verifications
  DROP COLUMN IF EXISTS front_document_ref,
  DROP COLUMN IF EXISTS back_document_ref,
  DROP COLUMN IF EXISTS submitted_at;

COMMIT;
