'use client'

import { useState } from 'react'

type EventPhotoUploadProps = {
  token: string
  eventId: string
  photoUrl: string | null
  onChange: (photoUrl: string | null) => void
}

const inputStyle = 'input-field'
const labelStyle = 'label-field'

export function EventPhotoUpload({ token, eventId, photoUrl, onChange }: EventPhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  async function handleUpload() {
    if (!selectedFile) {
      setError('업로드할 사진을 선택해주세요')
      return
    }

    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      // FormData body 는 Content-Type 을 직접 넣지 않음 (boundary 는 브라우저가 붙임)
      const res = await fetch(`/api/admin/events/${eventId}/photo`, {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: formData,
      })

      const raw = await res.text()
      let data: { error?: string; photo_url?: string | null } = {}
      try {
        data = raw ? (JSON.parse(raw) as { error?: string; photo_url?: string | null }) : {}
      } catch {
        setError(
          `사진 업로드 실패 (${res.status}). 서버 응답을 읽지 못했어요. 페이지를 새로고침 후 다시 시도해주세요.`
        )
        return
      }

      if (!res.ok) {
        setError(data.error ?? `사진 업로드 실패 (${res.status})`)
        return
      }

      onChange(data.photo_url ?? null)
      setSelectedFile(null)
    } catch {
      setError('사진 업로드 중 오류가 발생했어요. 네트워크를 확인한 뒤 다시 시도해주세요.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/events/${eventId}/photo`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '사진 삭제 실패')
        return
      }

      onChange(null)
    } catch {
      setError('사진 삭제 중 오류가 발생했어요')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="card-section mb-4">
      <p className="mb-3 text-sm font-semibold text-[var(--text)]">대회 사진</p>
      <p className="mb-3 text-xs text-muted">
        대회 목록에 보여줄 사진 1장 · JPEG, PNG, WEBP · 최대 20MB (서버에서 자동 압축)
      </p>

      {photoUrl ? (
        <div className="mb-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="대회 사진 미리보기"
            className="h-24 w-18 rounded-lg border border-[var(--border)] object-cover"
          />
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="btn-secondary-inline"
          >
            {deleting ? '삭제 중...' : '사진 삭제'}
          </button>
        </div>
      ) : (
        <p className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 text-center text-xs text-muted">
          등록된 사진이 없어요
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="block">
          <span className={`${labelStyle} sr-only`}>사진 선택</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={e => {
              setSelectedFile(e.target.files?.[0] ?? null)
              setError('')
            }}
            className={inputStyle}
          />
        </label>
        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={uploading || !selectedFile}
          className="btn-primary-inline"
        >
          {uploading ? '업로드 중...' : '사진 업로드'}
        </button>
      </div>

      {error && <p className="alert-danger">{error}</p>}
    </div>
  )
}
