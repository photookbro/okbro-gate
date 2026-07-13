# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # next dev --turbopack
npm run build         # next build --turbopack
npm run dev:clean     # rimraf .next && dev (use if a stale .next cache causes weird 500s)
npm run build:clean   # rimraf .next && build
npm run lint          # eslint (flat config: eslint.config.mjs — the root .eslintrc.json is a stale/corrupted leftover ESLint 9 ignores)
npx tsc --noEmit      # typecheck — NOT run by build (see gotcha below), and not wired as an npm script
```

There is no automated test runner or CI. `scripts/test-*.mjs` and `scripts/test-*.ts` are standalone manual check scripts (not a suite) — run individually, e.g. `node scripts/test-gps-pass.mjs` or `npx tsx scripts/test-album-access-flow.ts`. Some hit a live Supabase project via REST, so check the script's header comment before running one.

## Architecture

Next.js App Router app (`src/app`) gating access to Google Drive photo albums for a running-event photography business, using either purchase verification (order number) or GPS geofencing (proof of physically attending) as the access path.

### Two separate, non-interoperating auth systems
- **User auth is Supabase Auth** (Google OAuth via `supabase.auth.signInWithOAuth`, see `src/app/login/page.tsx`), not NextAuth. `src/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts` configure NextAuth's Google provider but nothing in the app calls into it — it's dead code left from an earlier iteration. Don't extend it; add to the Supabase flow instead.
- **Admin auth is a single shared secret**, not a user account: `ADMIN_PASSWORD` env var, sent as the `x-admin-token` header, checked by `verifyAdminToken()` in `src/lib/admin-auth.ts`, stored client-side in `sessionStorage` (`src/lib/admin-auth-client.ts`). `middleware.ts` explicitly skips `/admin` and `/api/admin` — admin routes get zero Supabase session handling.

### Supabase client zoo
Each has a specific reason to exist — don't collapse them:
- `src/lib/supabase/client.ts` — browser client (client components).
- `src/lib/supabase/server.ts` — SSR client for Server Components (cookie `set` is try/caught because Server Components can't set cookies).
- `src/lib/supabase/route-handler-client.ts` — SSR client for Route Handlers (can set cookies on the response).
- `middleware.ts` — its own SSR client, refreshes the session on every non-skipped request.
- `src/lib/supabase.ts` — plain `supabase-js` client (anon) plus `supabaseAdmin()` (service-role key, bypasses RLS) for server-side/admin API routes.
- `src/lib/supabase-rest.ts` — raw REST fetch helper (anon key) used where the JS client is overkill.
- `src/lib/supabase/cookie-options.ts` — on `localhost`/`127.0.0.1`, forces `secure: false` on Supabase's auth cookies (`normalizeSupabaseCookieOptions`), or the auth cookie silently fails to persist over local HTTP.

Auth resolution for API routes (`getAuthenticatedUser` in `src/lib/auth-server.ts`) tries session cookie → session refresh → `Authorization: Bearer <access_token>` header as a last resort. The Bearer fallback exists because the middleware's session refresh has raced client requests before (see commit `570979f`); client code should send the bearer header via `authFetch`/`buildAuthFetchInit` (`src/lib/supabase/auth-client.ts`) for endpoints that need to survive that race.

### Album access decision
`resolveEventAlbumBranch()` (`src/lib/event-album-branch.ts`) picks one of `'b-album' | 'purchase-modal' | 'a-album'`: GPS pass beats purchase verification beats neither. `album_b_url` present on an event is what makes it a "past" event (see `/api/events/list`); events without it are "upcoming."

### GPS geofencing state machine
`src/lib/gps-pass.ts`: enter radius (50m) and exit radius (100m) are deliberately different (hysteresis) so a user sitting near the boundary doesn't spam re-entries. `armedForNextPass` must go false→true via an exit before a second pass counts. `MAX_GPS_PASSES_PER_DAY` (3) only applies to loop-course events (`is_loop_course`); normal events cap at 1/day, enforced again server-side in `POST /api/gps-log`. Events support two independent GPS locations (`location_number` 1/2), each with its own radius; `gps_1_*`/`gps_2_*` columns fall back to legacy `gps_lat`/`gps_lng` when unset.

### Verification expiry
`src/lib/order-verification.ts`: re-verifying before expiry extends from the *existing* `expires_at`, not from now (`calculateNewExpiresAt`). `USER_EXPIRY_WARNING_DAYS` (7, drives the mypage badge and the global expiry modal) and `ADMIN_EXPIRY_SOON_DAYS` (30, admin monitoring only) are intentionally different thresholds — don't unify them.

### Build config ignores type/lint errors
`next.config.ts` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` to `true`, so `npm run build` succeeding is not proof the code typechecks or lints — run `npx tsc --noEmit` and `npm run lint` separately when it matters.

