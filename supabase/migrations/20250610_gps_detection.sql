-- events GPS 설정 컬럼
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_radius_meters integer DEFAULT 200;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_enabled boolean DEFAULT false;

-- GPS 통과 로그
CREATE TABLE IF NOT EXISTS gps_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  event_id uuid REFERENCES events(id),
  passed_at timestamptz DEFAULT now(),
  notified boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS gps_logs_user_event_idx ON gps_logs (user_id, event_id);
CREATE INDEX IF NOT EXISTS gps_logs_passed_at_idx ON gps_logs (passed_at DESC);

ALTER TABLE gps_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "유저 본인 select" ON gps_logs;
CREATE POLICY "유저 본인 select"
  ON gps_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "유저 본인 insert" ON gps_logs;
CREATE POLICY "유저 본인 insert"
  ON gps_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON gps_logs TO authenticated;
GRANT ALL ON gps_logs TO service_role;
