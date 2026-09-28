-- 팔로워 목록엔 있지만 같은 아이디가 이미 다른 계정에 승인된 자동승인 건 회수
-- (불일치와 구분: manual_unlock_handle_taken)
-- 앱 배포 전에 Supabase SQL Editor에서 실행

ALTER TABLE instagram_follow_bonus
  ADD COLUMN IF NOT EXISTS manual_unlock_handle_taken boolean NOT NULL DEFAULT false;

ALTER TABLE instagram_follower_upload_jobs
  ADD COLUMN IF NOT EXISTS handle_taken_revokes integer NOT NULL DEFAULT 0;

-- 아이디를 바꾸거나, 다시 자동승인되거나, 승인/거절되면 표시 해제 (모든 경로 공통)
CREATE OR REPLACE FUNCTION clear_instagram_follow_handle_taken()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.manual_unlock_handle_taken AND (
    NEW.instagram_handle IS DISTINCT FROM OLD.instagram_handle
    OR NEW.status <> 'pending'
    OR (NEW.manually_unlocked AND NOT OLD.manually_unlocked)
  ) THEN
    NEW.manual_unlock_handle_taken := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS instagram_follow_bonus_clear_handle_taken ON instagram_follow_bonus;
CREATE TRIGGER instagram_follow_bonus_clear_handle_taken
  BEFORE UPDATE ON instagram_follow_bonus
  FOR EACH ROW
  EXECUTE FUNCTION clear_instagram_follow_handle_taken();

-- 자동승인 중인 pending 건 중 같은 아이디가 다른 계정에 승인된 건만 회수
CREATE OR REPLACE FUNCTION apply_instagram_follow_handle_taken_revokes(p_ids uuid[])
RETURNS TABLE (revoked_id uuid, revoked_user_id uuid)
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE instagram_follow_bonus b
  SET
    manually_unlocked = false,
    manual_unlock_handle_taken = true,
    updated_at = now()
  WHERE b.id = ANY(p_ids)
    AND b.status = 'pending'
    AND b.manually_unlocked = true
    AND EXISTS (
      SELECT 1
      FROM instagram_follow_bonus taken
      WHERE taken.status = 'approved'
        AND lower(trim(taken.instagram_handle)) = lower(trim(b.instagram_handle))
        AND taken.user_id <> b.user_id
    )
  RETURNING b.id, b.user_id;
$$;

REVOKE ALL ON FUNCTION apply_instagram_follow_handle_taken_revokes(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_instagram_follow_handle_taken_revokes(uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