### DB schema
`supabase/schema.sql` is the consolidated reference; `supabase/migrations/*.sql` is the applied history. Several API routes carry legacy-column fallbacks (e.g. `gps_lat`/`gps_lng`, `pass_count`) because production migration state has lagged local schema before — check `supabase/schema.sql` against what an API route expects if a query fails unexpectedly on a specific environment.

## Project history & context

코드만 봐서는 알 수 없는 진행 이력 · 미해결 이슈 · 작업 스타일 메모.

### 프로젝트 개요
마라톤/그란폰도 사진 접근 제어 플랫폼. A앨범(무료 저해상도 공개) / B앨범(구매 인증 후 고해상도) 구조. GPS 지오펜싱으로 촬영 위치 통과 감지 → 앨범 접근 권한 부여.

### 배포/인프라
- GitHub: https://github.com/photookbro/okbro-gate
- 로컬 경로: `C:\dev\okbro-gate` (Windows, PowerShell)
- 배포: https://okbro-gate.vercel.app (Vercel)
- 스택: Next.js 15 (Turbopack), Supabase, Vercel
- Supabase project: https://ucwdxqmkqooxefzcmavh.supabase.co
- `ADMIN_PASSWORD`, 하이패스 비밀번호: 실제 값은 `.env.local` 참고 — 커밋되는 파일에 평문으로 남기지 않음

### DB 스키마 메모
- `events`: `id, name, date, album_a_url, album_b_url, gps_lat, gps_lng, gps_radius_meters, gps_enabled, is_loop_course, gps_2_lat, gps_2_lng, gps_2_radius_meters` (1차/2차 촬영 위치 지원)
- `gps_logs`: `id, user_id, event_id, passed_at, notified`
- `notifications`: `id, title, content, created_at`
- `user_gps_tracking_prefs`: `user_id, event_id, enabled` — 구 `gps_tracking_prefs`에서 rename (마이그레이션 `20260624` 완료)

### GPS 지오펜싱 파이프라인
`watchPosition` (enableHighAccuracy, 15초 timeout) → Haversine 거리 계산 (`src/lib/geo.ts`, R=6371km) → 반경 기본 50m, 이탈 시 히스테리시스(`max(100m, radius×2)`) → `POST /api/gps-log` (로그인 필수, 서버 재검증) → `gps_logs` insert → 앨범 B 접근 권한(`access_source: 'gps'`).

백그라운드 GPS는 Web/PWA 한계로 미지원 — "앱 종료 시 추적 멈춤" 안내를 유지할 것. 추적은 `/events/[id]` 상세 페이지에서만 작동함(목록 페이지 아님). `canUseGps = 로그인 && purchaseVerified && 촬영위치 존재`.

### GPS 토글 (선수용, 영구 저장) — 완료
- 초기값 OFF, 선수가 켜면 `user_gps_tracking_prefs`에 upsert 저장
- 로그아웃/재로그인해도 DB 기준으로 복구 (`useGpsTrackingEnabled`)
- `POST /api/gps-tracking-pref`, `GET /api/gps-tracking-pref?event_id=...`
- 클라이언트: `src/lib/gps-tracking-pref-client.ts` (Bearer 토큰 첨부, 401 시 재시도)

### 어드민 GPS 일괄 OFF — 완료
- 어드민이 대회의 `gps_enabled`를 false로 바꾸면 (`PUT /api/admin/events`) 자동으로 그 대회 모든 선수의 `user_gps_tracking_prefs.enabled=false` 처리
- 헬퍼: `src/lib/user-gps-tracking-prefs-server.ts` → `disableAllUserGpsTrackingPrefsForEvent()`
- 테스트 완료: Supabase SQL + 선수 화면 양쪽에서 OFF 반영 확인됨

