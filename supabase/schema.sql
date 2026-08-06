create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text,
  purchase_count integer default 0,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  order_number text unique,
  platform text,
  used_at timestamptz default now(),
  created_at timestamptz default now(),
  expires_at timestamptz,
  event_id uuid references events(id),
  expiry_notified_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_platform_order_number_uidx
  ON orders (platform, order_number);

create table events (
  id uuid primary key default gen_random_uuid(),
  name text,
  date date,
  drive_folder_a text,
  drive_folder_b text,
  created_at timestamptz default now()
);

create table downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  order_id uuid references orders(id),
  photo_id text,
  downloaded_at timestamptz default now()
);

create table terms_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreed_at timestamptz default now(),
  ip_address text,
  user_agent text,
  version text not null default 'v1'
);

-- 기존 DB 마이그레이션
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS event_id uuid references events(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at timestamptz default now();

UPDATE orders
SET expires_at = used_at + interval '6 months'
WHERE expires_at IS NULL AND used_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS terms_agreements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreed_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  version text DEFAULT 'v1'
);

CREATE UNIQUE INDEX IF NOT EXISTS terms_agreements_user_version_idx
  ON terms_agreements (user_id, version);

ALTER TABLE terms_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own terms agreement" ON terms_agreements;
CREATE POLICY "Users can insert own terms agreement"
  ON terms_agreements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own terms agreement" ON terms_agreements;
CREATE POLICY "Users can read own terms agreement"
  ON terms_agreements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON terms_agreements TO authenticated;
GRANT ALL ON terms_agreements TO service_role;

INSERT INTO settings (key, value) VALUES ('shared_order_period_days', '30')
ON CONFLICT (key) DO NOTHING;

-- GPS 감지
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_radius_meters integer DEFAULT 50;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_enabled boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_loop_course boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_1_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_1_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_1_radius_meters integer DEFAULT 50;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_2_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_2_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_2_radius_meters integer DEFAULT 50;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_3_lat double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_3_lng double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gps_3_radius_meters integer DEFAULT 50;

CREATE TABLE IF NOT EXISTS gps_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  event_id uuid REFERENCES events(id),
  passed_at timestamptz DEFAULT now(),
  pass_count integer DEFAULT 1,
  location_number integer DEFAULT 1,
  notified boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS gps_logs_user_event_idx ON gps_logs (user_id, event_id);
CREATE INDEX IF NOT EXISTS gps_logs_passed_at_idx ON gps_logs (passed_at DESC);

ALTER TABLE gps_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "유저 본인 select" ON gps_logs;
CREATE POLICY "유저 본인 select"
  ON gps_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "유저 본인 insert" ON gps_logs;
CREATE POLICY "유저 본인 insert"
  ON gps_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON gps_logs TO authenticated;
GRANT ALL ON gps_logs TO service_role;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

GRANT ALL ON notifications TO service_role;

CREATE TABLE IF NOT EXISTS instagram_followers (
  username text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instagram_followers_updated_at_idx
  ON instagram_followers (updated_at DESC);

ALTER TABLE instagram_followers ENABLE ROW LEVEL SECURITY;

GRANT ALL ON instagram_followers TO service_role;

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instagram_follow_bonus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_handle text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  bonus_days_granted integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS instagram_follow_bonus_user_approved_idx
  ON instagram_follow_bonus (user_id)
  WHERE status = 'approved';

CREATE UNIQUE INDEX IF NOT EXISTS instagram_follow_bonus_handle_approved_idx
  ON instagram_follow_bonus (instagram_handle)
  WHERE status = 'approved';

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_follow_bonus ENABLE ROW LEVEL SECURITY;

GRANT ALL ON profiles TO service_role;
GRANT ALL ON instagram_follow_bonus TO service_role;

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user', 'admin')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx
  ON chat_messages (user_id, created_at ASC);

CREATE INDEX IF NOT EXISTS chat_messages_unread_admin_idx
  ON chat_messages (user_id, created_at DESC)
  WHERE sender = 'admin' AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS chat_messages_unread_user_idx
  ON chat_messages (user_id, created_at DESC)
  WHERE sender = 'user' AND read_at IS NULL;

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_select_own"
  ON chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "chat_messages_insert_own_user"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND sender = 'user');

CREATE POLICY "chat_messages_update_own_read"
  ON chat_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON chat_messages TO service_role;

CREATE TABLE IF NOT EXISTS verified_naver_orders (
  order_number text PRIMARY KEY,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verified_naver_orders_imported_at_idx
  ON verified_naver_orders (imported_at DESC);

ALTER TABLE verified_naver_orders ENABLE ROW LEVEL SECURITY;

GRANT ALL ON verified_naver_orders TO service_role;

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

CREATE POLICY "shop_products_select_active"
  ON shop_products FOR SELECT
  USING (is_active = true);

GRANT ALL ON shop_products TO service_role;
GRANT SELECT ON shop_products TO anon, authenticated;

INSERT INTO settings (key, value)
VALUES ('instagram_follow_bonus_days', '5')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_content (
  key text PRIMARY KEY,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_content_select_public"
  ON app_content FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON app_content TO anon, authenticated;
GRANT ALL ON app_content TO service_role;
