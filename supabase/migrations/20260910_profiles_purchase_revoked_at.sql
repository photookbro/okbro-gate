-- 관리자 구매 인증 취소 후 마이페이지 안내용
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS purchase_revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_purchase_revoked_at_idx
  ON profiles (purchase_revoked_at DESC)
  WHERE purchase_revoked_at IS NOT NULL;
