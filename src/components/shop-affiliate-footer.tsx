'use client'

const DISCLOSURE =
  '이 페이지의 일부 링크는 제휴 마케팅 링크이며, 이를 통해 구매가 이루어질 경우 운영자가 일정액의 수수료를 제공받을 수 있습니다. 상품 판매·배송·AS 및 환불은 각 쇼핑몰의 책임이며, OKbro GATE는 중개 플랫폼이 아닙니다.'

export function ShopAffiliateFooter() {
  return (
    <footer className="shop-affiliate-footer" role="contentinfo">
      <p className="shop-affiliate-footer-text">{DISCLOSURE}</p>
    </footer>
  )
}
