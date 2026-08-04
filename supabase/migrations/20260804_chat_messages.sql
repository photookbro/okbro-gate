-- 관리자↔선수 1:1 채팅
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user', 'admin')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx
  ON chat_messages (user_id, created_at ASC);

CREATE INDEX IF NOT EXISTS chat_messages_unread_admin_idx
  ON chat_messages (user_id, created_at DESC)
  WHERE sender = 'admin' AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS chat_messages_unread_user_idx
  ON chat_messages (user_id, created_at DESC)
  WHERE sender = 'user' AND read_at IS NULL;

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 선수는 본인 스레드만 조회
CREATE POLICY "chat_messages_select_own"
  ON chat_messages FOR SELECT
  USING (auth.uid() = user_id);

-- 선수는 본인 메시지만 삽입
CREATE POLICY "chat_messages_insert_own_user"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND sender = 'user');

-- 선수가 본인 스레드의 미읽음(관리자 메시지)을 읽음 처리
CREATE POLICY "chat_messages_update_own_read"
  ON chat_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON chat_messages TO service_role;
