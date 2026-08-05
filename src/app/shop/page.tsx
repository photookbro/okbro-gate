'use client'

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { formatWon, type ShopProduct } from '@/lib/shop-products'
import { resolveShopBuyHref } from '@/lib/shop-naver-intent'
import { ShopAffiliateFooter } from '@/components/shop-affiliate-footer'

const ALL_CATEGORY = '전체'

function buildCategoryTabs(products: ShopProduct[]): string[] {
  const seen = new Set<string>()
  const categories: string[] = []
  for (const product of products) {
    const category = product.category?.trim()
    if (!category || seen.has(category)) continue
    seen.add(category)
    categories.push(category)
  }
  categories.sort((a, b) => a.localeCompare(b, 'ko'))
  return [ALL_CATEGORY, ...categories]
}

export default function ShopPage() {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY)
  const [searchQuery, setSearchQuery] = useState('')

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

  const categories = useMemo(() => buildCategoryTabs(products), [products])

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(ALL_CATEGORY)
    }
  }, [categories, activeCategory])

  const trimmedQuery = searchQuery.trim()
  const isSearching = trimmedQuery.length > 0

  const filteredProducts = useMemo(() => {
    if (isSearching) {
      const q = trimmedQuery.toLowerCase()
      return products.filter(p => p.product_name.toLowerCase().includes(q))
    }
    if (activeCategory === ALL_CATEGORY) return products
    return products.filter(p => p.category?.trim() === activeCategory)
  }, [products, activeCategory, isSearching, trimmedQuery])

  const handleBuyClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, product: ShopProduct) => {
      void fetch('/api/shop/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id }),
        keepalive: true,
      }).catch(() => {
        // 이동을 막지 않음
      })

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const resolved = resolveShopBuyHref(product.affiliate_url, ua)
      if (!resolved.sameWindow) return

      e.preventDefault()
      window.location.href = resolved.href
    },
    []
  )

  return (
    <div className="page-shell shop-page">
      <div className="page-container">
        <h1 className="page-title">SHOP</h1>
        <p className="shop-tagline">가성비 장비</p>

        {loading ? <p className="text-muted">불러오는 중...</p> : null}
        {error ? <p className="alert-danger">{error}</p> : null}

        {!loading && !error && products.length === 0 ? (
          <p className="text-muted">등록된 상품이 없어요.</p>
        ) : null}

        {products.length > 0 ? (
          <>
            <div className="shop-category-tabs" role="tablist" aria-label="상품 카테고리">
              {categories.map(category => {
                const selected = !isSearching && category === activeCategory
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={
                      selected ? 'shop-category-tab shop-category-tab-active' : 'shop-category-tab'
                    }
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                )
              })}
            </div>

            <label className="shop-search">
              <input
                type="search"
                className="shop-search-input"
                placeholder="상품명 검색"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
                aria-label="상품명 검색"
              />
            </label>

            {filteredProducts.length === 0 ? (
              <p className="text-muted">
                {isSearching ? '검색 결과가 없어요.' : '이 카테고리에 상품이 없어요.'}
              </p>
            ) : (
              <div className="shop-grid">
                {filteredProducts.map(product => (
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
                        onClick={e => handleBuyClick(e, product)}
                      >
                        구매하러 가기
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}

        <ShopAffiliateFooter />
      </div>
    </div>
  )
}
