-- Dual GPS shooting locations per event
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_1_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_1_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_1_radius_meters integer DEFAULT 50;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_2_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_2_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_2_radius_meters integer DEFAULT 50;

UPDATE events
SET
  gps_1_lat = COALESCE(gps_1_lat, gps_lat),
  gps_1_lng = COALESCE(gps_1_lng, gps_lng),
  gps_1_radius_meters = COALESCE(gps_1_radius_meters, gps_radius_meters, 50)
WHERE gps_lat IS NOT NULL OR gps_lng IS NOT NULL;

ALTER TABLE gps_logs ADD COLUMN IF NOT EXISTS location_number integer DEFAULT 1;

UPDATE gps_logs SET location_number = 1 WHERE location_number IS NULL;

COMMENT ON COLUMN events.gps_1_lat IS '1차 촬영 위치 위도';
COMMENT ON COLUMN events.gps_2_lat IS '2차 촬영 위치 위도 (선택)';
COMMENT ON COLUMN gps_logs.location_number IS '촬영 위치 번호 (1 또는 2)';
