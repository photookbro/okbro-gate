export const ONBOARDING_GUIDE_CONSENT_KEY = 'onboarding_guide_consent'

export const DEFAULT_GUIDE_FONT_SIZE = 16

/** Original hardcoded labels from terms-agreement (pre single-label change). */
export const DEFAULT_GUIDE_CONSENT_LABELS = [
  '링크 공유 금지 및 타인 사진 다운로드 금지에 동의합니다',
  '내용을 확인했습니다',
  '촬영 및 저작권 안내를 확인했습니다',
] as const

export const GUIDE_FONT_SIZE_PRESETS = [
  { value: 14, label: '작게 (14px)' },
  { value: 16, label: '보통 (16px)' },
  { value: 18, label: '크게 (18px)' },
  { value: 20, label: '아주 크게 (20px)' },
  { value: 24, label: '더 크게 (24px)' },
] as const

export const GUIDE_FONT_SIZE_VALUES = GUIDE_FONT_SIZE_PRESETS.map(p => p.value)

/** Fallback markdown when DB row is missing. */
export const ONBOARDING_GUIDE_CONSENT_FALLBACK_TEXT = `## 📌 꼭 지켜주세요

> 🚨 앨범 링크 공유는 엄격히 금지됩니다! 링크를 타인에게 전달하다 적발될 경우 모든 책임은 전달자에게 있으며, 서비스 이용이 즉시 차단됩니다.

- 다른 분 사진을 다운로드하는 것도 안됩니다.
- 모두가 안전하게 사진을 이용할 수 있도록 하기 위한 조치입니다.
- 앨범 링크 무한 전달은 누구나 접근 가능하지만, 사진이 무단으로 사용될 위험이 있습니다.
- 사진을 찍힌 사람들의 개인정보 보호와 악용 방지를 위해서입니다.
- 꼭 좀 지켜주세요. 불편한 일이 만약에 생긴다면, 링크 전달자에게 있습니다.

## 📢 사진값 대신 과일 한 번만요!

- 사진은 무료입니다. 사진값/후원금 안받는 대신 대박과수원 과일 구매로 응원해 주세요! 사진값이 웃돈으로 붙어있지 않고 산지 또는 경매사를 통한 싸고 맛있는 과일입니다.
- 기름값도 안 나오지만 더 좋은 모습 담아드리기 위해 열심히 하고 있어요. 이 프로그램도 혼자 개발하고 비용 지불하고 있어요.
- SNS에 사진 올리실 때 @photo_ok_bro 또는 #대박과수원 #오켕 태그 꼭 부탁드려요!
- 인스타그램 팔로우 & 좋아요 & 댓글 & 리포스트 잊지 말아주세요!
- 인스타그램 채널 구독하시면 출사 예정 장소 공유와 과일 가격 파괴 공유 드려요!
- 🎨 과일 구매 인증샷과 본인 사진(우측 하단에 촬영 시각)을 인스타그램 @photo_ok_bro 로 DM 보내주시면 사진 1장을 정성껏 보정해드려요!

## 📸 촬영 관련 안내

- 📸FREE 사진 Download (by PHOTO OK ?) 📸 @Photo_ok_bro 가 담아낸 소중한 순간을 찾고 계신가요?
- 사진은 공식 대회 촬영 중 찍힌 이미지입니다.
- 행사 주최 측의 촬영 정책을 항상 확인하고 있습니다. 대회 참가 시 촬영 및 미디어 활용 동의 조항이 포함된 것을 확인하고 있습니다.
- 사진 자체를 판매하거나 상업적인 용도로 사용하지 않습니다. 사진 찾아가시라고 알림용으로만 사용하고 있습니다.
- 사진을 사랑하는 과일가게 아저씨입니다! 사진도 담으면서 맛있는 과일도 소개하고자 촬영하고 있습니다.
- 사진은 무보정 고화질 사진(jpg)입니다. 이쁘게 크롭/보정하셔도 됩니다. (워터마크 신경쓰지 마시고!)
- 저의 개인적인 취향으로 앵글은 좀 크게, 화소는 크게, 색은 스탠다드로 담은 이유는 보정을 했을 때 유효하게 한 것입니다.
- 보정을 원하시면 과일 구매 인증샷과 본인 사진(우측 하단에 촬영 시각)을 보내주시면 정성껏 해드리겠습니다.
- 사진 앨범은 업로드 시작 후 구글 클라우드 용량이 다 차면 삭제됩니다. 대략적으로 6개월 뒤 삭제됩니다. 클라우드도 돈이더라구용 ㅠ
- 많은 분을 담으려다 보니 다소 초점이 나간 사진도, 앵글이 맞지 않은 경우가 있습니다. 놓치기 싫어 연사가 대부분인데 눈 감은 사진도 있을 수 있습니다.
- 만여 장이 넘을 때도 있어서 앨범의 사진들은 전수검사 못합니다. 일괄적으로 올림을 알려드립니다.
- 혹시라도 사진이 불편하시다면 인스타그램 DM으로 삭제 요청해 주세요! Dm으로 배번/이름/파일정보 주시면 됩니다.
- 번호와 이름이 정확히 찍혔다면 구글앨범 검색기능 사용 가능합니다.
- 본 약관은 오켕(@photo_ok_bro)의 모든 대회 앨범 이용 시 동일하게 적용됩니다.`

