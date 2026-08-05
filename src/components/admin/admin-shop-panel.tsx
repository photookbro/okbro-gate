'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  formatWon,
  type ShopProduct,
  type ShopProductCsvRow,
} from '@/lib/shop-products'

type AdminShopPanelProps = {
  token: string
}

export function AdminShopPanel({ token }: AdminShopPanelProps) {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [csvText, setCsvText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<ShopProductCsvRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [previewing, setPreviewing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const headers = useCallback(
    () => ({ 'x-admin-token': token, 'Content-Type': 'application/json' }),
    [token]
  )

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/shop', {
        headers: { 'x-admin-token': token },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '목록 로드 실패')
        return
      }
      setProducts((data.products as ShopProduct[]) ?? [])
      setError('')
    } catch {
      setError('목록 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  async function readCsvContent(): Promise<string | null> {
    if (selectedFile) {
      return selectedFile.text()
    }
    if (csvText.trim()) return csvText
    return null
  }

  async function handlePreview() {
    const text = await readCsvContent()
    if (!text) {
      setError('CSV 파일 또는 텍스트를 입력해주세요')
      return
    }
    setPreviewing(true)
    setError('')
    setUploadMsg('')
    try {
      const res = await fetch('/api/admin/shop', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ preview: true, csv_text: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '미리보기 실패')
        return
      }
      setPreviewRows((data.rows as ShopProductCsvRow[]) ?? [])
      setParseErrors((data.errors as string[]) ?? [])
    } catch {
      setError('미리보기 실패')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleImport() {
    const text = await readCsvContent()
    if (!text) {
      setError('CSV 파일 또는 텍스트를 입력해주세요')
      return
    }
    setUploading(true)
    setError('')
    setUploadMsg('')
    try {
      const res = await fetch('/api/admin/shop', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ csv_text: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '등록 실패')
        return
      }
      setUploadMsg(typeof data.summary === 'string' ? data.summary : '등록 완료')
      setParseErrors((data.parse_errors as string[]) ?? [])
      setPreviewRows([])
      setSelectedFile(null)
      setCsvText('')
      await loadProducts()
    } catch {
      setError('등록 실패')
    } finally {
      setUploading(false)
    }
  }

  async function patchProduct(id: string, patch: { is_active?: boolean; display_order?: number }) {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch('/api/admin/shop', {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ id, ...patch }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '수정 실패')
        return
      }
      const updated = data.product as ShopProduct
      setProducts(prev => {
        const next = prev.map(p => (p.id === id ? updated : p))
        return next.sort(
          (a, b) =>
            a.display_order - b.display_order ||
            b.created_at.localeCompare(a.created_at)
        )
      })
    } catch {
      setError('수정 실패')
    } finally {
      setBusyId(null)
    }
  }

  async function moveOrder(product: ShopProduct, direction: -1 | 1) {
    const sorted = [...products].sort(
      (a, b) =>
        a.display_order - b.display_order || b.created_at.localeCompare(a.created_at)
    )
    const idx = sorted.findIndex(p => p.id === product.id)
    const swapWith = sorted[idx + direction]
    if (!swapWith) return

    const aOrder = product.display_order
    const bOrder = swapWith.display_order
    // 순서가 같으면 강제 차이를 줌
    const nextA = aOrder === bOrder ? aOrder + direction : bOrder
    const nextB = aOrder === bOrder ? bOrder : aOrder

    setBusyId(product.id)
    try {
      await Promise.all([
        fetch('/api/admin/shop', {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ id: product.id, display_order: nextA }),
        }),
        fetch('/api/admin/shop', {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ id: swapWith.id, display_order: nextB }),
        }),
      ])
      await loadProducts()
    } catch {
      setError('순서 변경 실패')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-base font-semibold">CSV 업로드</h3>
        <p className="text-sm text-muted">
          헤더: 상품명, 쇼핑몰, 이미지URL, 정가, 할인가, 제휴링크, 카테고리, 순서
          <br />
          같은 제휴링크면 갱신(upsert), 클릭 수는 유지됩니다.
        </p>

        <label className="block max-w-md">
          <span className="label-field">CSV 파일</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="input-field"
            disabled={uploading || previewing}
            onChange={e => {
              setSelectedFile(e.target.files?.[0] ?? null)
              setPreviewRows([])
              setUploadMsg('')
            }}
          />
        </label>

        <label className="block">
          <span className="label-field">또는 CSV 텍스트 붙여넣기</span>
          <textarea
            className="input-field min-h-[8rem] font-mono text-xs"
            value={csvText}
            disabled={uploading || previewing}
            placeholder={'상품명,쇼핑몰,이미지URL,정가,할인가,제휴링크,카테고리,순서'}
            onChange={e => {
              setCsvText(e.target.value)
              setPreviewRows([])
            }}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary-inline"
            disabled={previewing || uploading}
            onClick={() => void handlePreview()}
          >
            {previewing ? '미리보기 중...' : '미리보기'}
          </button>
          <button
            type="button"
            className="btn-primary-inline"
            disabled={uploading || previewing}
            onClick={() => void handleImport()}
          >
            {uploading ? '등록 중...' : '일괄 등록 (upsert)'}
          </button>
        </div>

        {uploadMsg ? <p className="alert-success mb-0">{uploadMsg}</p> : null}
        {error ? <p className="alert-danger mb-0">{error}</p> : null}
        {parseErrors.length > 0 ? (
          <ul className="text-sm text-muted">
            {parseErrors.slice(0, 10).map(err => (
              <li key={err}>{err}</li>
            ))}
            {parseErrors.length > 10 ? <li>…외 {parseErrors.length - 10}건</li> : null}
          </ul>
        ) : null}

        {previewRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <p className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
              미리보기 {previewRows.length.toLocaleString('ko-KR')}건
            </p>
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="px-3 py-2">상품명</th>
                  <th className="px-3 py-2">쇼핑몰</th>
                  <th className="px-3 py-2">정가</th>
                  <th className="px-3 py-2">할인가</th>
                  <th className="px-3 py-2">순서</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 50).map((row, i) => (
                  <tr key={`${row.affiliate_url}-${i}`} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">{row.product_name}</td>
                    <td className="px-3 py-2">{row.store_name || '-'}</td>
                    <td className="px-3 py-2">{formatWon(row.price_original)}</td>
                    <td className="px-3 py-2">{formatWon(row.price_discount)}</td>
                    <td className="px-3 py-2">{row.display_order}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">등록된 상품</h3>
        {loading ? (
          <p className="text-sm text-muted">로딩 중...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted">등록된 상품이 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-muted">
                  <th className="py-2 pr-2">순서</th>
                  <th className="py-2 pr-2">상품</th>
                  <th className="py-2 pr-2">가격</th>
                  <th className="py-2 pr-2">클릭</th>
                  <th className="py-2 pr-2">ON/OFF</th>
                  <th className="py-2">이동</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        className="input-field w-20 py-1.5 text-sm"
                        defaultValue={p.display_order}
                        key={`${p.id}-${p.display_order}`}
                        disabled={busyId === p.id}
                        onBlur={e => {
                          const next = Number(e.target.value)
                          if (!Number.isFinite(next) || next === p.display_order) return
                          void patchProduct(p.id, { display_order: Math.floor(next) })
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <p className="font-medium">{p.product_name}</p>
                      <p className="text-xs text-muted">
                        {p.store_name || '-'}
                        {p.category ? ` · ${p.category}` : ''}
                      </p>
                    </td>
                    <td className="py-2 pr-2">
                      <span className="text-primary">{formatWon(p.price_discount)}</span>
                      {p.price_original > p.price_discount ? (
                        <span className="ml-2 text-xs text-muted line-through">
                          {formatWon(p.price_original)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">{p.click_count.toLocaleString('ko-KR')}</td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        className={
                          p.is_active ? 'btn-primary-inline px-3 py-1.5 text-xs' : 'btn-secondary-inline px-3 py-1.5 text-xs'
                        }
                        disabled={busyId === p.id}
                        onClick={() => void patchProduct(p.id, { is_active: !p.is_active })}
                      >
                        {p.is_active ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn-secondary-inline px-2 py-1 text-xs"
                          disabled={busyId === p.id}
                          onClick={() => void moveOrder(p, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn-secondary-inline px-2 py-1 text-xs"
                          disabled={busyId === p.id}
                          onClick={() => void moveOrder(p, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
