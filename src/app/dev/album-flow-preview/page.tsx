'use client'

import { useState } from 'react'
import { AlbumAccessModal } from '@/components/album-access-modal'
import type { VerificationInfo } from '@/lib/order-verification'

const SAMPLE_ALBUM_B = 'https://example.com/album-b'

const PURCHASE_OK: VerificationInfo = {
  status: 'valid',
  access_source: 'purchase',
  purchase_verified: true,
  verified_at: '2025-09-14T00:00:00Z',
  expires_at: '2026-03-14T00:00:00Z',
}

const PURCHASE_NO: VerificationInfo = {
  status: 'none',
  purchase_verified: false,
}

export default function AlbumFlowPreviewPage() {
  const [caseType, setCaseType] = useState<'purchase' | 'no-purchase'>('purchase')
  const [visible, setVisible] = useState(false)

  const verification = caseType === 'purchase' ? PURCHASE_OK : PURCHASE_NO

  return (
    <div className="page-shell">
      <div className="page-container-wide max-w-md space-y-4">
        <p className="text-xs text-muted">Dev preview — 인증 후 앨범 열기 / 미인증 잠금 플로우</p>

        <div className="flex gap-2">
          <button
            type="button"
            className={caseType === 'purchase' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
            onClick={() => setCaseType('purchase')}
          >
            구매 O
          </button>
          <button
            type="button"
            className={caseType === 'no-purchase' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
            onClick={() => setCaseType('no-purchase')}
          >
            구매 X
          </button>
        </div>

        <p className="text-sm text-muted">
          purchase_verified: <strong>{String(verification.purchase_verified === true)}</strong>
        </p>

        <button type="button" className="btn-primary w-full" onClick={() => setVisible(true)}>
          모달 열기 → 앨범 접근 시뮬레이션
        </button>

        <AlbumAccessModal
          visible={visible}
          onClose={() => setVisible(false)}
          verification={verification}
          albumBUrl={SAMPLE_ALBUM_B}
        />
      </div>
    </div>
  )
}