export type GuideContentBlock = {
  text: string
  font_size: number
}

export type AppContentRow = {
  key: string
  content: string
  blocks: GuideContentBlock[]
  consent_label_1: string
  consent_label_2: string
  consent_label_3: string
  updated_at: string | null
}

export function normalizeGuideFontSize(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (GUIDE_FONT_SIZE_VALUES.includes(n as (typeof GUIDE_FONT_SIZE_VALUES)[number])) {
    return n
  }
  return DEFAULT_GUIDE_FONT_SIZE
}

export function normalizeGuideConsentLabel(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

export function normalizeGuideConsentLabels(row: {
  consent_label_1?: unknown
  consent_label_2?: unknown
  consent_label_3?: unknown
}) {
  return {
    consent_label_1: normalizeGuideConsentLabel(row.consent_label_1, DEFAULT_GUIDE_CONSENT_LABELS[0]),
    consent_label_2: normalizeGuideConsentLabel(row.consent_label_2, DEFAULT_GUIDE_CONSENT_LABELS[1]),
    consent_label_3: normalizeGuideConsentLabel(row.consent_label_3, DEFAULT_GUIDE_CONSENT_LABELS[2]),
  }
}

export function createDefaultGuideBlocks(): GuideContentBlock[] {
  return [{ text: ONBOARDING_GUIDE_CONSENT_FALLBACK_TEXT, font_size: DEFAULT_GUIDE_FONT_SIZE }]
}

/** Parse stored content: JSON block array, or legacy plain markdown → one block. */
export function parseGuideContentBlocks(
  content: unknown,
  legacyFontSize?: unknown
): GuideContentBlock[] {
  const fallbackFont = normalizeGuideFontSize(legacyFontSize)

  if (typeof content !== 'string' || !content.trim()) {
    return createDefaultGuideBlocks()
  }

  const trimmed = content.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        const blocks = parsed
          .map(item => {
            if (!item || typeof item !== 'object') return null
            const row = item as { text?: unknown; font_size?: unknown }
            if (typeof row.text !== 'string') return null
            return {
              text: row.text,
              font_size: normalizeGuideFontSize(row.font_size ?? fallbackFont),
            }
          })
          .filter((b): b is GuideContentBlock => b !== null)

        if (blocks.length > 0) return blocks
      }
    } catch {
      // fall through to legacy wrap
    }
  }

  return [{ text: content, font_size: fallbackFont }]
}

export function serializeGuideContentBlocks(blocks: GuideContentBlock[]): string {
  return JSON.stringify(
    blocks.map(block => ({
      text: block.text,
      font_size: normalizeGuideFontSize(block.font_size),
    }))
  )
}

export function validateGuideContentBlocks(
  blocks: unknown
): { ok: true; blocks: GuideContentBlock[] } | { ok: false; error: string } {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { ok: false, error: '본문 블록이 하나 이상 필요해요' }
  }
  if (blocks.length > 50) {
    return { ok: false, error: '블록이 너무 많아요' }
  }

  const normalized: GuideContentBlock[] = []
  let totalChars = 0

  for (const item of blocks) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: '블록 형식이 올바르지 않아요' }
    }
    const row = item as { text?: unknown; font_size?: unknown }
    if (typeof row.text !== 'string') {
      return { ok: false, error: '블록 텍스트가 필요해요' }
    }
    const fontSize = Number(row.font_size)
    if (!GUIDE_FONT_SIZE_VALUES.includes(fontSize as (typeof GUIDE_FONT_SIZE_VALUES)[number])) {
      return { ok: false, error: '폰트 크기가 올바르지 않아요' }
    }
    totalChars += row.text.length
    normalized.push({ text: row.text, font_size: fontSize })
  }

  if (!normalized.some(b => b.text.trim().length > 0)) {
    return { ok: false, error: '내용을 비울 수 없어요' }
  }
  if (totalChars > 100_000) {
    return { ok: false, error: '내용이 너무 길어요' }
  }

  return { ok: true, blocks: normalized }
}

/** @deprecated Use ONBOARDING_GUIDE_CONSENT_FALLBACK_TEXT / createDefaultGuideBlocks */
export const ONBOARDING_GUIDE_CONSENT_FALLBACK = ONBOARDING_GUIDE_CONSENT_FALLBACK_TEXT
