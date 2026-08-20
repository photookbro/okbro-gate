ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_active_at_idx
  ON profiles (last_active_at DESC)
  WHERE last_active_at IS NOT NULL;
