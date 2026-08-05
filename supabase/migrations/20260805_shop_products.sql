CREATE TABLE IF NOT EXISTS shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  store_name text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  price_original integer NOT NULL DEFAULT 0,
  price_discount integer NOT NULL DEFAULT 0,
  affiliate_url text NOT NULL,
  category text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_products_affiliate_url_unique UNIQUE (affiliate_url)
);

CREATE INDEX IF NOT EXISTS shop_products_active_order_idx
  ON shop_products (is_active, display_order ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS shop_products_display_order_idx
  ON shop_products (display_order ASC, created_at DESC);

ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

-- 선수는 활성 상품만 조회 (anon 포함). 쓰기는 service_role/어드민 API만.
CREATE POLICY "shop_products_select_active"
  ON shop_products FOR SELECT
  USING (is_active = true);

GRANT ALL ON shop_products TO service_role;
GRANT SELECT ON shop_products TO anon, authenticated;
