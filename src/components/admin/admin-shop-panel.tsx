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

  async function postFile(preview: boolean) {
    if (!selectedFile && !csvText.trim()) {
      setError('엑셀(.xlsx) 파일 또는 CSV를 선택/입력해주세요')
      return null
    }

    if (selectedFile) {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (preview) formData.append('preview', '1')
      return fetch('/api/admin/shop', {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: formData,
      })
    }

    return fetch('/api/admin/shop', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        preview: preview || undefined,
        csv_text: csvText,
      }),
    })
  }

  async function handlePreview() {
    setPreviewing(true)
    setError('')
    setUploadMsg('')
    try {
      const res = await postFile(true)
      if (!res) return
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
    setUploading(true)
    setError('')
    setUploadMsg('')
    try {
      const res = await postFile(false)
      if (!res) return
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

  async function patchProduct(id: string, patch: { is_active?: boolean }) {
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
      setProducts(prev => prev.map(p => (p.id === id ? updated : p)))
    } catch {
      setError('수정 실패')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-base font-semibold">엑셀 / CSV 업로드</h3>
        <p className="text-sm text-muted">
          헤더: 상품명, 쇼핑몰, 이미지URL, 정가, 할인가, 제휴링크, 카테고리
          <br />
          .xlsx 엑셀 파일을 그대로 올려도 돼요. 같은 제휴링크면 갱신(upsert)됩니다.
        </p>

        <label className="block max-w-md">
          <span className="label-field">엑셀(.xlsx) 또는 CSV 파일</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
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
            placeholder={'상품명,쇼핑몰,이미지URL,정가,할인가,제휴링크,카테고리'}
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
                  <th className="px-3 py-2">카테고리</th>
                  <th className="px-3 py-2">정가</th>
                  <th className="px-3 py-2">할인가</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 50).map((row, i) => (
                  <tr key={`${row.affiliate_url}-${i}`} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">{row.product_name}</td>
                    <td className="px-3 py-2">{row.store_name || '-'}</td>
                    <td className="px-3 py-2">{row.category || '-'}</td>
                    <td className="px-3 py-2">{formatWon(row.price_original)}</td>
                    <td className="px-3 py-2">{formatWon(row.price_discount)}</td>
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
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-muted">
                  <th className="py-2 pr-2">상품</th>
                  <th className="py-2 pr-2">가격</th>
                  <th className="py-2 pr-2">클릭</th>
                  <th className="py-2">ON/OFF</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-[var(--border)]">
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
                    <td className="py-2">
                      <button
                        type="button"
                        className={
                          p.is_active
                            ? 'btn-primary-inline px-3 py-1.5 text-xs'
                            : 'btn-secondary-inline px-3 py-1.5 text-xs'
                        }
                        disabled={busyId === p.id}
                        onClick={() => void patchProduct(p.id, { is_active: !p.is_active })}
                      >
                        {p.is_active ? 'ON' : 'OFF'}
                      </button>
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
