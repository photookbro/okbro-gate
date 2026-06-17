# okbro-gate 구현 현황 문서

> **목적**: 다른 AI(Claude)와 코드베이스 공유용  
> **프로젝트**: 오켱사진링크게이트 (okbro-gate)  
> **스택**: Next.js 15.5.19 · React 19 · Supabase Auth/DB · NextAuth(Google) · Tailwind CSS 4 · Web Push  
> **작성 기준일**: 2026-06-16  
> **최신 커밋**: `d27b725` (GPS 2중 위치, 포토존 조기 알림, UI 개선) + **로컬 미커밋 변경분** 포함

---

## 1. 구현된 파일 목록

### 1.1 신규 추가된 파일

#### 최신 커밋 (`d27b725`)에서 추가

| 경로 | 주요 내용 |
|------|-----------|
| `src/app/api/admin/gps-logs/route.ts` | 관리자 GPS 로그 조회·수동 추가 |
| `src/app/api/admin/players/route.ts` | 선수 목록/상세 (약관·구매·GPS·추적 설정) |
| `src/app/api/events/list/route.ts` | 과거/예정 대회 분리 목록 + 촬영 기록 |
| `src/app/api/gps-tracking-pref/route.ts` | GPS 추적 ON/OFF 서버 동기화 |
| `src/app/signup/page.tsx` | 회원가입 페이지 |
| `src/app/dev/album-flow-preview/page.tsx` | 앨범 접근 플로우 개발 미리보기 |
| `src/components/a-album-view.tsx` | 저화소 앨범 뷰 |
| `src/components/b-album-view.tsx` | 고화소 앨범 뷰 |
| `src/components/album-a-preview.tsx` | 저화소 앨범 미리보기 |
| `src/components/admin-date-input.tsx` | 관리자 날짜 입력 컴포넌트 |
| `src/components/fixed-fruit-cta.tsx` | 하단 고정 CTA |
| `src/components/gps-tracking-toggle.tsx` | GPS 추적 토글 UI |
| `src/components/push-permission-modal.tsx` | 푸시 권한 요청 모달 |
| `src/lib/admin-players.ts` | 선수 관리 공통 포맷/라벨 |
| `src/lib/date-input.ts` | 날짜 입력 유틸 |
| `src/lib/event-album-branch.ts` | 인증 상태별 앨범 분기 로직 |
| `src/lib/gps-locations.ts` | 1차/2차 GPS 위치 파싱 |
| `src/lib/gps-pass.ts` | 지오펜스 진입/이탈 상태 머신 |
| `src/lib/gps-tracking-storage.ts` | GPS 추적 로컬·서버 저장 |
| `src/lib/push-permission.ts` | 푸시 권한 상태 관리 |
| `src/lib/shoot-record.ts` | 과거 대회 촬영 기록 표시 (`username`, `HH:MM`) |
| `src/lib/time-input.ts` | 관리자 시간 입력 유틸 |
| `supabase/migrations/20250616_gps_tracking_prefs.sql` | `gps_tracking_prefs` 테이블 |
| `supabase/migrations/20250617_gps_logs_pass_count.sql` | `pass_count` 컬럼 |
| `supabase/migrations/20250618_events_loop_course.sql` | `is_loop_course` 컬럼 |
| `supabase/migrations/20250619_dual_gps_locations.sql` | `gps_1_*`, `gps_2_*`, `location_number` |
| `scripts/*` | GPS/앨범/관리자 API 테스트 스크립트 다수 |

#### 로컬 미커밋 (워킹 트리)에서 추가

| 경로 | 주요 내용 |
|------|-----------|
| `src/app/api/admin/event-monitoring/route.ts` | **대회별 모니터링** API (선수×GPS 통과 매트릭스) |
| `src/components/verification-expiry-modal.tsx` | 구매 인증 **7일 이내 만료** 전역 팝업 |
| `scripts/test-event-monitoring-api.mjs` | 대회별 모니터링 API 테스트 |
| `scripts/test-expiry-warning.mjs` | 만료 경고 로직 테스트 |
| `scripts/test-shoot-record.mjs` | 촬영 기록 포맷 테스트 |

