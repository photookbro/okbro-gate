-- 인스타 팔로워 HTML 업로드 비동기 작업
CREATE TABLE IF NOT EXISTS instagram_follower_upload_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  file_names text[] NOT NULL DEFAULT '{}',
  file_count integer NOT NULL DEFAULT 0,
  usernames text[] NOT NULL DEFAULT '{}',
  progress_index integer NOT NULL DEFAULT 0,
  total_parsed integer,
  new_count integer,
  updated_count integer,
  matched_approved integer NOT NULL DEFAULT 0,
  push_sent integer NOT NULL DEFAULT 0,
  push_failed integer NOT NULL DEFAULT 0,
  no_subscription integer NOT NULL DEFAULT 0,
  manual_unlock_mismatches integer NOT NULL DEFAULT 0,
  mismatch_push_sent integer NOT NULL DEFAULT 0,
  mismatch_push_failed integer NOT NULL DEFAULT 0,
  mismatch_no_subscription integer NOT NULL DEFAULT 0,
  summary text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instagram_follower_upload_jobs_created_at_idx
  ON instagram_follower_upload_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS instagram_follower_upload_jobs_status_idx
  ON instagram_follower_upload_jobs (status);

ALTER TABLE instagram_follower_upload_jobs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON instagram_follower_upload_jobs TO service_role;
