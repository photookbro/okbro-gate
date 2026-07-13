const KAKAO_MEMO_SEND_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send'
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token'

let cachedAccessToken: string | null = null

function getAccessToken(): string | null {
  return cachedAccessToken ?? process.env.KAKAO_ACCESS_TOKEN ?? null
}

async function refreshAccessToken(): Promise<string | null> {
  const restApiKey = process.env.KAKAO_REST_API_KEY
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN

  if (!restApiKey || !refreshToken) return null

  try {
    const res = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: restApiKey,
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) {
      console.error('[kakao-notify] token refresh failed:', res.status, await res.text())
      return null
    }

    const data = (await res.json()) as { access_token?: string }
    if (!data.access_token) return null

    cachedAccessToken = data.access_token
    return data.access_token
  } catch (error) {
    console.error('[kakao-notify] token refresh error:', error)
    return null
  }
}

function buildAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://okbro-gate.vercel.app'
}

async function postMemo(accessToken: string, message: string): Promise<Response> {
  const templateObject = {
    object_type: 'text',
    text: message,
    link: {
      web_url: buildAppUrl(),
      mobile_web_url: buildAppUrl(),
    },
  }

  return fetch(KAKAO_MEMO_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ template_object: JSON.stringify(templateObject) }),
  })
}

/**
 * 관리자(Kay) 카카오톡 "나에게 보내기"로 알림 전송.
 * 실패해도 절대 throw하지 않음 — 호출부는 fire-and-forget으로 써야 함 (예: void sendKakaoNotify(...) 또는 next/server의 after()).
 */
export async function sendKakaoNotify(message: string): Promise<void> {
  try {
    const token = getAccessToken()
    if (!token) {
      console.warn('[kakao-notify] skipped (KAKAO_ACCESS_TOKEN 미설정):', message)
      return
    }

    let res = await postMemo(token, message)

    if (res.status === 401) {
      const refreshed = await refreshAccessToken()
      if (!refreshed) {
        console.error('[kakao-notify] 전송 실패: 토큰 만료 + 재발급 불가')
        return
      }
      res = await postMemo(refreshed, message)
    }

    if (!res.ok) {
      console.error('[kakao-notify] 전송 실패:', res.status, await res.text())
    }
  } catch (error) {
    console.error('[kakao-notify] 예외 발생:', error)
  }
}
