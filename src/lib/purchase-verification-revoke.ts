import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/web-push-server'
import { INSTAGRAM_HANDLE } from '@/lib/instagram-follow-copy'

export const PURCHASE_REVOKED_MYPAGE_TITLE = '구매 인증이 취소되었습니다'

export const PURCHASE_REVOKED_PUSH_TITLE = 'OKbroGATE'

const PURCHASE_REVOKED_CHECKLIST = [
  '아래 중 하나를 확인해주세요:',
  '① 주문번호를 정확히 입력하셨는지',
  '② 대박과수원 주문인지 (다른 스토어 주문번호는 인증 안 돼요)',
  '③ 최근 주문이라면 반영에 시간이 걸릴 수 있어요, 잠시 후 다시 시도해주세요',
  `궁금하신점이 있으시면 인스타그램(@${INSTAGRAM_HANDLE}) dm으로 문의 주세요`,
].join('\n')

/** 웹푸시 body — 취소 사실 + 안내 */
export const PURCHASE_REVOKED_GUIDE_BODY = [
  '구매 인증이 취소됐어요.',
  PURCHASE_REVOKED_CHECKLIST,
].join('\n')

/** 마이페이지 본문 (제목은 PURCHASE_REVOKED_MYPAGE_TITLE) */
export const PURCHASE_REVOKED_MYPAGE_BODY = PURCHASE_REVOKED_CHECKLIST

export async function markPurchaseVerificationRevoked(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<void> {
  if (!userId) return

  const nowIso = now.toISOString()
  const { data: updated, error: updateError } = await admin
    .from('profiles')
    .update({ purchase_revoked_at: nowIso })
    .eq('user_id', userId)
    .select('user_id')

  if (updateError) {
    if (
      updateError.code === 'PGRST204' ||
      updateError.message?.includes('purchase_revoked_at')
    ) {
      console.error(
        '[purchase-revoke] purchase_revoked_at column missing — run migration 20260910'
      )
      return
    }
    console.error('[purchase-revoke] profile update', updateError)
    return
  }

  if (updated && updated.length > 0) return

  const { error: insertError } = await admin.from('profiles').insert({
    user_id: userId,
    first_created_at: nowIso,
    purchase_revoked_at: nowIso,
  })

  if (insertError && insertError.code === '23505') {
    const { error: retryError } = await admin
      .from('profiles')
      .update({ purchase_revoked_at: nowIso })
      .eq('user_id', userId)
    if (retryError) console.error('[purchase-revoke] profile retry update', retryError)
    return
  }

  if (insertError) {
    console.error('[purchase-revoke] profile insert', insertError)
  }
}

export async function clearPurchaseVerificationRevokedNotice(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  if (!userId) return

  const { error } = await admin
    .from('profiles')
    .update({ purchase_revoked_at: null })
    .eq('user_id', userId)

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('purchase_revoked_at')) {
      return
    }
    console.error('[purchase-revoke] clear notice', error)
  }
}

export async function getPurchaseVerificationRevokedAt(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('purchase_revoked_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    // 컬럼 미적용 환경에서도 mypage가 깨지지 않게
    if (error.code === 'PGRST204' || error.message?.includes('purchase_revoked_at')) {
      return null
    }
    console.error('[purchase-revoke] read notice', error)
    return null
  }

  const value = data?.purchase_revoked_at
  return typeof value === 'string' && value.trim() ? value : null
}

export async function sendPurchaseVerificationRevokedPush(
  userId: string
): Promise<{ sent: number; failed: number; no_subscription: boolean }> {
  const push = await sendPushToUser(userId, {
    title: PURCHASE_REVOKED_PUSH_TITLE,
    body: PURCHASE_REVOKED_GUIDE_BODY,
    url: '/mypage',
  })

  return {
    sent: push.sent,
    failed: push.failed,
    no_subscription: push.sent === 0 && push.failed === 0,
  }
}

/** 마이페이지 플래그 저장 + 웹푸시(구독 시). 푸시 실패해도 취소 자체는 유지. */
export async function notifyPurchaseVerificationRevoked(
  admin: SupabaseClient,
  userId: string
): Promise<{ push_sent: number; push_failed: number; no_subscription: boolean }> {
  await markPurchaseVerificationRevoked(admin, userId)
  const push = await sendPurchaseVerificationRevokedPush(userId)
  return {
    push_sent: push.sent,
    push_failed: push.failed,
    no_subscription: push.no_subscription,
  }
}
