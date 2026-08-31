-- 네이버 주문 대조: 상품주문번호(A) + 주문번호(B) 함께 저장
DROP TABLE IF EXISTS verified_naver_orders;

CREATE TABLE verified_naver_orders (
  product_order_number text PRIMARY KEY,
  order_number text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verified_naver_orders_order_number_idx
  ON verified_naver_orders (order_number);

ALTER TABLE verified_naver_orders ENABLE ROW LEVEL SECURITY;

GRANT ALL ON verified_naver_orders TO service_role;
