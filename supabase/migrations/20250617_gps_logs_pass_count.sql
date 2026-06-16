-- GPS 순환 코스: 통과 회차 (1~3)
ALTER TABLE gps_logs ADD COLUMN IF NOT EXISTS pass_count integer;

UPDATE gps_logs SET pass_count = 1 WHERE pass_count IS NULL;

ALTER TABLE gps_logs ALTER COLUMN pass_count SET DEFAULT 1;

COMMENT ON COLUMN gps_logs.pass_count IS '당일 순환 코스 통과 회차 (1~3)';
