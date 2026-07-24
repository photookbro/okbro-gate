'use client'

import { useId, useState } from 'react'

const GUIDE_IMAGE_SRC = '/guide/order-number-guide.jpg'

const GUIDE_DESCRIPTION =
  "네이버 스마트스토어 주문/배송내역에서 대박과수원 구매 과일을 선택해 주세요. 중간에 있는 '상품주문번호'를 입력하시면 되고, 우측 '복사'를 누르면 자동으로 복사되니 화면에 그대로 붙여 넣어주시면 됩니다."

type OrderNumberGuideProps = {
  className?: string
}

export function OrderNumberGuide({ className = '' }: OrderNumberGuideProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className={`order-number-guide ${className}`.trim()}>
      <button
        type="button"
        className="order-number-guide-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(prev => !prev)}
      >
        {open ? '안내 닫기' : '주문번호, 어디서 찾나요?'}
      </button>

      {open ? (
        <div id={panelId} className="order-number-guide-panel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={GUIDE_IMAGE_SRC}
            alt="네이버 스마트스토어 주문내역에서 상품주문번호와 복사 버튼 위치 예시"
            className="order-number-guide-image"
          />
          <p className="order-number-guide-text">{GUIDE_DESCRIPTION}</p>
        </div>
      ) : null}
    </div>
  )
}
