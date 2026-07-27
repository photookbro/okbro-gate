CREATE TABLE IF NOT EXISTS instagram_followers (
  username text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instagram_followers_updated_at_idx
  ON instagram_followers (updated_at DESC);

ALTER TABLE instagram_followers ENABLE ROW LEVEL SECURITY;

GRANT ALL ON instagram_followers TO service_role;
