'use client'

import { useEffect, useState } from 'react'
import { saveTermsAgreement } from '@/lib/terms-agreement'

type TermsAgreementProps = {
  visible: boolean
  onComplete: () => void
  onClose?: () => void
  mode?: 'modal' | 'page'
}

type SectionConfig = {
  title: string
  items: string[]
  checkboxLabel: string
  checked: boolean
  onChange: (checked: boolean) => void
  warningBox?: string
}

const sectionBoxStyle: React.CSSProperties = {
  marginBottom: '1rem',
  padding: '1rem',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg)',
}

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.5rem',
  marginTop: '0.75rem',
  cursor: 'pointer',
}

export function TermsAgreement({
  visible,
  onComplete,
  onClose,
  mode = 'modal',
}: TermsAgreementProps) {
  const [section1, setSection1] = useState(false)
  const [section2, setSection2] = useState(false)
  const [section3, setSection3] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (visible) {
      setSection1(false)
      setSection2(false)
      setSection3(false)
      setSubmitError('')
    }
  }, [visible])

  if (!visible) return null

  const allChecked = section1 && section2 && section3
  const isPage = mode === 'page'

  async function handleSubmit() {
    if (!allChecked || submitting) return

    setSubmitting(true)
    setSubmitError('')

    const result = await saveTermsAgreement()

    setSubmitting(false)

    if (!result.success) {
      setSubmitError(result.error ?? '동의 기록 저장 실패')
      return
    }

    onComplete()
  }

  function handleBackdropClick() {
    onClose?.()
  }

  const sections: SectionConfig[] = [
    {
      title: '📌 꼭 지켜주세요',
      warningBox:
        '🚨 앨범 링크 공유는 엄격히 금지됩니다! 링크를 타인에게 전달하다 적발될 경우 모든 책임은 전달자에게 있으며, 서비스 이용이 즉시 차단됩니다.',
      items: [
        '다른 분 사진을 다운로드하는 것도 안됩니다.',
        '모두가 안전하게 사진을 이용할 수 있도록 하기 위한 조치입니다.',
        '앨범 링크 무한 전달은 누구나 접근 가능하지만, 사진이 무단으로 사용될 위험이 있습니다.',
        '사진을 찍힌 사람들의 개인정보 보호와 악용 방지를 위해서입니다.',
        '꼭 좀 지켜주세요. 불편한 일이 만약에 생긴다면, 링크 전달자에게 있습니다.',
      ],
      checkboxLabel: '링크 공유 금지 및 타인 사진 다운로드 금지에 동의합니다',
      checked: section1,
      onChange: setSection1,
    },
    {
      title: '📢 사진값 대신 과일 한 번만요!',
      items: [
        '사진은 무료입니다. 사진값/후원금 안받는 대신 대박과수원 과일 구매로 응원해 주세요! 사진값이 웃돈으로 붙어있지 않고 산지 또는 경매사를 통한 싸고 맛있는 과일입니다.',
        '기름값도 안 나오지만 더 좋은 모습 담아드리기 위해 열심히 하고 있어요. 이 프로그램도 혼자 개발하고 비용 지불하고 있어요.',
        'SNS에 사진 올리실 때 @photo_ok_bro 또는 #대박과수원 #오켱 태그 꼭 부탁드려요!',
        '인스타그램 팔로우 & 좋아요 & 댓글 & 리포스트 잊지 말아주세요!',
        '인스타그램 채널 구독하시면 출사 예정 장소 공유와 과일 가격 파괴 공유 드려요!',
        '🎨 과일 구매 인증샷과 본인 사진(우측 하단에 촬영 시각)을 인스타그램 @photo_ok_bro 로 DM 보내주시면 사진 1장을 정성껏 보정해드려요!',
      ],
      checkboxLabel: '내용을 확인했습니다',
      checked: section2,
      onChange: setSection2,
    },
    {
      title: '📸 촬영 관련 안내',
      items: [
        '📸FREE 사진 Download (by PHOTO OK ?) 📸 @Photo_ok_bro 가 담아낸 소중한 순간을 찾고 계신가요?',
        '사진은 공식 대회 촬영 중 찍힌 이미지입니다.',
        '행사 주최 측의 촬영 정책을 항상 확인하고 있습니다. 대회 참가 시 촬영 및 미디어 활용 동의 조항이 포함된 것을 확인하고 있습니다.',
        '사진 자체를 판매하거나 상업적인 용도로 사용하지 않습니다. 사진 찾아가시라고 알림용으로만 사용하고 있습니다.',
        '사진을 사랑하는 과일가게 아저씨입니다! 사진도 담으면서 맛있는 과일도 소개하고자 촬영하고 있습니다.',
        '사진은 무보정 고화질 사진(jpg)입니다. 이쁘게 크롭/보정하셔도 됩니다. (워터마크 신경쓰지 마시고!)',
        '저의 개인적인 취향으로 앵글은 좀 크게, 화소는 크게, 색은 스탠다드로 담은 이유는 보정을 했을 때 유효하게 한 것입니다.',
        '보정을 원하시면 과일 구매 인증샷과 본인 사진(우측 하단에 촬영 시각)을 보내주시면 정성껏 해드리겠습니다.',
        '사진 앨범은 업로드 시작 후 구글 클라우드 용량이 다 차면 삭제됩니다. 대략적으로 6개월 뒤 삭제됩니다. 클라우드도 돈이더라구용 ㅠ',
        '많은 분을 담으려다 보니 다소 초점이 나간 사진도, 앵글이 맞지 않은 경우가 있습니다. 놓치기 싫어 연사가 대부분인데 눈 감은 사진도 있을 수 있습니다.',
        '만여 장이 넘을 때도 있어서 앨범의 사진들은 전수검사 못합니다. 일괄적으로 올림을 알려드립니다.',
        '혹시라도 사진이 불편하시다면 인스타그램 DM으로 삭제 요청해 주세요! Dm으로 배번/이름/파일정보 주시면 됩니다.',
        '번호와 이름이 정확히 찍혔다면 구글앨범 검색기능 사용 가능합니다.',
        '본 약관은 오켱(@photo_ok_bro)의 모든 대회 앨범 이용 시 동일하게 적용됩니다.',
      ],
      checkboxLabel: '촬영 및 저작권 안내를 확인했습니다',
      checked: section3,
      onChange: setSection3,
    },
  ]

  const content = (
    <>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.35rem' }}>
        이용 안내 및 동의
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
        앨범 이용 전 아래 내용을 확인해 주세요.
      </p>

      {sections.map(section => (
        <div key={section.title} style={sectionBoxStyle}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem' }}>
            {section.title}
          </h3>
          {section.warningBox && (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '1rem',
                borderRadius: '8px',
                border: '2px solid var(--danger)',
                backgroundColor: 'var(--color-danger-bg)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: '#ff6b52',
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}
              >
                {section.warningBox}
              </p>
            </div>
          )}
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.1rem',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
              lineHeight: 1.6,
            }}
          >
            {section.items.map((item, index) => (
              <li key={`${section.title}-${index}`} style={{ marginBottom: '0.25rem' }}>
                {item}
              </li>
            ))}
          </ul>
          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={section.checked}
              onChange={e => section.onChange(e.target.checked)}
              style={{ marginTop: '0.2rem', flexShrink: 0 }}
            />
            <span style={{ color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.5 }}>
              {section.checkboxLabel}
            </span>
          </label>
        </div>
      ))}

      {submitError && (
        <p
          style={{
            color: '#ff6b52',
            fontSize: '0.8rem',
            margin: '0 0 0.75rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: 'var(--color-danger-bg)',
            borderRadius: '6px',
            border: '1px solid var(--color-danger-border)',
          }}
        >
          {submitError}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allChecked || submitting}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: allChecked && !submitting ? 'var(--primary)' : 'var(--disabled)',
          color: '#ffffff',
          fontSize: '0.95rem',
          fontWeight: 600,
          cursor: allChecked && !submitting ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? '저장 중...' : isPage ? '동의하고 계속하기' : '사진 보러가기 →'}
      </button>
    </>
  )

  if (isPage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', padding: '2rem 1rem' }}>
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            padding: '1.5rem',
          }}
        >
          {content}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
          padding: '1.5rem',
        }}
        onClick={e => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )
}
