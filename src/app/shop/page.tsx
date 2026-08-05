'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatWon, type ShopProduct } from '@/lib/shop-products'
import { ShopAffiliateFooter } from '@/components/shop-affiliate-footer'

export default function ShopPage() {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/shop')
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : '상품을 불러오지 못했어요')
          return
        }
        setProducts((data.products as ShopProduct[]) ?? [])
        setError('')
      } catch {
        if (!cancelled) setError('상품을 불러오지 못했어요')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleBuyClick = useCallback((productId: string) => {
    void fetch('/api/shop/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
      keepalive: true,
    }).catch(() => {
      // 새 탭 이동을 막지 않음
    })
  }, [])

  return (
    <div className="page-shell shop-page">
      <div className="page-container">
        <h1 className="page-title">SHOP</h1>
        <p className="page-subtitle mb-6">엄선한 러닝·자전거 장비를 만나보세요</p>

        {loading ? <p className="text-muted">불러오는 중...</p> : null}
        {error ? <p className="alert-danger">{error}</p> : null}

        {!loading && !error && products.length === 0 ? (
          <p className="text-muted">등록된 상품이 없어요.</p>
        ) : null}

        {products.length > 0 ? (
          <div className="shop-grid">
            {products.map(product => (
              <article key={product.id} className="shop-card">
                <div className="shop-card-image-wrap">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 외부 CDN 제휴 이미지
                    <img
                      src={product.image_url}
                      alt={product.product_name}
                      className="shop-card-image"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="shop-card-image-placeholder">NO IMAGE</div>
                  )}
                </div>
                <div className="shop-card-body">
                  {product.store_name ? (
                    <p className="shop-card-store">{product.store_name}</p>
                  ) : null}
                  <h2 className="shop-card-title">{product.product_name}</h2>
                  <div className="shop-card-price">
                    <span className="shop-card-price-discount">
                      {formatWon(product.price_discount || product.price_original)}
                    </span>
                    {product.price_original > product.price_discount &&
                    product.price_discount > 0 ? (
                      <span className="shop-card-price-original">
                        {formatWon(product.price_original)}
                      </span>
                    ) : null}
                  </div>
                  <a
                    href={product.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    data-guest-allowed
                    className="btn-primary shop-card-cta no-underline"
                    onClick={() => handleBuyClick(product.id)}
                  >
                    구매하러 가기
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <ShopAffiliateFooter />
      </div>
    </div>
  )
}