#### 이전 커밋에서 추가 (주요)

| 경로 | 주요 내용 |
|------|-----------|
| `src/app/api/gps-log/route.ts` | GPS 통과 기록 GET/POST |
| `src/app/api/gps-notify/route.ts` | 미알림 GPS 로그 푸시 발송 (관리자) |
| `src/app/api/push-subscribe/route.ts` | Web Push 구독 저장 |
| `src/app/api/terms-agree/route.ts` | 약관 동의 저장 |
| `src/app/api/verify-order/route.ts` | 주문번호 구매 인증 |
| `src/app/api/verify-order/status/route.ts` | 인증/GPS 접근 상태 조회 |
| `src/app/api/mypage/route.ts` | 마이페이지 데이터 |
| `src/app/api/admin/events/route.ts` | 대회 CRUD |
| `src/app/api/admin/settings/route.ts` | 공동 인증번호·유효기간 설정 |
| `src/app/api/admin/monitoring/route.ts` | 주문 만료 모니터링 (UI 제거됨, API 잔존) |
| `src/app/api/admin/monitoring/notify/route.ts` | 만료 알림 발송 (UI 제거됨, API 잔존) |
| `src/components/gps-detector.tsx` | 클라이언트 GPS 지오펜싱 |
| `src/components/album-access-modal.tsx` | 앨범 접근 안내 모달 |
| `supabase/migrations/20250610_*.sql` | terms, push, orders expires, GPS 초기 |

---

### 1.2 수정된 파일

#### 로컬 미커밋 변경

| 경로 | 주요 변경사항 |
|------|---------------|
| `src/app/admin/page.tsx` | 대회 관리 HTML 테이블 UI, UUID 컬럼 제거, 1차/2차 GPS 2열 폼, **모니터링 탭 제거**, **대회별 모니터링 탭 추가**, 선수 관리 요약 카드·인증일/만료일/남은기간 컬럼, A/B→저화소/고화소 앨범 명칭 |
| `src/app/api/admin/players/route.ts` | `summary` (가입/약관/구매/GPS) + `verified_at_display`, `expires_at_display`, `days_remaining` |
| `src/app/api/events/list/route.ts` | 과거=고화소 URL+12개월, 예정=고화소 URL 없음, `shoot_record: { username, time }` |
| `src/app/api/mypage/route.ts` | `expiring_soon` 기준 7일 |
| `src/app/api/verify-order/status/route.ts` | `show_expiry_warning` (7일) 추가 |
| `src/app/events/page.tsx` | 과거 대회 촬영 기록 **username·HH:MM** 굵게 표시 |
| `src/app/mypage/page.tsx` | 곧 만료 표시 7일 기준 |
| `src/app/layout.tsx` | `VerificationExpiryModal` 전역 마운트 |
| `src/app/globals.css` | admin-event-table, admin-player 스타일 |
| `src/components/album-access-modal.tsx` | 저화소/고화소 앨범 명칭 |
| `src/components/b-album-view.tsx` | 고화소 앨범 명칭 |
| `src/lib/order-verification.ts` | `USER_EXPIRY_WARNING_DAYS=7`, `isUserExpiringSoon()` |
| `src/lib/shoot-record.ts` | `emailToUsername`, `formatPassTimeMinutes`, `buildPastGpsPassDisplay` |
| `src/lib/album-access.ts` | 고화소 앨범 접근 분기 정리 |
| `src/app/dev/album-flow-preview/page.tsx` | 앨범 명칭 반영 |

#### 최신 커밋에서 주요 수정

