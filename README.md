# 오켱사진링크게이트

마라톤·그란폰도 대회 사진 — 과일 구매 인증 후 원본 다운로드

## 현재 상태: 1단계 뼈대 완성 (목업 데이터)

### 완성된 페이지
| 경로 | 설명 |
|------|------|
| `/` | 홈 랜딩 |
| `/events` | 대회 목록 |
| `/events/[id]` | 대회 상세 + 배번호/이름 검색 |
| `/photos/[id]` | 사진 상세 + 주문번호 인증 + 다운로드 |

### 다음 단계 (순서대로)
- [ ] **2단계**: Supabase 연결 (실제 DB)
- [ ] **3단계**: 구글 OAuth 로그인
- [ ] **4단계**: 구글 드라이브 연동 (원본 다운로드)
- [ ] **5단계**: 주문번호 인증 API
- [ ] **6단계**: 얼굴인식 (Phase 2)
- [ ] **7단계**: GPS/Strava 매칭 (Phase 2)

## 로컬 실행
```bash
cp .env.local.example .env.local
# .env.local 값 채우기
npm run dev
```

## 기술 스택
- Next.js 15 (App Router)
- Tailwind CSS
- Supabase (DB + Auth)
- Google OAuth (NextAuth)
- Google Drive API
