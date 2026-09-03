export const INSTAGRAM_HANDLE = 'photo_ok_bro'
export const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/photo_ok_bro/'

/** 팔로워 수동 대조 반영 시점 안내 (고정 문구) */
export const INSTAGRAM_LATE_MATCH_NOTICE = '대회 당일 늦은 시간에 확인 후 반영돼요'

export function instagramFollowBenefitLine(bonusDays: number): string {
  return `인스타그램(@${INSTAGRAM_HANDLE})을 팔로우하면 첫 ${bonusDays}일은 인증 없이 앱을 이용할 수 있어요 (${INSTAGRAM_LATE_MATCH_NOTICE})`
}

/** 마이페이지 팔로워 인증 안내 */
export function instagramFollowMypageDescription(bonusDays: number): string {
  return `인스타그램(@${INSTAGRAM_HANDLE})을 팔로우하고 계신가요? 팔로워로 확인된 아이디를 알려주시면, 처음 ${bonusDays}일은 열람할 수 있어요. 다른 아이디도 추가로 등록할 수 있어요. (같은 아이디는 중복 사용 불가) 대회 당일 늦은 시간에 확인 후 반영되니 기다려주세요.`
}

export function instagramFollowSubmitCompleteMessage(): string {
  return `제출 완료! ${INSTAGRAM_LATE_MATCH_NOTICE}`
}

export function instagramFollowApprovedPushBody(bonusDays: number): string {
  return `인스타그램 팔로우가 확인됐어요! ${bonusDays}일 무료 이용이 시작됐어요`
}

export function instagramFollowMismatchPushBody(): string {
  return `인스타그램 팔로우가 확인되지 않았어요. @${INSTAGRAM_HANDLE}를 팔로우하고 다시 인증해주세요`
}

export const INSTAGRAM_BENEFIT_BANNER_DISMISS_KEY = 'okbro_instagram_follow_benefit_banner_dismissed'
