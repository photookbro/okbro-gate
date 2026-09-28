/**
 * 아이디 제출 직후 처리
 * - unlock: 자동승인(대기 + 임시 열람)
 * - approve: 저장된 최신 팔로워 목록에 있어 바로 승인 확정
 * - pending: 열람 없이 대기만 (다음 팔로워 대조 때 확인)
 */
export type InstagramClaimAutoAction = 'unlock' | 'approve' | 'pending'

export function decideInstagramClaimAutoAction(input: {
  /** instagram_handle_bonus_history 에 확정 기록이 있는 아이디 (재팔로우 반복 방지) */
  handleConsumed: boolean
  /** 불일치·다른 계정 아이디로 자동승인이 회수된 적이 있는 계정 */
  autoUnlockBlocked: boolean
  /** 최신 전체 팔로워 목록 이후 저장된 instagram_followers 에 있는 아이디 */
  inCurrentFollowers: boolean
}): InstagramClaimAutoAction {
  if (input.handleConsumed) return 'pending'
  if (!input.autoUnlockBlocked) return 'unlock'
  return input.inCurrentFollowers ? 'approve' : 'pending'
}
