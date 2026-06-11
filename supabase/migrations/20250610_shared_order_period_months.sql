INSERT INTO settings (key, value) VALUES ('shared_order_period_months', '1')
ON CONFLICT (key) DO NOTHING;
