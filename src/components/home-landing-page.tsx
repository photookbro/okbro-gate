'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  HOME_PHOTO_DELIVERED_COUNT,
  daysSinceHomeStart,
  formatHomeCount,
} from '@/lib/home-landing'

export function HomeLandingPage() {
  const [daysSince, setDaysSince] = useState(() => daysSinceHomeStart())

  useEffect(() => {
    setDaysSince(daysSinceHomeStart())
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
            GPS로 촬영 포인트를 자동으로 기록해서, 대회가 끝나면 몇백 장 속에서 내 사진을 뒤질 필요 없이
            바로 찾아드립니다.
          </p>
          <div className="hl-btnrow">
            <Link href="/events" className="hl-btn hl-btn-fill" data-guest-allowed>
              내 대회 찾기
            </Link>
            <a href="#solution" className="hl-btn hl-btn-ghost" data-guest-allowed>
              어떻게 쓰나요
            </a>
          </div>
          <div className="hl-hero-track">
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
                번호를 검색하고, 시간대별로
                <br />
                몇백 장을 스크롤하고...
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
                    {formatHomeCount(HOME_PHOTO_DELIVERED_COUNT)}
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
                알고리즘이 아니라,
                <br />
                사람이 찍습니다
              </h2>
              <p>
                오켱GATE는 익명의 플랫폼이 아니라, 오켱이 직접 코스에 나가 카메라를 들고 찍은 사진으로
                채워집니다. 사진 매칭도, 서비스도 결국 그 현장의 감각에서 시작합니다.
              </p>
              <p>
                질문이 있으면 채팅으로 바로 사람에게 물어보세요. 다음 대회 소식도 사람이 직접 인스타그램으로
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
            <h2 className="hl-display">사진 다음으로 준비한 것들</h2>
          </div>
          <div className="hl-extra-grid hl-extra-grid-single">
            <div className="hl-extra-card hl-extra-card-disabled">
              <div className="hl-extra-tag hl-label">보정 · 개발 중</div>
              <h3>오켱 스타일로, 오켱 프리셋 보정</h3>
              <p>
                서버 전송 없이 이 브라우저 안에서만 처리됩니다. 오켱 스포츠 프리셋을 입혀 원본과 비교해보고,
                고화질로 저장하세요.
              </p>
              <span className="hl-extra-link hl-extra-link-disabled">보정 시작하기 →</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
