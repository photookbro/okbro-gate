import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏅📸</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
          오켱GATE
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
          마라톤 · 그란폰도 대회 사진
        </p>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '0.85rem' }}>
          🍎 과일 구매 인증 후 원본 다운로드
        </p>

        <Link href="/events" style={{
          display: 'inline-block', background: 'var(--accent)', color: 'white',
          padding: '14px 32px', borderRadius: '10px', fontWeight: 600,
          fontSize: '1rem', textDecoration: 'none', marginBottom: '1.5rem',
        }}>
          대회 사진 찾기 →
        </Link>

        <div style={{ marginTop: '1rem' }}>
          <Link href="/login" style={{
            display: 'inline-block', background: 'white', color: '#333',
            border: '1px solid #ddd', padding: '10px 24px', borderRadius: '8px',
            fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
          }}>
            🔵 구글 로그인
          </Link>
        </div>

        <div style={{ marginTop: '3rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { icon: '🔍', text: '배번호/이름으로 검색' },
            { icon: '👀', text: '워터마크 미리보기' },
            { icon: '🛒', text: '주문번호 인증' },
            { icon: '⬇️', text: '원본 다운로드' },
          ].map(item => (
            <div key={item.text} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{item.icon}</div>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}