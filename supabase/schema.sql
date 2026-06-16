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

INSERT INTO settings (key, value) VALUES ('shared_order_period_months', '1')
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