| 경로 | 주요 변경사항 |
|------|---------------|
| `src/app/events/[id]/page.tsx` | 대회 상세 + GpsDetector 연동, 앨범 분기 |
| `src/components/gps-detector.tsx` | 2중 GPS, 순환코스 3회/일, 포토존 조기 알림 |
| `src/app/api/gps-log/route.ts` | `location_number`, `pass_count`, 반경 검증 |
| `src/app/api/admin/events/route.ts` | dual GPS 필드, `is_loop_course`, legacy fallback |
| `supabase/schema.sql` | GPS·gps_logs 최종 스키마 통합 |

---

### 1.3 삭제된 파일

| 경로 | 삭제 시점 | 사유 |
|------|-----------|------|
| `src/app/api/bluetooth-pass/route.ts` | `27f4cd9` | BLE → GPS 전환 |
| `src/components/bluetooth-detector.tsx` | `27f4cd9` | BLE 제거 |
| `src/components/platform-notice.tsx` | `27f4cd9` | BLE 제거 |
| `src/lib/bluetooth-platform.ts` | `27f4cd9` | BLE 제거 |
| `src/types/web-bluetooth.d.ts` | `27f4cd9` | BLE 제거 |
| `src/lib/app-install.ts` | `d27b725` | 미사용 |
| `src/app/api/ocr/route.ts` | `724e367` | OCR 기능 중단 |
| `src/app/api/recognize-bib/route.ts` | `724e367` | OCR 기능 중단 |
| `src/app/api/sync-photos/route.ts` | `724e367` | OCR 기능 중단 |
| `public/*.svg` (Next 기본 아이콘) | `aca5b29` | 정리 |

**UI에서 제거 (파일은 잔존)**:
- 관리자 **「모니터링」** 탭 (주문 만료 대시보드) — `src/app/api/admin/monitoring/*` API는 아직 존재

---

## 2. DB 스키마 (최종)

> Supabase PostgreSQL. `auth.users`는 Supabase Auth 관리.  
> 마이그레이션: `supabase/migrations/`, 통합 참조: `supabase/schema.sql`  
> **주의**: 프로덕션 DB에 최신 마이그레이션이 모두 적용되었는지 별도 확인 필요.

### 2.1 `events` — 대회

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | 대회 ID |
| `name` | text | 대회명 |
| `date` | date | 대회 날짜 |
| `album_a_url` | text | **저화소 앨범** Google Drive URL |
| `album_b_url` | text | **고화소 앨범** URL (있으면 "과거 대회") |
| `drive_folder_a` | text | (레거시) 드라이브 폴더 A |
| `drive_folder_b` | text | (레거시) 드라이브 폴더 B |
| `gps_enabled` | boolean | GPS 감지 사용 여부 (default false) |
| `is_loop_course` | boolean | 순환 코스 여부 (true=위치당 하루 3회) |
| `gps_lat` | double precision | (레거시) 1차 위도 — `gps_1_lat` 미설정 시 fallback |
| `gps_lng` | double precision | (레거시) 1차 경도 |
| `gps_radius_meters` | integer | (레거시) 1차 반경 (default 50) |
| `gps_1_lat` | double precision | 1차 촬영 위치 위도 |
| `gps_1_lng` | double precision | 1차 촬영 위치 경도 |
| `gps_1_radius_meters` | integer | 1차 반경 (default 50) |
| `gps_2_lat` | double precision | 2차 촬영 위치 위도 (nullable) |
| `gps_2_lng` | double precision | 2차 촬영 위치 경도 |
| `gps_2_radius_meters` | integer | 2차 반경 (default 50) |
| `created_at` | timestamptz | 생성 시각 |

### 2.2 `orders` — 구매 인증

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | 주문 레코드 ID |
| `user_id` | uuid FK → users | 사용자 |
| `order_number` | text UNIQUE | 네이버 주문번호 또는 공동 인증번호 |
| `platform` | text | 플랫폼 (예: naver) |
| `used_at` | timestamptz | 인증 시각 |
| `created_at` | timestamptz | 생성 시각 |
| `expires_at` | timestamptz | 만료 시각 (재인증 시 연장) |
| `event_id` | uuid FK → events | 연결 대회 (nullable=전체 이용권) |
| `expiry_notified_at` | timestamptz | 만료 알림 발송 시각 |

