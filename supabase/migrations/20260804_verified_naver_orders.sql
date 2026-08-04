-- 네이버 판매자센터 주문내역 엑셀에서 가져온 실제 상품주문번호
CREATE TABLE IF NOT EXISTS verified_naver_orders (
  order_number text PRIMARY KEY,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verified_naver_orders_imported_at_idx
  ON verified_naver_orders (imported_at DESC);

ALTER TABLE verified_naver_orders ENABLE ROW LEVEL SECURITY;

GRANT ALL ON verified_naver_orders TO service_role;
