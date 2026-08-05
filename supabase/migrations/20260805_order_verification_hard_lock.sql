-- 주문번호 인증 하드락 + 중복 시도 로그
-- (platform, order_number) 조합 UNIQUE (기존 order_number UNIQUE와 병행 가능)

CREATE UNIQUE INDEX IF NOT EXISTS orders_platform_order_number_uidx
  ON orders (platform, order_number);

CREATE TABLE IF NOT EXISTS order_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  order_number text NOT NULL,
  platform text,
  outcome text NOT NULL DEFAULT 'duplicate_rejected',
  existing_order_id uuid,
  existing_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_verification_attempts_created_at_idx
  ON order_verification_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS order_verification_attempts_order_number_idx
  ON order_verification_attempts (order_number);

ALTER TABLE order_verification_attempts ENABLE ROW LEVEL SECURITY;

GRANT ALL ON order_verification_attempts TO service_role;