### 2.3 `gps_logs` — GPS 통과 기록

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | 로그 ID |
| `user_id` | uuid FK → auth.users | 사용자 |
| `event_id` | uuid FK → events | 대회 |
| `passed_at` | timestamptz | 통과 시각 |
| `pass_count` | integer | 당일 해당 위치 N번째 통과 (default 1) |
| `location_number` | integer | 촬영 위치 번호 (1 또는 2, default 1) |
| `notified` | boolean | 푸시 알림 발송 완료 여부 |

**RLS**: 본인 SELECT/INSERT만 허용.

### 2.4 `push_subscriptions` — Web Push 구독

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | 구독 ID |
| `user_id` | uuid FK → auth.users | 사용자 |
| `endpoint` | text | Push endpoint URL |
| `p256dh` | text | 암호화 공개키 |
| `auth` | text | 인증 secret |
| `created_at` | timestamptz | 구독 시각
| UNIQUE | `(user_id, endpoint)` | 중복 방지 |

### 2.5 `terms_agreements` — 약관 동의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | 동의 레코드 ID |
| `user_id` | uuid FK → auth.users | 사용자 |
| `agreed_at` | timestamptz | 동의 시각 |
| `ip_address` | text | IP |
| `user_agent` | text | UA |
| `version` | text | 약관 버전 (default `v1`) |
| UNIQUE | `(user_id, version)` | 버전별 1회 |

### 2.6 `gps_tracking_prefs` — GPS 추적 ON/OFF

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `user_id` | uuid FK | 사용자 (PK 일부) |
| `event_id` | uuid FK | 대회 (PK 일부) |
| `enabled` | boolean | 추적 활성 (default true) |
| `updated_at` | timestamptz | 갱신 시각 |
| PRIMARY KEY | `(user_id, event_id)` | 대회별 설정 |

> `enabled=false`이면 행 삭제. 관리자 선수 상세에서 조회.

### 2.7 `settings` — 앱 설정 (key-value)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `key` | text PK/UNIQUE | 설정 키 |
| `value` | text | 설정 값 |

**사용 키**:

| key | 설명 |
|-----|------|
| `shared_order_number` | 공동 인증번호 (테스트/프로모션용) |
| `verified_period_months` | 일반 주문번호 인증 유효 개월 |
| `shared_order_period_months` | 공동 인증번호 유효 개월 (default 1) |

### 2.8 기타 테이블

| 테이블 | 설명 |
|--------|------|
| `users` | 레거시 사용자 (id, email, phone, purchase_count) — Auth와 병행 |
| `downloads` | 사진 다운로드 기록 (user_id, order_id, photo_id) |
| `photos` | 사진 메타 (mypage 통계에서 참조, GPS 플로우와는 분리) |

---

## 3. API 엔드포인트 (최종)

> **인증**: 사용자 API = Supabase 세션 쿠키. 관리자 API = 헤더 `x-admin-token: {ADMIN_PASSWORD}`.

### 3.1 사용자 API

#### `GET /api/events/list`
- **인증**: 선택 (로그인 시 촬영 기록 포함)
- **반환**:
  ```json
  {
    "past_events": [{ "id", "name", "date", "gps_enabled", "shoot_record": { "username", "time" } | null }],
    "upcoming_events": [{ "id", "name", "date", "gps_enabled", "gps_locations": [...], "is_loop_course" }]
  }
  ```
- **분류 규칙**: 과거 = `album_b_url` 있음 + 12개월 이내 / 예정 = `album_b_url` 없음

#### `GET /api/verify-order/status?event_id={uuid?}`
- **반환**: `{ status, access_source, purchase_verified, gps_passed_at?, order_number?, verified_at?, expires_at?, days_remaining?, show_expiry_warning }`
- GPS 통과 시 `access_source: "gps"`, 구매 유효 시 `"purchase"`