### GPS 좌표 선택 도구 (어드민) — 완료
- Leaflet.js + OpenStreetMap (API 키 불필요)
- `src/components/admin/admin-gps-location-map.tsx`
- `src/lib/gps-map-defaults.ts` (서울 기본좌표 37.5665, 126.978)
- 1차/2차 촬영 탭 전환, 클릭으로 마커+좌표 갱신, 현재 위치 버튼
- 기존 대회는 즉시 DB 저장(PUT), 신규 대회는 폼에만 반영 후 "대회 저장" 시 저장

### 인증(Auth) 관련 — 이번에 완전히 수정됨, 재발 주의
1. `/auth/callback` 쿠키 버그: `@supabase/ssr`의 `setAll`이 호출될 때마다 redirect 응답을 새로 만들면 이전 `Set-Cookie`가 사라짐 → 단일 redirect 응답에 쿠키를 누적하는 방식으로 수정 (`src/app/auth/callback/route.ts`, `src/lib/supabase/cookie-options.ts`, `src/lib/supabase/route-handler-client.ts`)
2. localhost에서 `secure:true` 쿠키는 저장 안 됨 → dev 환경 `secure:false` 보정
3. 마이페이지 인증: `resolveClientUser()` (`getUser` → `getSession` → `refreshSession` 순서로 시도), `authFetch()` (Bearer 헤더 + 401시 1회 재시도) — `src/lib/supabase/auth-client.ts`, `src/app/mypage/page.tsx`, `src/components/site-nav.tsx` 전부 이 로직 공유
4. 로컬·Vercel 동시 OAuth 지원: Supabase Dashboard → Authentication → URL Configuration → Redirect URLs에 아래 전부 등록 필요 (Site URL은 Vercel 유지해도 무방):
   - `http://localhost:3000/**`
   - `http://127.0.0.1:3000/**`
   - `https://okbro-gate.vercel.app/**`

   콜백 URL 생성은 `src/lib/app-origin.ts`의 `buildAuthCallbackUrl()`로 중앙화됨(브라우저 `window.location.origin` 기준). `NEXT_PUBLIC_APP_URL` 환경변수는 절대 Vercel 주소로 고정하지 말 것(로컬 로그인이 Vercel로 튕기는 원인이 됨).
5. 미들웨어: `/api` 경로에서도 세션 갱신 수행(`/api/admin`, `/api/auth` 제외), `/auth/callback`은 미들웨어 스킵(콜백 중 세션 간섭 방지)

### 관리자 PWA — 제거 완료
관리자는 Chrome "홈 화면 추가"로 충분히 접근 가능하다고 판단하여 별도 관리자 PWA(manifest, 아이콘, 헤더 컴포넌트, PWA 전용 CSS) 전부 제거함. 다시 만들자는 요청이 없는 한 재도입하지 말 것.

### 공지 시스템 — 완료
- `notifications` 테이블, `GET /api/notifications/latest`, `GET/POST /api/admin/notifications`
- 홈 배너(max-height 50vh, `#FF5500`), ✕닫기(`sessionStorage`), 오늘 그만보기(`localStorage` 24h), 전체보기 → `/notification`

### 아직 미해결 (다음 작업 우선순위)
1. GPS 감지 실측 테스트 실패 — 어드민이 설정한 좌표로 실제 이동해도 `gps_logs` 테이블에 기록이 안 남음. F12 Network 모니터링하며 `POST /api/gps-log` 요청 자체가 나가는지부터 확인 필요.
2. `[notifications/latest]` 로드 시 500 에러 로그 있었음: `"Could not find the table 'public.notifications' in the schema cache"` (PGRST205) — Supabase 스키마 캐시 리프레시 필요할 수 있음, 재현되면 확인.
3. Vercel 배포는 일부러 보류 중 — 로컬에서 완전히 검증 후 배포하기로 함. git push 전에 항상 로컬 테스트 먼저.

### 작업 스타일 (중요)
- Kay는 코딩 초보자. 매우 짧은 메시지로 소통함: "0"=이해/진행/완료, "ㅜ"=실패. 이 스타일 그대로 받아들일 것.
- 기존에 작동하던 코드를 함부로 삭제/변경하지 말 것 — 항상 먼저 확인.
- 단계별로 하나씩 진행 선호. 여러 개를 한 번에 바꾸지 말 것.
- 배포(git push)는 로컬에서 충분히 검증한 뒤에만 진행.
