/**
 * OneDrive 공유 링크 → 바이너리 다운로드.
 * 개인 OneDrive(1drv.ms / onedrive.live.com)는 shares API content URL 사용.
 * @see https://learn.microsoft.com/en-us/onedrive/developer/rest-api/api/shares_get
 */

export function encodeOneDriveSharingUrl(sharingUrl: string): string {
  const base64 = Buffer.from(sharingUrl.trim(), 'utf8').toString('base64')
  return (
    'u!' +
    base64
      .replace(/=+$/g, '')
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
  )
}

export function toOneDriveSharesContentUrl(sharingUrl: string): string {
  return `https://api.onedrive.com/v1.0/shares/${encodeOneDriveSharingUrl(sharingUrl)}/root/content`
}

export function isOneDriveShareUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return (
      host === '1drv.ms' ||
      host.endsWith('1drv.ms') ||
      host === 'onedrive.live.com' ||
      host.endsWith('.onedrive.live.com') ||
      host.includes('sharepoint.com')
    )
  } catch {
    return false
  }
}

export type OneDriveDownloadResult = {
  buffer: ArrayBuffer
  finalUrl: string
  contentType: string | null
  fileNameHint: string
}

/**
 * 공유 URL을 받아 파일 bytes를 가져온다.
 * 1) 1drv.ms 단축링크면 Location 리다이렉트를 읽어 실제 공유 URL 확보
 * 2) shares API content URL 시도 (단축/해석 URL 모두)
 * 3) 실패 시 원본 URL redirect follow (+ ?download=1)
 */
export async function downloadOneDriveSharedFile(
  shareUrl: string
): Promise<OneDriveDownloadResult> {
  const trimmed = shareUrl.trim()
  if (!trimmed) {
    throw new Error('ONEDRIVE_SHOP_FILE_URL이 비어 있어요')
  }

  const resolved = await resolveShortOneDriveUrl(trimmed)
  const shareCandidates = [...new Set([resolved, trimmed].filter(Boolean))]

  const candidates: string[] = []
  for (const share of shareCandidates) {
    if (isOneDriveShareUrl(share)) {
      candidates.push(toOneDriveSharesContentUrl(share))
    }
  }
  for (const share of shareCandidates) {
    candidates.push(share)
    if (!/[?&]download=1\b/i.test(share)) {
      candidates.push(share.includes('?') ? `${share}&download=1` : `${share}?download=1`)
    }
  }

  let lastError: Error | null = null

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; OKbroGateShopSync/1.0; +https://okbro-gate.vercel.app)',
          Accept: '*/*',
        },
        cache: 'no-store',
      })

      if (!res.ok) {
        lastError = new Error(`다운로드 실패 HTTP ${res.status} (${url.slice(0, 80)}…)`)
        continue
      }

      const contentType = res.headers.get('content-type')
      if (contentType && contentType.includes('text/html')) {
        lastError = new Error('HTML 미리보기 페이지를 받음 — 직접 다운로드 URL이 아님')
        continue
      }

      const buffer = await res.arrayBuffer()
      if (!buffer.byteLength) {
        lastError = new Error('빈 파일 응답')
        continue
      }

      const disposition = res.headers.get('content-disposition') || ''
      const nameMatch = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition)
      const fileNameHint = nameMatch
        ? decodeURIComponent(nameMatch[1].replace(/"/g, ''))
        : guessFileNameFromUrl(res.url) || guessFileNameFromUrl(trimmed) || 'shop-products.xlsx'

      return {
        buffer,
        finalUrl: res.url,
        contentType,
        fileNameHint,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError ?? new Error('OneDrive 파일 다운로드 실패')
}

/** 1drv.ms 단축 링크의 Location(또는 최종 URL)을 얻는다 */
async function resolveShortOneDriveUrl(url: string): Promise<string> {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host !== '1drv.ms' && !host.endsWith('.1drv.ms')) return url
  } catch {
    return url
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; OKbroGateShopSync/1.0; +https://okbro-gate.vercel.app)',
      },
      cache: 'no-store',
    })
    const location = res.headers.get('location')
    if (location) {
      try {
        return new URL(location, url).toString()
      } catch {
        return location
      }
    }
  } catch {
    // ignore — 단축 URL 그대로 사용
  }

  try {
    const followed = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; OKbroGateShopSync/1.0; +https://okbro-gate.vercel.app)',
      },
      cache: 'no-store',
    })
    if (followed.url && followed.url !== url) return followed.url
  } catch {
    // ignore
  }

  return url
}

function guessFileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname
    const base = path.split('/').pop() || ''
    if (/\.(xlsx|xls|csv)$/i.test(base)) return decodeURIComponent(base)
  } catch {
    // ignore
  }
  return ''
}
