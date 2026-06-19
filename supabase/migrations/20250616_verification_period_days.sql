-- 유효기간 설정: 개월 → 일 단위
INSERT INTO settings (key, value)
SELECT 'verified_period_days', (value::int * 30)::text
FROM settings
WHERE key = 'verified_period_months'
  AND value ~ '^\d+$'
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
SELECT 'shared_order_period_days', (value::int * 30)::text
FROM settings
WHERE key = 'shared_order_period_months'
  AND value ~ '^\d+$'
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('shared_order_period_days', '30')
ON CONFLICT (key) DO NOTHING;
