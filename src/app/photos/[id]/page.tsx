'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { use } from 'react'

export default function PhotoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [photo, setPhoto] = useState<any>(null)
  const [platform, setPlatform] = useState<'naver' | 'coupang'>('naver')
  const [orderNumber, setOrderNumber] = useState('')
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [unlockCount, setUnlockCount] = useState(0)
  const [justDownloaded, setJustDownloaded] = useState(false)

  useEffect(() => {
    supabase.from('photos').select('*, events(name)').eq('id', id).single()
      .then(({ data }) => setPhoto(data))
  
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
  
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
  
    return () => subscription.unsubscribe()
  }, [id])

  useEffect(() => {
    if (!userId) return
    // 이미 인증했는지 확인
    supabase.from('unlock_records')
      .select('*').eq('user_id', userId).eq('photo_id', id).eq('verified', true).single()
      .then(({ data }) => { if (data) setStatus('success') })
    // 총 인증 횟수 확인
    supabase.from('unlock_records')
      .select('*').eq('user_id', userId).eq('verified', true)
      .then(({ data }) => setUnlockCount(data?.length ?? 0))
  }, [userId, id])

  async function handleVerify() {
    if (!orderNumber.trim()) { setErrorMsg('주문번호를 입력해주세요'); return }
    if (!userId) { setErrorMsg('로그인이 필요해요'); return }
    setStatus('verifying')
    setErrorMsg('')
    const res = await fetch('/api/verify-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_id: id, order_number: orderNumber, platform, user_id: userId }),
    })
    const data = await res.json()
    if (data.success) {
      setStatus('success')
      // 인증 횟수 업데이트
      supabase.from('unlock_records')
        .select('*').eq('user_id', userId).eq('verified', true)
        .then(({ data }) => setUnlockCount(data?.length ?? 0))
    } else {
      setStatus('error')
      setErrorMsg(data.error ?? '인증 실패')
    }
  }

  async function handleDownload() {
    if (!photo?.drive_file_id || photo.drive_file_id === '') {
      alert('아직 원본 파일이 등록되지 않았어요')
      return
    }
    setJustDownloaded(true)
    window.open(`https://drive.google.com/file/d/${photo.drive_file_id}/view`, '_blank')
  }

  if (!photo) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <a href={`/events/${photo.event_id}`} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← 검색 결과로
        </a>

        <div style={{ margin: '1.5rem 0', position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
          <img src={photo.preview_url} alt="" style={{ width: '100%', display: 'block', filter: 'brightness(0.65) blur(1px)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', pointerEvents: 'none' }}>
            {Array(6).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.7rem', fontWeight: 700, transform: 'rotate(-25deg)', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                  오켱GATE
                </span>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '1.5rem 1rem 1rem' }}>
            <div style={{ fontWeight: 600 }}>BIB {photo.bib_number}</div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>{photo.events?.name}</div>
          </div>
        </div>

        {status === 'success' ? (
          <div>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', borderColor: 'var(--green)', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--green)' }}>인증 완료!</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                원본 사진을 다운로드할 수 있어요.
              </div>
              <button className="btn-primary" onClick={handleDownload} style={{ width: '100%', padding: '14px' }}>
                ⬇️ 원본 다운로드
              </button>
            </div>

            {/* 다운로드 후 멘트 */}
            {justDownloaded && (
              <div className="card" style={{ padding: '1.25rem', borderColor: '#f59e0b', background: '#1a1500' }}>
                {unlockCount >= 2 ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎨</div>
                    <p style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#f59e0b' }}>
                      오켱의 보정 찬스를 사용할 수 있어요!
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      인스타그램 DM으로 보정 의뢰해보세요!
                    </p>
                    <a href="https://instagram.com/photo_ok_bro" target="_blank" style={{
                      display: 'inline-block', background: '#f59e0b', color: '#000',
                      padding: '10px 20px', borderRadius: '8px', fontWeight: 700,
                      textDecoration: 'none', fontSize: '0.9rem',
                    }}>
                      📸 @photo_ok_bro DM 하기
                    </a>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🍎</div>
                    <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
                      오켱이 더 힘낼 수 있게 과일 한 번 더 부탁드려요!
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
                      <a href="https://smartstore.naver.com" target="_blank" style={{
                        flex: 1, background: '#03c75a', color: 'white', padding: '10px',
                        borderRadius: '8px', fontWeight: 600, textDecoration: 'none',
                        fontSize: '0.85rem', textAlign: 'center',
                      }}>
                        🟢 네이버 구매
                      </a>
                      <a href="https://coupang.com" target="_blank" style={{
                        flex: 1, background: '#fee500', color: '#333', padding: '10px',
                        borderRadius: '8px', fontWeight: 600, textDecoration: 'none',
                        fontSize: '0.85rem', textAlign: 'center',
                      }}>
                        🟡 쿠팡 구매
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 추가 주문번호 입력 */}
            {!justDownloaded && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  🛒 추가 구매 주문번호가 있으신가요?
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    value={orderNumber}
                    onChange={e => setOrderNumber(e.target.value)}
                    placeholder="추가 주문번호 입력"
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'var(--bg)',
                      color: 'var(--text)', fontSize: '0.9rem', outline: 'none',
                    }}
                  />
                  <button className="btn-primary" onClick={handleVerify}>등록</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>🛒 과일 구매 인증</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              네이버 스마트스토어 또는 쿠팡에서 과일 구매 후<br />주문번호를 입력하면 원본을 받을 수 있어요.
            </p>
            {!userId && (
              <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '10px', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--accent)' }}>
                ⚠️ <a href="/login" style={{ color: 'var(--accent)' }}>로그인</a> 후 인증할 수 있어요
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {(['naver', 'coupang'] as const).map(p => (
                <button key={p} onClick={() => setPlatform(p)} style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid',
                  borderColor: platform === p ? 'var(--accent)' : 'var(--border)',
                  background: platform === p ? 'var(--accent-dim)' : 'transparent',
                  color: platform === p ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                }}>
                  {p === 'naver' ? '🟢 네이버' : '🟡 쿠팡'}
                </button>
              ))}
            </div>
            <input
              value={orderNumber}
              onChange={e => setOrderNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="주문번호 입력"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                border: `1px solid ${errorMsg ? 'var(--accent)' : 'var(--border)'}`,
                background: 'var(--bg)', color: 'var(--text)', fontSize: '0.95rem',
                outline: 'none', marginBottom: '0.5rem',
              }}
            />
            {errorMsg && <p style={{ color: 'var(--accent)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{errorMsg}</p>}
            <button className="btn-primary" onClick={handleVerify} disabled={status === 'verifying'}
              style={{ width: '100%', padding: '12px', opacity: status === 'verifying' ? 0.7 : 1 }}>
              {status === 'verifying' ? '확인 중...' : '인증하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}