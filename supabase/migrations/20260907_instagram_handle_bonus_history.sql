-- 인스타 팔로우 혜택이 HTML 대조로 확정된 아이디 영구 이력.
-- auth.users FK 없음 → 회원 탈퇴 후에도 행이 남음 (재가입 자동승인 방지).

CREATE TABLE IF NOT EXISTS instagram_handle_bonus_history (
  instagram_handle text PRIMARY KEY,
  first_confirmed_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_user_id uuid,
  confirm_count integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS instagram_handle_bonus_history_last_confirmed_idx
  ON instagram_handle_bonus_history (last_confirmed_at DESC);

ALTER TABLE instagram_handle_bonus_history ENABLE ROW LEVEL SECURITY;

GRANT ALL ON instagram_handle_bonus_history TO service_role;

-- 이미 approved인 핸들은 확정된 것으로 보고 소급 적재
INSERT INTO instagram_handle_bonus_history (
  instagram_handle,
  first_confirmed_at,
  last_confirmed_at,
  last_confirmed_user_id,
  confirm_count
)
SELECT
  handles.instagram_handle,
  handles.first_confirmed_at,
  handles.last_confirmed_at,
  latest.user_id AS last_confirmed_user_id,
  handles.confirm_count
FROM (
  SELECT
    lower(trim(b.instagram_handle)) AS instagram_handle,
    COALESCE(MIN(b.approved_at), MIN(b.created_at), now()) AS first_confirmed_at,
    COALESCE(MAX(b.approved_at), MAX(b.updated_at), now()) AS last_confirmed_at,
    COUNT(*)::integer AS confirm_count
  FROM instagram_follow_bonus b
  WHERE b.status = 'approved'
    AND NULLIF(trim(b.instagram_handle), '') IS NOT NULL
  GROUP BY lower(trim(b.instagram_handle))
) handles
LEFT JOIN LATERAL (
  SELECT b2.user_id
  FROM instagram_follow_bonus b2
  WHERE b2.status = 'approved'
    AND lower(trim(b2.instagram_handle)) = handles.instagram_handle
  ORDER BY b2.approved_at DESC NULLS LAST, b2.created_at DESC
  LIMIT 1
) latest ON true
ON CONFLICT (instagram_handle) DO NOTHING;
