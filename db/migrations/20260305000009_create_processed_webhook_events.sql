-- migrate:up
BEGIN;

CREATE TABLE processed_webhook_events (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      TEXT         NOT NULL UNIQUE,
  event_type    TEXT         NOT NULL,
  processed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processed_webhook_events_event_id ON processed_webhook_events (event_id);

COMMIT;

-- migrate:down
BEGIN;

DROP TABLE IF EXISTS processed_webhook_events;

COMMIT;
