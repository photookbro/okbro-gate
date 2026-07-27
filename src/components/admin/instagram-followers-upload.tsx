'use client'

import { useState } from 'react'

type UploadResult = {
  summary: string
  total_parsed: number
  new_count: number
  updated_count: number
  file_name: string
}

type InstagramFollowersUploadProps = {
  token: string
}

export function InstagramFollowersUpload({ token }: InstagramFollowersUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<UploadResult | null>(null)

  async function handleUpload() {
    if (!selectedFile) {
      setError('업로드할 HTML 파일을 선택해주세요')
      return
    }

    setUploading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const res = await fetch('/api/admin/instagram-followers', {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '업로드 실패')
        return
      }

      setResult({
        summary: data.summary ?? '',
        total_parsed: data.total_parsed ?? 0,
        new_count: data.new_count ?? 0,
        updated_count: data.updated_count ?? 0,
        file_name: data.file_name ?? selectedFile.name,
      })
      setSelectedFile(null)
    } catch {
      setError('업로드 중 오류가 발생했어요')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        인스타그램 &quot;내 정보 다운로드&quot;의 팔로워 HTML 파일(followers_1.html 등)을 업로드하세요.
        <br />
        대용량 파일(2MB 이상)은 분석·저장에 1~2분 걸릴 수 있어요.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1">
          <span className="label-field">HTML 파일</span>
          <input
            type="file"
            accept=".html,text/html"
            disabled={uploading}
            className="input-field"
            onChange={e => {
              setSelectedFile(e.target.files?.[0] ?? null)
              setError('')
              setResult(null)
            }}
          />
        </label>
        <button
          type="button"
          className="btn-primary-inline shrink-0"
          disabled={uploading || !selectedFile}
          onClick={() => void handleUpload()}
        >
          {uploading ? '분석·저장 중...' : 'UPLOAD'}
        </button>
      </div>

      {selectedFile ? (
        <p className="text-sm text-muted">
          선택: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
        </p>
      ) : null}

      {uploading ? (
        <p className="text-sm text-primary" role="status">
          파일을 분석하고 DB에 저장하는 중이에요. 창을 닫지 마세요.
        </p>
      ) : null}

      {error ? <p className="alert-danger mb-0">{error}</p> : null}

      {result ? (
        <div className="alert-success mb-0">
          <p className="mb-1 font-semibold">{result.summary}</p>
          <p className="mb-0 text-sm">
            파일: {result.file_name}
            <br />
            추출 {result.total_parsed.toLocaleString('ko-KR')}건 · 신규{' '}
            {result.new_count.toLocaleString('ko-KR')}건 · 기존 갱신{' '}
            {result.updated_count.toLocaleString('ko-KR')}건
          </p>
        </div>
      ) : null}
    </div>
  )
}
