INSERT INTO settings (key, value)
VALUES ('home_background_position', '{"x":0,"y":0}')
ON CONFLICT (key) DO NOTHING;
