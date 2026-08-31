'use client'

import Link from 'next/link'
import type { InstagramFollowBonusStatus } from '@/lib/instagram-follow-bonus'
import { INSTAGRAM_HANDLE, INSTAGRAM_LATE_MATCH_NOTICE } from '@/lib/instagram-follow-copy'

type PhotoAccess = {
  purchase_days_remaining: number
  photo_access_days_remaining: number
  purchase_validity_label: string
  status: 'valid' | 'expired' | 'none'
  expiring_soon: boolean
}

type MypageAlbumAccessStatusProps = {
  photoAccess: PhotoAccess | null
  instagramFollowBonus: InstagramFollowBonusStatus | null
}

function formatPhotoAccessDday(daysRemaining: number, status: string): string {
  if (status === 'none' || status === 'expired' || daysRemaining <= 0) return '만료됨'
  if (daysRemaining === 0) return 'D-Day'
  return `D-${daysRemaining}`
}

function ddayClass(status: string, expiringSoon: boolean): string {
  if (status === 'none' || status === 'expired') return 'mypage-dday mypage-dday-muted'
  if (expiringSoon) return 'mypage-dday mypage-dday-danger'
  return 'mypage-dday mypage-dday-success'
}

function FruitAccessRow({ photoAccess }: { photoAccess: PhotoAccess | null }) {
  const status = photoAccess?.status ?? 'none'
  const daysRemaining = photoAccess?.purchase_days_remaining ?? 0
  const validityLabel = photoAccess?.purchase_validity_label ?? '-'
  const isExpiringSoon = photoAccess?.expiring_soon ?? false
  const hasAccess = status === 'valid' && daysRemaining > 0
  const isExpired = status === 'expired'

  return (
    <div className="mypage-access-row">
      <p className="mypage-access-row-label">과일 인증 열람일</p>

      {status === 'none' ? (
        <div className="text-center">
          <p className="mypage-dday mypage-dday-muted mb-0">인증 없음</p>
        </div>
      ) : (
        <div className="text-center">
          <p className={ddayClass(status, isExpiringSoon)}>
            {formatPhotoAccessDday(daysRemaining, status)}
          </p>
          <p className="mypage-status-sub">
            {hasAccess
              ? validityLabel && validityLabel !== '-'
                ? validityLabel
                : `사진 열람 가능: ${daysRemaining}일`
              : '사진 열람 가능: 0일'}
          </p>

          {isExpiringSoon && hasAccess ? (
            <div className="alert-warning mt-4 mb-0">⚠️ 곧 만료</div>
          ) : null}

          {isExpired ? (
            <div className="alert-danger mt-4 mb-0">
              ❌ 만료됨. 주문번호로 다시 인증해주세요
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function FollowerAccessRow({
  instagramFollowBonus,
}: {
  instagramFollowBonus: InstagramFollowBonusStatus | null
}) {
  if (!instagramFollowBonus) return null

  const { state, bonus_days_setting, days_remaining, period_label, instagram_handle } =
    instagramFollowBonus

  if (state === 'expired') {
    return (
      <div className="mypage-access-row">
        <p className="mypage-access-row-label">팔로워 인증 열람일</p>
        <p className="mypage-access-caption-muted mb-0">
          팔로워 인증 열람 기간은 종료되었어요
        </p>
      </div>
    )
  }

  if (state === 'active') {
    return (
      <div className="mypage-access-row">
        <p className="mypage-access-row-label">팔로워 인증 열람일</p>
        <div className="text-center">
          <p className="mb-2 text-sm text-muted">무료 열람 기간</p>
          <p className="mypage-dday mypage-dday-success mb-2">D-{days_remaining ?? 0}</p>
          <p className="mb-0 text-sm text-muted">
            @{instagram_handle}
            {period_label ? ` · ${period_label}` : ''}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mypage-access-row">
      <p className="mypage-access-row-label">팔로워 인증 열람일</p>
      <p className="mb-3 text-sm leading-relaxed text-muted">
        인스타그램(@{INSTAGRAM_HANDLE})을 팔로우하고 계신가요? 팔로워로 확인된 아이디를 알려주시면
        입력할 때마다 {bonus_days_setting}일씩 열람 기간이 늘어나요. 다른 아이디도 추가로
        등록할 수 있어요. (같은 아이디는 중복 사용 불가) {INSTAGRAM_LATE_MATCH_NOTICE}.
      </p>
      {state === 'pending' ? (
        <p className="alert-success mb-4">
          제출 완료! {INSTAGRAM_LATE_MATCH_NOTICE}
        </p>
      ) : null}
      {state === 'not_matched' ? (
        <p className="alert-warning mb-4">
          아직 확인되지 않았어요. {INSTAGRAM_LATE_MATCH_NOTICE} 그 이후 다시 시도해주세요.
        </p>
      ) : null}
      <Link href="/instagram-follow" className="btn-primary-inline inline-flex no-underline">
        팔로워 인증하고 무료로 열람하기
      </Link>
    </div>
  )
}

export function MypageAlbumAccessStatus({
  photoAccess,
  instagramFollowBonus,
}: MypageAlbumAccessStatusProps) {
  return (
    <div className="card mb-4 mypage-status-card">
      <h2 className="section-title">앨범 열람 현황</h2>
      <div className="mypage-access-rows">
        <FruitAccessRow photoAccess={photoAccess} />
        <FollowerAccessRow instagramFollowBonus={instagramFollowBonus} />
      </div>
    </div>
  )
}
