-- 3차 촬영 위치 + GPS 통과 규칙 정리 (순환/일일상한 로직은 앱에서 제거, 컬럼 is_loop_course 는 유지)

ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_3_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_3_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_3_radius_meters integer DEFAULT 50;

COMMENT ON COLUMN events.gps_3_lat IS '3차 촬영 위치 위도 (선택)';
COMMENT ON COLUMN events.gps_3_lng IS '3차 촬영 위치 경도 (선택)';
COMMENT ON COLUMN events.gps_3_radius_meters IS '3차 촬영 위치 반경(m)';
COMMENT ON COLUMN gps_logs.location_number IS '촬영 위치 번호 (1, 2 또는 3)';
COMMENT ON COLUMN events.is_loop_course IS '레거시 순환 코스 플래그. 앱 로직에서는 더 이상 사용하지 않음.';
