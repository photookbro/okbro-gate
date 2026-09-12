import { INSTAGRAM_HANDLE } from '@/lib/instagram-follow-copy'

export const PURCHASE_REVOKED_MYPAGE_TITLE = '구매 인증이 취소되었습니다'

export const PURCHASE_REVOKED_PUSH_TITLE = 'OKbroGATE'

const PURCHASE_REVOKED_CHECKLIST = [
  '아래 중 하나를 확인해주세요:',
  '① 주문번호를 정확히 입력하셨는지',
  '② 대박과수원 주문인지 (다른 스토어 주문번호는 인증 안 돼요)',
  '③ 최근 주문이라면 반영에 시간이 걸릴 수 있어요, 잠시 후 다시 시도해주세요',
  '취소 후 다시 인증할 때는 3일 이내 주문이 아니어도 입력할 수 있어요.',
  `궁금하신점이 있으시면 인스타그램(@${INSTAGRAM_HANDLE}) dm으로 문의 주세요`,
].join('\n')

/** 웹푸시 body — 취소 사실 + 안내 */
export const PURCHASE_REVOKED_GUIDE_BODY = [
  '구매 인증이 취소됐어요.',
  PURCHASE_REVOKED_CHECKLIST,
].join('\n')

/** 마이페이지 본문 (제목은 PURCHASE_REVOKED_MYPAGE_TITLE) */
export const PURCHASE_REVOKED_MYPAGE_BODY = PURCHASE_REVOKED_CHECKLIST
