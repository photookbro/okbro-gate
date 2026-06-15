-- 웹 푸시 구독
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "유저 본인 push_subscriptions" ON push_subscriptions;
CREATE POLICY "유저 본인 push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
GRANT ALL ON push_subscriptions TO service_role;
