-- 엉뚱한 아이디 반복 자동승인 방지
-- 불일치(manual_unlock_verified_mismatch) 또는 다른 계정 아이디(manual_unlock_handle_taken)로
-- 자동승인이 회수된 적 있는 계정 표시 → 이후 제출은 최신 팔로워 목록에 있을 때만 즉시 승인
-- 20260928_instagram_handle_taken_revoke.sql 다음에, 앱 배포 전에 실행

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS instagram_auto_unlock_blocked_at timestamptz;

-- 회수 표시가 켜지는 순간 계정에 기록 (아이디를 바꿔 표시가 풀려도 계정 기록은 유지)
CREATE OR REPLACE FUNCTION mark_instagram_auto_unlock_blocked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.manual_unlock_verified_mismatch AND NOT OLD.manual_unlock_verified_mismatch)
     OR (NEW.manual_unlock_handle_taken AND NOT OLD.manual_unlock_handle_taken) THEN
    UPDATE profiles
    SET instagram_auto_unlock_blocked_at = now()
    WHERE user_id = NEW.user_id
      AND instagram_auto_unlock_blocked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS instagram_follow_bonus_mark_auto_unlock_blocked ON instagram_follow_bonus;
CREATE TRIGGER instagram_follow_bonus_mark_auto_unlock_blocked
  AFTER UPDATE OF manual_unlock_verified_mismatch, manual_unlock_handle_taken ON instagram_follow_bonus
  FOR EACH ROW
  EXECUTE FUNCTION mark_instagram_auto_unlock_blocked();

-- 지금 회수 표시가 남아 있는 계정 소급 기록
-- 부분 목록 오탐(팔로워 목록에 아이디가 있는 불일치)은 제외
UPDATE profiles p
SET instagram_auto_unlock_blocked_at = now()
WHERE p.instagram_auto_unlock_blocked_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM instagram_follow_bonus b
    WHERE b.user_id = p.user_id
      AND b.status = 'pending'
      AND (
        b.manual_unlock_handle_taken
        OR (
          b.manual_unlock_verified_mismatch
          AND NOT EXISTS (
            SELECT 1
            FROM instagram_followers f
            WHERE lower(f.username) = lower(trim(b.instagram_handle))
          )
        )
      )
  );

NOTIFY pgrst, 'reload schema';
