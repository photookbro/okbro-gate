-- 순환 코스 여부 (진입/이탈로 복수 기록 허용)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_loop_course boolean DEFAULT false;

COMMENT ON COLUMN events.is_loop_course IS '순환 코스 여부. true면 GPS pass 최대 3회, false면 1회';

