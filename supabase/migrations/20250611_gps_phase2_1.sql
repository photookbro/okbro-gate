-- Phase 2-1: GPS 로그 테이블 확인 + events GPS 기본 반경 50m

-- ---------------------------------------------------------------------------
-- 1. events GPS 컬럼 (없으면 추가)
-- ---------------------------------------------------------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_radius_meters integer DEFAULT 50;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_enabled boolean DEFAULT false;

-- 기존 컬럼이 있으면 기본값만 200 → 50 으로 변경 (신규 행·미설정 시 적용)
ALTER TABLE events ALTER COLUMN gps_radius_meters SET DEFAULT 50;

-- ---------------------------------------------------------------------------
-- 2. gps_logs 테이블 (없으면 생성, 컬럼 없으면 추가)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gps_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  event_id uuid REFERENCES events(id),
  passed_at timestamptz DEFAULT now(),
  notified boolean DEFAULT false
);

ALTER TABLE gps_logs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE gps_logs ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id);
ALTER TABLE gps_logs ADD COLUMN IF NOT EXISTS passed_at timestamptz DEFAULT now();
ALTER TABLE gps_logs ADD COLUMN IF NOT EXISTS notified boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS gps_logs_user_event_idx ON gps_logs (user_id, event_id);
CREATE INDEX IF NOT EXISTS gps_logs_passed_at_idx ON gps_logs (passed_at DESC);

-- ---------------------------------------------------------------------------
-- 3. RLS 정책
-- ---------------------------------------------------------------------------
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
