-- 읽기 전용: 같은 인스타 아이디를 신청한 두 계정(대기 신청자 ↔ 이미 승인된 계정) 비교
-- Supabase SQL Editor에서 실행. 데이터는 바꾸지 않음.
-- 같은 사람 신호: same_browser_push(같은 브라우저에서 두 계정 모두 푸시 구독),
--   order_cross_attempt(한쪽이 다른 쪽 주문번호로 인증 시도), 이름·이메일 앞부분이 같음

WITH h(handle) AS (
  VALUES ('sung_jjuu'), ('kimssang__o_o'), ('running_ggoggo'),
         ('anseoig5'), ('hyosub_s'), ('ned_cycling')
),
pairs AS (
  SELECT
    h.handle,
    p.user_id AS pending_user,
    a.user_id AS approved_user,
    p.created_at AS pending_claimed_at,
    p.manually_unlocked AS pending_still_unlocked,
    a.created_at AS approved_claimed_at,
    a.approved_at
  FROM h
  JOIN instagram_follow_bonus p
    ON lower(trim(p.instagram_handle)) = h.handle AND p.status = 'pending'
  JOIN instagram_follow_bonus a
    ON lower(trim(a.instagram_handle)) = h.handle AND a.status = 'approved'
   AND a.user_id <> p.user_id
)
SELECT
  pr.handle,
  pu.email AS pending_email,
  au.email AS approved_email,
  coalesce(pu.raw_user_meta_data->>'full_name', pu.raw_user_meta_data->>'name') AS pending_name,
  coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name') AS approved_name,
  pu.created_at::date AS pending_joined,
  au.created_at::date AS approved_joined,
  pr.pending_claimed_at,
  pr.approved_claimed_at,
  pr.approved_at,
  pr.pending_still_unlocked,
  EXISTS (
    SELECT 1
    FROM push_subscriptions s1
    JOIN push_subscriptions s2 ON s2.endpoint = s1.endpoint
    WHERE s1.user_id = pr.pending_user AND s2.user_id = pr.approved_user
  ) AS same_browser_push,
  EXISTS (
    SELECT 1
    FROM order_verification_attempts t
    JOIN orders o ON o.order_number = t.order_number
    WHERE (t.user_id = pr.pending_user AND o.user_id = pr.approved_user)
       OR (t.user_id = pr.approved_user AND o.user_id = pr.pending_user)
  ) AS order_cross_attempt,
  (SELECT count(*) FROM orders o WHERE o.user_id = pr.pending_user) AS pending_orders,
  (SELECT count(*) FROM orders o WHERE o.user_id = pr.approved_user) AS approved_orders,
  (SELECT count(*) FROM instagram_follow_bonus x
    WHERE x.user_id = pr.pending_user AND x.status = 'approved') AS pending_user_other_approved_ids
FROM pairs pr
JOIN auth.users pu ON pu.id = pr.pending_user
JOIN auth.users au ON au.id = pr.approved_user
ORDER BY pr.handle;
