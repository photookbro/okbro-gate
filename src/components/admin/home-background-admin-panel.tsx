'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildHomeBackgroundPositionCSSValue,
  DEFAULT_HOME_BACKGROUND_POSITION,
  type HomeBackgroundPosition,
} from '@/lib/home-background'

type HomeBackgroundPositionEditorProps = {
  imageUrl: string
  position: HomeBackgroundPosition
  onPositionChange: (position: HomeBackgroundPosition) => void
  onSave: () => void | Promise<void>
  onReset: () => void
  saving?: boolean
  isDirty?: boolean
}

export function HomeBackgroundPositionEditor({
  imageUrl,
  position,
  onPositionChange,
  onSave,
  onReset,
  saving = false,
  isDirty = false,
}: HomeBackgroundPositionEditorProps) {
  const draggingRef = useRef(false)
  const dragOriginRef = useRef({ pointerX: 0, pointerY: 0, offsetX: 0, offsetY: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true
      setIsDragging(true)
      dragOriginRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: position.x,
        offsetY: position.y,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [position.x, position.y]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return

      const deltaX = event.clientX - dragOriginRef.current.pointerX
      const deltaY = event.clientY - dragOriginRef.current.pointerY

      onPositionChange({
        x: dragOriginRef.current.offsetX + deltaX,
        y: dragOriginRef.current.offsetY + deltaY,
      })
    },
    [onPositionChange]
  )

  const stopDragging = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  return (
    <section className="home-background-position-editor">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">위치 조정</h3>
        <p className="mt-1 text-xs text-muted">
          미리보기를 드래그해서 얼굴이나 중요한 부분이 잘리지 않게 맞춰주세요.
        </p>
      </div>

      <div
        className={`home-background-preview landing-hero home-background-preview-draggable${
          isDragging ? ' home-background-preview-dragging' : ''
        }`}
        style={{
          backgroundImage: `url("${imageUrl}")`,
          backgroundPosition: buildHomeBackgroundPositionCSSValue(position),
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        role="img"
        aria-label="홈 배경 이미지 위치 미리보기"
      >
        <div className="landing-hero-overlay" aria-hidden="true" />
        <p className="home-background-preview-hint">드래그해서 위치 조정</p>
      </div>

      <p className="mt-2 text-xs text-muted">
        offset X {position.x}px · offset Y {position.y}px
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onReset} className="btn-secondary-inline">
          초기화
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || !isDirty}
          className="btn-primary-inline"
        >
          {saving ? '저장 중...' : '위치 저장'}
        </button>
      </div>
    </section>
  )
}

type HomeBackgroundAdminPanelProps = {
  token: string
}

const inputStyle = 'input-field'
const labelStyle = 'label-field'

export function HomeBackgroundAdminPanel({ token }: HomeBackgroundAdminPanelProps) {
  const [imageUrl, setImageUrl] = useState('')
  const [isDefault, setIsDefault] = useState(true)
  const [position, setPosition] = useState<HomeBackgroundPosition>(DEFAULT_HOME_BACKGROUND_POSITION)
  const [savedPosition, setSavedPosition] = useState<HomeBackgroundPosition>(
    DEFAULT_HOME_BACKGROUND_POSITION
  )
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [savingPosition, setSavingPosition] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const isPositionDirty = useMemo(
    () => position.x !== savedPosition.x || position.y !== savedPosition.y,
    [position, savedPosition]
  )

  const loadBackground = useCallback(async () => {
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/home-background', {
      headers: { 'x-admin-token': token },
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? '홈 배경 이미지를 불러오지 못했어요')
      return
    }

    setImageUrl(data.image_url ?? '')
    setIsDefault(data.is_default === true)

    const nextPosition = {
      x: Number(data.offset_x ?? data.position?.x ?? 0),
      y: Number(data.offset_y ?? data.position?.y ?? 0),
    }
    setPosition(nextPosition)
    setSavedPosition(nextPosition)
  }, [token])

  useEffect(() => {
    void loadBackground()
  }, [loadBackground])

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedFile) {
      setError('업로드할 이미지를 선택해주세요')
      return
    }

    setUploading(true)
    setError('')
    setMessage('')

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const res = await fetch('/api/admin/home-background', {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '이미지 업로드 실패')
        return
      }

      setImageUrl(data.image_url ?? '')
      setIsDefault(false)
      setSelectedFile(null)
      setPosition(DEFAULT_HOME_BACKGROUND_POSITION)
      setSavedPosition(DEFAULT_HOME_BACKGROUND_POSITION)

      const storedKb = typeof data.stored_bytes === 'number' ? Math.ceil(data.stored_bytes / 1024) : null
      setMessage(
        storedKb != null
          ? `홈 배경 이미지가 업로드됐어요 (${storedKb}KB WebP로 저장됨). 위치를 조정한 뒤 저장해주세요.`
          : '홈 배경 이미지가 업로드됐어요. 위치를 조정한 뒤 저장해주세요.'
      )
    } catch {
      setError('이미지 업로드 중 오류가 발생했어요')
    } finally {
      setUploading(false)
    }
  }

  async function handleSavePosition() {
    setSavingPosition(true)
    setError('')
    setMessage('')

    try {
      const res = await fetch('/api/admin/home-background', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({
          offset_x: position.x,
          offset_y: position.y,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '배경 위치 저장 실패')
        return
      }

      const nextPosition = {
        x: Number(data.offset_x ?? data.position?.x ?? position.x),
        y: Number(data.offset_y ?? data.position?.y ?? position.y),
      }
      setPosition(nextPosition)
      setSavedPosition(nextPosition)
      setMessage('배경 이미지 위치가 저장됐어요')
    } catch {
      setError('배경 위치 저장 중 오류가 발생했어요')
    } finally {
      setSavingPosition(false)
    }
  }

  function handleResetPosition() {
    setPosition({ ...DEFAULT_HOME_BACKGROUND_POSITION })
  }

  if (loading) {
    return <p className="text-muted">로딩 중...</p>
  }

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted">
        랜딩 페이지 전체 배경 이미지를 업로드할 수 있어요. JPEG, PNG, WEBP · 최대 20MB (서버에서 2MB
        이하 WebP로 자동 압축)
      </p>

      {imageUrl ? (
        <HomeBackgroundPositionEditor
          imageUrl={imageUrl}
          position={position}
          onPositionChange={setPosition}
          onSave={handleSavePosition}
          onReset={handleResetPosition}
          saving={savingPosition}
          isDirty={isPositionDirty}
        />
      ) : (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-8 text-center text-sm text-muted">
          등록된 이미지가 없어요
        </p>
      )}

      <form onSubmit={handleUpload} className="max-w-xl">
        <p className="mb-4 text-sm text-muted">
          {isDefault ? '현재 기본 이미지를 사용 중이에요' : '현재 업로드된 이미지를 사용 중이에요'}
        </p>

        <label className="mb-4 block">
          <span className={labelStyle}>새 이미지 선택</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={event => {
              setSelectedFile(event.target.files?.[0] ?? null)
              setError('')
              setMessage('')
            }}
            className={inputStyle}
          />
        </label>

        {error && <p className="alert-danger">{error}</p>}
        {message && <p className="alert-success">{message}</p>}

        <button
          type="submit"
          disabled={uploading || !selectedFile}
          className="btn-primary-inline"
        >
          {uploading ? '업로드 중...' : '이미지 업로드'}
        </button>
      </form>
    </div>
  )
}
