-- 인스타 팔로워 업로드: 대조 일괄 처리 + 푸시 분리(outbox) + 멈춘 작업 정리
-- 앱 배포 전에 Supabase SQL Editor에서 실행

ALTER TABLE instagram_follower_upload_jobs
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS push_status text,
  ADD COLUMN IF NOT EXISTS push_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS push_finished_at timestamptz;

ALTER TABLE instagram_follower_upload_jobs
  DROP CONSTRAINT IF EXISTS instagram_follower_upload_jobs_push_status_check;
ALTER TABLE instagram_follower_upload_jobs
  ADD CONSTRAINT instagram_follower_upload_jobs_push_status_check
  CHECK (push_status IS NULL OR push_status IN ('pending', 'sending', 'done'));

-- 불일치 회수는 전체 스냅샷 업로드에서만: run(실행) / skipped(부분 목록이라 건너뜀)
ALTER TABLE instagram_follower_upload_jobs
  ADD COLUMN IF NOT EXISTS mismatch_sweep text,
  ADD COLUMN IF NOT EXISTS mismatch_sweep_skip_reason text,
  ADD COLUMN IF NOT EXISTS snapshot_baseline_total integer;

ALTER TABLE instagram_follower_upload_jobs
  DROP CONSTRAINT IF EXISTS instagram_follower_upload_jobs_mismatch_sweep_check;
ALTER TABLE instagram_follower_upload_jobs
  ADD CONSTRAINT instagram_follower_upload_jobs_mismatch_sweep_check
  CHECK (mismatch_sweep IS NULL OR mismatch_sweep IN ('run', 'skipped'));

-- 대조 확정과 같은 트랜잭션에서 적재 → 발송은 별도 단계에서 1회만
CREATE TABLE IF NOT EXISTS instagram_follow_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES instagram_follower_upload_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('approved', 'mismatch')),
  bonus_days integer,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'no_subscription')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  UNIQUE (job_id, user_id, kind)
);

CREATE INDEX IF NOT EXISTS instagram_follow_push_outbox_job_status_idx
  ON instagram_follow_push_outbox (job_id, status);

CREATE INDEX IF NOT EXISTS instagram_follow_push_outbox_status_created_idx
  ON instagram_follow_push_outbox (status, created_at);

ALTER TABLE instagram_follow_push_outbox ENABLE ROW LEVEL SECURITY;

GRANT ALL ON instagram_follow_push_outbox TO service_role;

-- 대기 신청 일괄 승인 + 핸들 이력 + 승인 푸시 적재 (한 트랜잭션)
-- p_rows: [{ id, approved_at, bonus_days_granted, expires_at, history_handle, notify }]
CREATE OR REPLACE FUNCTION apply_instagram_follow_approvals(p_job_id uuid, p_rows jsonb)
RETURNS TABLE (approved_id uuid, approved_user_id uuid)
LANGUAGE sql
SET search_path = public
AS $$
  WITH input AS (
    SELECT *
    FROM jsonb_to_recordset(p_rows) AS r(
      id uuid,
      approved_at timestamptz,
      bonus_days_granted integer,
      expires_at timestamptz,
      history_handle text,
      notify boolean
    )
  ),
  updated AS (
    UPDATE instagram_follow_bonus b
    SET
      status = 'approved',
      approved_at = i.approved_at,
      bonus_days_granted = i.bonus_days_granted,
      expires_at = i.expires_at,
      manually_unlocked = false,
      manual_unlock_verified_mismatch = false,
      updated_at = now()
    FROM input i
    WHERE b.id = i.id
      AND b.status = 'pending'
      AND NOT EXISTS (
        SELECT 1
        FROM instagram_follow_bonus taken
        WHERE taken.status = 'approved'
          AND taken.instagram_handle = b.instagram_handle
          AND taken.id <> b.id
      )
    RETURNING b.id, b.user_id, i.approved_at, i.bonus_days_granted, i.history_handle, i.notify
  ),
  history AS (
    INSERT INTO instagram_handle_bonus_history (
      instagram_handle,
      first_confirmed_at,
      last_confirmed_at,
      last_confirmed_user_id,
      confirm_count
    )
    SELECT DISTINCT ON (u.history_handle)
      u.history_handle,
      u.approved_at,
      u.approved_at,
      u.user_id,
      1
    FROM updated u
    WHERE NULLIF(u.history_handle, '') IS NOT NULL
    ORDER BY u.history_handle, u.approved_at
    ON CONFLICT (instagram_handle) DO UPDATE
    SET
      last_confirmed_at = EXCLUDED.last_confirmed_at,
      last_confirmed_user_id = EXCLUDED.last_confirmed_user_id,
      confirm_count = instagram_handle_bonus_history.confirm_count + 1
    RETURNING 1
  ),
  outbox AS (
    INSERT INTO instagram_follow_push_outbox (job_id, user_id, kind, bonus_days)
    SELECT DISTINCT ON (u.user_id) p_job_id, u.user_id, 'approved', u.bonus_days_granted
    FROM updated u
    WHERE u.notify
    ORDER BY u.user_id
    ON CONFLICT (job_id, user_id, kind) DO NOTHING
    RETURNING 1
  )
  SELECT u.id, u.user_id FROM updated u;
$$;

-- 팔로워 목록에 없는 수동 해제 건 일괄 회수 + 불일치 푸시 적재 (한 트랜잭션)
CREATE OR REPLACE FUNCTION apply_instagram_follow_mismatch_revokes(p_job_id uuid, p_ids uuid[])
RETURNS TABLE (revoked_id uuid, revoked_user_id uuid)
LANGUAGE sql
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE instagram_follow_bonus b
    SET
      manually_unlocked = false,
      manual_unlock_verified_mismatch = true,
      updated_at = now()
    WHERE b.id = ANY(p_ids)
      AND b.status = 'pending'
      AND b.manually_unlocked = true
    RETURNING b.id, b.user_id
  ),
  outbox AS (
    INSERT INTO instagram_follow_push_outbox (job_id, user_id, kind)
    SELECT DISTINCT p_job_id, u.user_id, 'mismatch'
    FROM updated u
    ON CONFLICT (job_id, user_id, kind) DO NOTHING
    RETURNING 1
  )
  SELECT u.id, u.user_id FROM updated u;
$$;

REVOKE ALL ON FUNCTION apply_instagram_follow_approvals(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION apply_instagram_follow_mismatch_revokes(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_instagram_follow_approvals(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION apply_instagram_follow_mismatch_revokes(uuid, uuid[]) TO service_role;

-- 갱신이 멈춘 채 processing/queued로 남은 작업 정리 (2026-09-28 11:08~11:12 KST 3건 포함)
UPDATE instagram_follower_upload_jobs
SET
  status = 'failed',
  phase = COALESCE(phase, 'match'),
  error = '저장 이후 대조 단계에서 함수가 종료되어 멈춘 작업이에요. 수정 배포 후 같은 파일을 다시 올려주세요.',
  finished_at = now(),
  updated_at = now()
WHERE status IN ('queued', 'processing')
  AND updated_at < now() - interval '10 minutes';

NOTIFY pgrst, 'reload schema';
