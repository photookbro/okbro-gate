-- 페이대회: 주최측 사전결제. 로그인+약관은 유지하고 구매/GPS/인스타 유효기간만 건너뜀.
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_pay_event boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN events.is_pay_event IS '페이대회(주최측 사전결제). true면 해당 대회만 구매/GPS로그/인스타 인증 유효기간 체크를 건너뛴다.';