#### `POST /api/verify-order`
- **Body**: `{ order_number, platform, event_id? }`
- **로직**: 공동 인증번호 또는 네이버 주문번호(`YYYY-XXXXXXXX-XXXXXXXX`) 검증, 중복/기간 체크, `expires_at` 연장
- **반환**: `{ success, expires_at, ... }` 또는 `{ error }`

#### `GET /api/gps-log?event_id=`
- **반환**: `{ locations: [{ location_number, pass_count, max_passes, passes[] }], pass_count, max_passes }`

#### `POST /api/gps-log`
- **Body**: `{ event_id, lat, lng, location_number? }`
- **검증**: 반경 내, 일일 횟수 제한 (순환=3, 일반=1)
- **반환**: `{ success, passed_at, pass_count, location_number, passes_today, max_passes, distance_meters, radius_meters }`

#### `POST /api/gps-tracking-pref`
- **Body**: `{ event_id, enabled: boolean }`

#### `POST /api/push-subscribe`
- **Body**: `{ endpoint, keys: { p256dh, auth } }`

#### `GET /api/mypage`
- **반환**: `{ email, latest_verification, verifications[], has_expiring_soon, event_stats[], gps_event_passes[], shoot_records[], formatted }`
- `expiring_soon`: 만료 7일 이내

#### `POST /api/terms-agree`
- **Body**: (없음, IP/UA 자동 수집)
- **반환**: `{ success, agreed_at, version }`

#### `GET /api/download?fileId=`
- **인증**: Supabase 로그인 필수
- Google Drive 파일 프록시 다운로드

#### `GET/POST /api/auth/[...nextauth]`
- NextAuth Google OAuth 핸들러

---

### 3.2 관리자 API

모든 요청에 `x-admin-token` 필요. 실패 시 `401`.

#### `GET/POST/PUT/DELETE /api/admin/events`
- **GET**: `{ events[] }` — dual GPS 필드 포함
- **POST/PUT Body**: `{ name, date, album_a_url, album_b_url, gps_enabled, is_loop_course, gps_1_lat/lng/radius, gps_2_lat/lng/radius }`
- **PUT/DELETE**: `?id={uuid}`

#### `GET/PUT /api/admin/settings`
- **GET**: `{ shared_order_number, verified_period_months, shared_order_period_months }`
- **PUT Body**: 동일 필드

#### `GET /api/admin/players`
- **목록**: `{ players[], summary: { total_signups, terms_agreed, purchase_verified, gps_users } }`
- **상세** `?user_id=`: `{ player: { terms, event_history, tracking_prefs, orders } }`

#### `GET/POST /api/admin/gps-logs?event_id=`
- **GET**: 이벤트별 GPS 로그 (관리자 수동 확인용)
- **POST**: 수동 GPS 로그 추가 (user_id, passed_at, location_number 등)

#### `GET /api/admin/event-monitoring?event_id=` *(미커밋)*
- **반환**: `{ event, rows: [{ player_label, gps_passed, passed_at, pass_count, notified }] }`
- 구매 인증 선수 + GPS 로그 병합

#### `POST /api/gps-notify` *(관리자 토큰)*
- **Body**: `{ event_id }`
- 미알림 GPS 로그에 Web Push 발송, `notified=true` 갱신

#### `GET /api/admin/monitoring` *(UI 제거, API 잔존)*
- 주문 만료 30일 이내 선수 목록

#### `POST /api/admin/monitoring/notify` *(UI 제거, API 잔존)*
- 만료 임박 푸시 일괄 발송

---

## 4. 주요 기능 흐름

### 4.1 로그인 → 이벤트 목록 → 대회 상세 → 앨범 접근

