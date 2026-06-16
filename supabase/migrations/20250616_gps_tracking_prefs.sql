-- 촬영 감지 ON/OFF (관리자 조회용, 클라이언트와 동기화)
CREATE TABLE IF NOT EXISTS gps_tracking_prefs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS gps_tracking_prefs_user_id_idx ON gps_tracking_prefs (user_id);

ALTER TABLE gps_tracking_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "유저 본인 gps_tracking_prefs" ON gps_tracking_prefs;
CREATE POLICY "유저 본인 gps_tracking_prefs"
  ON gps_tracking_prefs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON gps_tracking_prefs TO authenticated;
GRANT ALL ON gps_tracking_prefs TO service_role;
