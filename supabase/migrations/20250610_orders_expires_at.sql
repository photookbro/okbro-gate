-- orders 테이블 확장
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS event_id uuid references events(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at timestamptz default now();

UPDATE orders
SET expires_at = used_at + interval '6 months'
WHERE expires_at IS NULL AND used_at IS NOT NULL;
