'use client'

const DISCLOSURE =
  '본 SHOP 페이지의 상품 링크는 크리에이터 활동의 일환으로 구성되었으며, 링크를 통한 구매 발생 시 일정액의 수수료를 제공받습니다.'

export function ShopAffiliateFooter() {
  return (
    <footer className="shop-affiliate-footer" role="contentinfo">
      <p className="shop-affiliate-footer-text">{DISCLOSURE}</p>
      <p className="shop-affiliate-footer-note">
        ※ SHOP 상품 구매는 오켱GATE{' '}
        <span className="shop-affiliate-footer-note-em">앨범 이용 인증과 무관합니다</span>
      </p>
    </footer>
  )
}
