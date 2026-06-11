CREATE TABLE IF NOT EXISTS terms_agreements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreed_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  version text DEFAULT 'v1'
);

CREATE INDEX IF NOT EXISTS terms_agreements_user_id_idx ON terms_agreements (user_id);
CREATE INDEX IF NOT EXISTS terms_agreements_agreed_at_idx ON terms_agreements (agreed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS terms_agreements_user_version_idx
  ON terms_agreements (user_id, version);

ALTER TABLE terms_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own terms agreement" ON terms_agreements;
CREATE POLICY "Users can insert own terms agreement"
  ON terms_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own terms agreement" ON terms_agreements;
CREATE POLICY "Users can read own terms agreement"
  ON terms_agreements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON terms_agreements TO authenticated;
GRANT ALL ON terms_agreements TO service_role;
