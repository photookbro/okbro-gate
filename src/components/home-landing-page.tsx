'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  HOME_PHOTO_BASE_COUNT,
  getPhotoDeliveredCount,
  daysSinceHomeStart,
  formatHomeCount,
} from '@/lib/home-landing'

const INSTAGRAM_URL = 'https://www.instagram.com/photo_ok_bro/'

const FAQ_ITEMS = [
  {
    q: '앱을 껐다 켜도 촬영 기록이 이어지나요?',
    a: '아니요. 백그라운드 GPS를 지원하지 않아서, 앱을 완전히 종료하면 기록이 멈춥니다. 화면만 꺼두는 건 괜찮습니다.',
  },
  {
    q: '인증은 꼭 하나만 해야 하나요?',
    a: '구매 인증이 우선적일 수는 있으나, 인스타그램 팔로우를 통해서도 열람 가능 기간을 늘릴 수 있습니다.',
  },
  {
    q: '같은 주문번호를 여러 번 써도 되나요?',
    a: '한 번 사용된 주문번호는 재사용할 수 없습니다. 연장을 원하시면 새 주문번호를 입력해주세요.',
  },
]

export function HomeLandingPage() {
  const [daysSince, setDaysSince] = useState(() => daysSinceHomeStart())
  const [photoCount, setPhotoCount] = useState(HOME_PHOTO_BASE_COUNT)
  const [openFaq, setOpenFaq] = useState(0)

  useEffect(() => {
    setDaysSince(daysSinceHomeStart())

    fetch('/api/events/list')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.past?.length) return
        setPhotoCount(getPhotoDeliveredCount(data.past))
      })
      .catch(() => {})
  }, [])

  return (
    <div className="home-landing">
      <div className="hl-spine" aria-hidden="true" />

      <main className="hl-wrap">
        <section className="hl-hero">
          <div className="hl-eyebrow hl-label">PHOTO OK BRO — SWEAT PHOTOGRAPHER</div>
          <h1 className="hl-display">
            땀 흘리는 순간을,
            <br />
            <span className="hl-accent">가장 가까이서</span>
          </h1>
          <p>
            GPS로 촬영 포인트를 자동으로 기록해서, 대회가 끝나면 몇천 장 속에서 내 사진을 뒤질 필요 없이
            바로 찾아드립니다.
          </p>
          <div className="hl-hero-track" style={{ marginTop: '2rem' }}>
            <div className="hl-checkpoint lit" style={{ left: '8%' }} />
            <div className="hl-checkpoint" style={{ left: '50%' }} />
            <div className="hl-checkpoint" style={{ left: '92%' }} />
          </div>
        </section>

        <section id="problem">
          <div className="hl-kicker hl-label" style={{ textAlign: 'center' }}>
            THE PROBLEM
          </div>
          <div className="hl-section-head">
            <h2 className="hl-display">
              대회 사진, 찾는 게
              <br />
              일이 되어버렸다면
            </h2>
          </div>
          <div className="hl-problem-row">
            <div className="hl-problem-copy">
              <h3>
                가려진 번호표, 구겨진 번호표,
                <br />
                고글까지 썼다면
              </h3>
              <p>
                대회가 끝나면 보통 사진첩 하나에 모든 참가자의 사진이 뒤섞여 올라옵니다. 내 사진 몇 장을
                찾으려고 대회 하나만큼의 시간을 또 쓰는 경험, 오켱GATE는 그 시간을 없애는 데서
                시작했습니다.
              </p>
            </div>
            <div className="hl-stat-card">
              <div className="hl-stat-duo">
                <div className="hl-stat-block">
                  <div className="hl-stat-num">
                    {formatHomeCount(photoCount)}
                    <span>장+</span>
                  </div>
                  <div className="hl-stat-label">선수들에게 전한 추억</div>
                </div>
                <div className="hl-stat-block">
                  <div className="hl-stat-num">
                    {formatHomeCount(daysSince)}
                    <span>일 동안</span>
                  </div>
                </div>
              </div>
              <div className="hl-stat-note">매달 새로운 대회, 새로운 참가자와 함께 늘어납니다</div>
            </div>
          </div>
        </section>

        <hr className="hl-rule" />

        <section id="solution">
          <div className="hl-kicker hl-label" style={{ textAlign: 'center' }}>
            HOW IT WORKS
          </div>
          <div className="hl-section-head">
            <h2 className="hl-display">체크포인트 3개면 끝</h2>
            <p>실제 촬영 지점을 그대로 따라가는 3단계입니다.</p>
          </div>
          <div className="hl-steps">
            <div className="hl-step">
              <div className="hl-step-node">
                <div className="hl-checkpoint lit" />
              </div>
              <div className="hl-step-num">
                CP.01<small>START</small>
              </div>
              <div>
                <h3>Capturing</h3>
                <p>오켱GATE 앱에서 위치 추적을 켜면 촬영 감지 준비가 시작됩니다.</p>
              </div>
            </div>
            <div className="hl-step">
              <div className="hl-step-node">
                <div className="hl-checkpoint lit" />
              </div>
              <div className="hl-step-num">
                CP.02<small>ON COURSE</small>
              </div>
              <div>
                <h3>촬영 포인트를 지나가면</h3>
                <p>진입·이탈을 자동으로 기록해서, 내가 지나간 구간과 사진을 매칭합니다.</p>
              </div>
            </div>
            <div className="hl-step">
              <div className="hl-step-node">
                <div className="hl-checkpoint lit" />
              </div>
              <div className="hl-step-num">
                CP.03<small>FINISH</small>
              </div>
              <div>
                <h3>인증하고 바로 확인</h3>
                <p>구매 인증 · GPS 통과 · 인스타 팔로우, 셋 중 하나면 앨범이 열립니다.</p>
              </div>
            </div>
          </div>
        </section>

        <hr className="hl-rule" />
      </main>

      <div className="hl-diff" id="diff">
        <div className="hl-wrap hl-diff-inner">
          <div className="hl-diff-grid">
            <div className="hl-diff-copy">
              <div className="hl-kicker hl-label">WHY OKBROGATE</div>
              <h2 className="hl-display">
                AI+알고리즘이 아니라,
                <br />
                사람이 찍습니다
              </h2>
              <p>
                오켱GATE는 플랫폼이 아니라, 오켱이 직접 코스에 나가 카메라를 들고 찍은 사진으로
                채워집니다. 사진 매칭도, 서비스도 결국 그 현장의 감각에서 시작합니다.
              </p>
              <p>
                질문이 있으면 채팅으로 바로 오켱에게 물어보세요. 다음 대회 소식도 사람이 직접 인스타그램으로
                전합니다.
              </p>
              <div className="hl-badges">
                <span className="hl-badge">
                  보정 <b>100% 로컬 처리</b>
                </span>
                <span className="hl-badge">
                  1:1 채팅 <b>직접 응대</b>
                </span>
                <span className="hl-badge">
                  SHOP <b>가성비 장비</b>
                </span>
                <span className="hl-badge">
                  진단 <b>영양 자가진단</b>
                </span>
              </div>
            </div>
            <div className="hl-diff-visual">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/home/okbro-shoot.jpg" alt="오켱 촬영 현장" />
              <div className="hl-cap">대회 현장, 오켱이 직접 촬영합니다</div>
            </div>
          </div>
        </div>
      </div>

      <main className="hl-wrap">
        <section>
          <div className="hl-kicker hl-label" style={{ textAlign: 'center' }}>
            MORE THAN PHOTOS
          </div>
          <div className="hl-section-head">
            <h2 className="hl-display">Style UP ↗</h2>
          </div>
          <div className="hl-extra-grid hl-extra-grid-single">
            <div className="hl-extra-card">
              <div className="hl-extra-tag hl-label">보정</div>
              <h3>오켱 스타일로, 오켱 프리셋 보정</h3>
              <p>
                서버 전송 없이 이 브라우저 안에서만 처리됩니다. 오켱 스포츠 프리셋을 입혀 원본과 비교해보고,
                고화질로 저장하세요.
              </p>
              <Link href="/styleup" className="hl-extra-link">
                보정 시작하기 →
              </Link>
            </div>
          </div>
        </section>

        <hr className="hl-rule" />

        <section id="faq">
          <div className="hl-kicker hl-label" style={{ textAlign: 'center' }}>
            FAQ
          </div>
          <div className="hl-section-head">
            <h2 className="hl-display">자주 묻는 질문</h2>
          </div>
          <div className="hl-faq">
            {FAQ_ITEMS.map((item, index) => {
              const open = openFaq === index
              return (
                <div key={item.q} className={`hl-faq-item${open ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="hl-faq-q"
                    aria-expanded={open}
                    data-guest-allowed
                    onClick={() => setOpenFaq(open ? -1 : index)}
                  >
                    {item.q} <span className="hl-plus">+</span>
                  </button>
                  <div className="hl-faq-a">{item.a}</div>
                </div>
              )
            })}
          </div>
        </section>

        <hr className="hl-rule" />

        <section className="hl-closing">
          <div className="hl-kicker hl-label">GET STARTED</div>
          <h2 className="hl-display">다음 대회, 오켱GATE와 함께</h2>
          <p>지금 팔로우하고 다음 대회 소식을 가장 먼저 받아보세요.</p>
        </section>
      </main>

      <footer className="hl-footer">
        <div className="hl-wrap">
          <div className="hl-foot-grid">
            <div className="hl-foot-brand">
              <div className="hl-logo">
                <span>OKbro</span>GATE
              </div>
              <p>땀 흘리는 순간을 가장 가까이서 담는, 오켱의 대회 사진 서비스.</p>
            </div>
            <div className="hl-foot-links">
              <div className="hl-foot-col">
                <h4 className="hl-label">SERVICE</h4>
                <a href="#solution" data-guest-allowed>
                  이용 방법
                </a>
                <Link href="/shop" data-guest-allowed>
                  SHOP
                </Link>
                <Link href="/diagnosis" data-guest-allowed>
                  진단
                </Link>
              </div>
              <div className="hl-foot-col">
                <h4 className="hl-label">SUPPORT</h4>
                <a href="#faq" data-guest-allowed>
                  FAQ
                </a>
                <Link href="/mypage#chat">1:1 문의</Link>
                <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" data-guest-allowed>
                  인스타그램
                </a>
              </div>
            </div>
          </div>
          <div className="hl-foot-bottom">
            <div>© 2026 OKbroGATE. All rights reserved.</div>
            <div>PHOTO OK BRO — Sweat Photographer</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
