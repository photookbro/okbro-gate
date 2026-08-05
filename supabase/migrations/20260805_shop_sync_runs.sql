-- SHOP OneDrive 동기화 이력
CREATE TABLE IF NOT EXISTS shop_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  success boolean NOT NULL DEFAULT false,
  rows_upserted integer NOT NULL DEFAULT 0,
  error_message text,
  source_url text,
  triggered_by text NOT NULL DEFAULT 'cron',
  file_name text
);

CREATE INDEX IF NOT EXISTS shop_sync_runs_started_at_idx
  ON shop_sync_runs (started_at DESC);

ALTER TABLE shop_sync_runs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON shop_sync_runs TO service_role;