```mermaid
flowchart TD
  A[Google 로그인 /signup] --> B[약관 동의 /api/terms-agree]
  B --> C[/events 대회 목록]
  C --> D{album_b_url 있음?}
  D -->|예, 12개월 이내| E[과거 대회 + 촬영기록 username HH:MM]
  D -->|아니오| F[예정 대회]
  E --> G[/events/id 상세]
  F --> G
  G --> H[/api/verify-order/status]
  H --> I{access_source}
  I -->|gps| J[고화소 앨범 BAlbumView]
  I -->|purchase valid| K[AlbumAccessModal → 고화소]
  I -->|none/expired| L[저화소 앨범 AAlbumView + 인증 유도]
  K --> M[/verify-order 재인증]
  L --> M
```

**앨범 분기** (`resolveEventAlbumBranch`):
- GPS 통과 → `b-album` (고화소)
- 구매 인증 유효 → `purchase-modal`
- 그 외 → `a-album` (저화소)

### 4.2 GPS 지오펜싱 (2개 위치, 순환/일반 코스)

**상수** (`src/lib/gps-pass.ts`):
- 진입 반경: **50m** (`GPS_ENTER_RADIUS_METERS`)
- 이탈 반경: **100m** (`GPS_EXIT_RADIUS_METERS`) — 재武장(re-arm)용
- 순환 코스: 위치당 **하루 3회** (`MAX_GPS_PASSES_PER_DAY`)
- 일반 코스: 위치당 **하루 1회**

**흐름**:
1. 대회 상세에서 `GpsDetector` headless/visible 모드 실행
2. 구매 인증 확인 후 `watchPosition` 시작 (또는 사용자 토글)
3. 1차(`location_number=1`), 2차(`=2`) 각각 독립 상태 머신
4. 반경 진입 + armed → `POST /api/gps-log` (서버에서 재검증)
5. **포토존 조기 알림**: 반경 2배 거리 접근 시 로컬 토스트
6. 통과 시 Web Push (`showPassNotification`) + 앨범 접근 권한 (`access_source: gps`)

**위치 파싱** (`getEventGpsLocations`):
- `gps_1_*` 없으면 레거시 `gps_lat/lng` 사용
- `gps_2_*` 설정 시 2번째 위치 추가

### 4.3 구매 인증 (재인증, 만료 팝업)

**인증** (`POST /api/verify-order`):
- 네이버 주문번호 날짜가 `verified_period_months` 이내
- 또는 공동 인증번호 (`shared_order_number`)
- **재인증**: 기존 `expires_at`이 미래면 그 시점부터 개월 추가 (`calculateNewExpiresAt`)

**만료 경고**:
- **전역 팝업** (`VerificationExpiryModal`): 로그인 + `show_expiry_warning=true` (만료 **7일 이내**), sessionStorage로 세션 내 1회 dismiss
- **마이페이지** `expiring_soon` 배지: 동일 7일 기준
- 관리자 모니터링 API는 **30일** 기준 (`ADMIN_EXPIRY_SOON_DAYS`) — UI 탭은 제거됨

### 4.4 관리자 기능

**접근**: `/admin` — 비밀번호 `ADMIN_PASSWORD` → localStorage 토큰

| 탭 | 기능 |
|----|------|
| **대회 관리** | CRUD, 저화소/고화소 URL, GPS 1차/2차 좌표·반경, 순환코스, GPS 로그 수동 추가/조회 |
| **설정 관리** | 공동 인증번호, 인증 유효 개월, 공동번호 유효 개월 |
| **선수 관리** | 요약 카드 4개, 목록(인증일·만료일·남은기간), 상세(대회별 GPS 슬롯, 주문, 추적 설정) |
| **대회별 모니터링** | 대회 선택 → 선수별 GPS 통과 O/X, 통과 시각, pass_count, notified |

**제거된 탭**: 「모니터링」(주문 만료 대시보드)

---

## 5. 현재 상태

### 5.1 완성도: **약 85~90%**

