-- 선수별 GPS 토글 영구 저장 (gps_tracking_prefs → user_gps_tracking_prefs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gps_tracking_prefs'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_gps_tracking_prefs'
  ) THEN
    ALTER TABLE gps_tracking_prefs RENAME TO user_gps_tracking_prefs;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_gps_tracking_prefs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS user_gps_tracking_prefs_user_id_idx
  ON user_gps_tracking_prefs (user_id);

CREATE INDEX IF NOT EXISTS user_gps_tracking_prefs_event_id_idx
  ON user_gps_tracking_prefs (event_id);

ALTER TABLE user_gps_tracking_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "유저 본인 user_gps_tracking_prefs" ON user_gps_tracking_prefs;
CREATE POLICY "유저 본인 user_gps_tracking_prefs"
  ON user_gps_tracking_prefs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_gps_tracking_prefs TO authenticated;
GRANT ALL ON user_gps_tracking_prefs TO service_role;
