CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instagram_follow_bonus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_handle text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  bonus_days_granted integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS instagram_follow_bonus_user_approved_idx
  ON instagram_follow_bonus (user_id)
  WHERE status = 'approved';

CREATE UNIQUE INDEX IF NOT EXISTS instagram_follow_bonus_handle_approved_idx
  ON instagram_follow_bonus (instagram_handle)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS instagram_follow_bonus_user_created_idx
  ON instagram_follow_bonus (user_id, created_at DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_follow_bonus ENABLE ROW LEVEL SECURITY;

GRANT ALL ON profiles TO service_role;
GRANT ALL ON instagram_follow_bonus TO service_role;

INSERT INTO settings (key, value)
VALUES ('instagram_follow_bonus_days', '5')
ON CONFLICT (key) DO NOTHING;