| 영역 | 상태 | 비고 |
|------|------|------|
| Google 로그인·약관 | ✅ 완료 | |
| 대회 목록/상세 | ✅ 완료 | 12개월·고화소 URL 필터 |
| 저화소/고화소 앨범 | ✅ 완료 | Drive URL 기반 |
| GPS 2중 위치·순환코스 | ✅ 완료 | 클라이언트+서버 검증 |
| 구매 인증·재인증 | ✅ 완료 | |
| 7일 만료 경고 | ✅ 완료 (미커밋) | |
| Web Push | ✅ 구현 | VAPID 키 환경변수 필요 |
| 관리자 4탭 | ✅ 완료 (미커밋) | |
| 프로덕션 배포 동기화 | ⚠️ 불확실 | 구 UI(A앨범, 모니터링 탭) 보고됨 |
| DB 마이그레이션 적용 | ⚠️ 확인 필요 | legacy fallback 코드 다수 존재 |
| OCR/번호판 인식 | ❌ 제거됨 | |
| BLE | ❌ 제거됨 | GPS로 대체 |

### 5.2 미구현 / 정리 필요

1. **미커밋 변경분 커밋·배포** — event-monitoring, expiry modal, admin UI 개선
2. **`/api/admin/monitoring*`** — UI 제거 후 API 정리(삭제 또는 deprecated) 미결정
3. **`photos` / `downloads` 테이블** — mypage 통계용, 앨범 GPS 플로우와 연동 약함
4. **프로덕션 Supabase** — `pass_count`, `location_number`, `gps_1/2_*`, `is_loop_course` 마이그레이션 수동 적용 필요할 수 있음
5. **E2E/자동화 테스트** — scripts/ 수동 테스트만 존재, CI 없음

### 5.3 알려진 이슈

| 이슈 | 원인/해결 |
|------|-----------|
| 로컬 500 / 이상 동작 | `.next` 캐시 손상 → `Remove-Item .next` 후 `npm run build && npm run start` |
| 포트 3000 점유 | 기존 node 프로세스 종료 |
| `pass_count` 컬럼 없음 | migration 미적용 → API legacy fallback 동작 |
| 프로덕션에서 구 UI (A앨범, 모니터링 탭) | 미배포 또는 CDN/브라우저 캐시 |
| `users.name` 없음 | Auth metadata `getUserDisplayName` fallback |
| dev 모드 turbopack 불안정 | production build로 테스트 권장 |

---

## 6. 환경 변수 (참고)

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 Admin API |
| `ADMIN_PASSWORD` | 관리자 `x-admin-token` |
| `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET` | Google OAuth |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| Google Drive API credentials | `/api/download` |

---

## 7. 페이지 라우트 요약

| 경로 | 설명 |
|------|------|
| `/` | 랜딩 |
| `/login` | 로그인 |
| `/signup` | 회원가입 |
| `/events` | 대회 목록 |
| `/events/[id]` | 대회 상세 + GPS + 앨범 |
| `/verify-order` | 구매 인증 |
| `/mypage` | 마이페이지 |
| `/admin` | 관리자 |
| `/photos/[id]` | 사진 상세 (레거시) |
| `/dev/album-flow-preview` | 개발용 앨범 플로우 |
| `/dev/gps-hint-preview` | GPS 힌트 미리보기 |

---

## 8. 디렉터리 구조 (핵심)

```
okbro-gate/
├── src/
│   ├── app/
│   │   ├── admin/page.tsx          # 관리자 UI
│   │   ├── api/                    # REST API (20 routes)
│   │   ├── events/                 # 대회 목록·상세
│   │   ├── mypage/                 # 마이페이지
│   │   └── verify-order/           # 구매 인증
│   ├── components/                 # GPS, 앨범, 모달
│   └── lib/                        # 비즈니스 로직
├── supabase/
│   ├── migrations/                 # 10개 마이그레이션
│   └── schema.sql                  # 통합 스키마
└── scripts/                        # 수동 테스트 스크립트
```

---

*이 문서는 코드베이스 스냅샷 기준이며, 미커밋 변경(`git status` 2026-06-16)을 반영했습니다.*
