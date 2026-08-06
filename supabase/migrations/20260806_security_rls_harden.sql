-- Security harden: enable RLS on core tables, lock gps_logs writes, fix storage policy
-- App APIs use service_role (bypasses RLS). Client must not insert gps_logs / mutate orders.

-- 1) Core tables: enable RLS, no anon/authenticated policies (deny-by-default)
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;

-- events: public read for catalog / verify-order client, no client writes
ALTER TABLE IF EXISTS events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_public_select" ON events;
CREATE POLICY "events_public_select"
  ON events FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2) gps_logs: remove authenticated INSERT (keep own SELECT)
DROP POLICY IF EXISTS "유저 본인 insert" ON gps_logs;
REVOKE INSERT ON gps_logs FROM authenticated;
-- SELECT own policy kept for legacy clients; writes go through /api/gps-log (service_role)

-- 3) storage site-assets: restrict write to service_role
DROP POLICY IF EXISTS "Service role manage site assets" ON storage.objects;
CREATE POLICY "Service role manage site assets"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'site-assets')
  WITH CHECK (bucket_id = 'site-assets');

-- 4) chat_messages: narrow UPDATE to read_at only (recreate)
DROP POLICY IF EXISTS "chat_messages_update_own_read" ON chat_messages;
CREATE POLICY "chat_messages_update_own_read"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- Note: column-level restriction is not native in Postgres RLS;
-- prefer service_role API for updates. Authenticated UPDATE grants should be reviewed.
