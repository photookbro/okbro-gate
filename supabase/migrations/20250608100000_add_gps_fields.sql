-- events 테이블 GPS 설정 컬럼 추가
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_radius_meters integer DEFAULT 200;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_enabled boolean DEFAULT false;

-- gps_logs 테이블
CREATE TABLE IF NOT EXISTS gps_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  event_id uuid REFERENCES events(id),
  passed_at timestamptz DEFAULT now(),
  notified boolean DEFAULT false
);

ALTER TABLE gps_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "유저 본인 select" ON gps_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "유저 본인 insert" ON gps_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
