INSERT INTO settings (key, value)
VALUES ('home_background_image_url', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-assets',
  'site-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read site assets" ON storage.objects;
CREATE POLICY "Public read site assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');

DROP POLICY IF EXISTS "Service role manage site assets" ON storage.objects;
CREATE POLICY "Service role manage site assets"
  ON storage.objects FOR ALL
  USING (bucket_id = 'site-assets')
  WITH CHECK (bucket_id = 'site-assets');
