export function LandingGuideContent() {
  return (
    <article className="landing-guide-article">
      <div className="landing-guide-logo-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/okbro-logo.png"
          alt="Okbro"
          className="landing-guide-logo"
          width={799}
          height={371}
        />
      </div>

      <header className="landing-guide-hero">
        <h1 className="landing-guide-headline">
          당신의 땀 흘리는 순간,
          <br />
          이제 더 쉽고
          <br />
          완벽하게 마주하세요.
        </h1>
      </header>

      <div className="landing-guide-lede landing-guide-block-right">
        <p>그동안 대회에서 찍힌 자신의 사진을 찾기 위해 얼마나 많은 시간과 노력을 들이셨습니까?</p>
        <p>안면 인식과 배번호 인식의 한계에 부딪혀, 혹은 끝없는 무한 스크롤의 늪에서 지쳐가진 않으셨나요?</p>
      </div>

      <div className="landing-guide-lede landing-guide-block-left">
        <p>
          스포츠 현장의 격렬함 속에서 고글로 인해 얼굴이 가려지거나, 예기치 않게 배번호가 숨겨지더라도 이제
          당신의 소중한 질주를 절대 놓치지 않습니다.
        </p>
        <p>새롭게 도입되는 [오켱] 감지 시스템과 함께라면 가능합니다.</p>
      </div>

      <ol className="landing-guide-features">
        <li className="landing-guide-feature landing-guide-feature--a">
          <strong className="landing-guide-feature-title">간편한 참여 방식</strong>
          <p className="landing-guide-feature-body">
            [오켱]의 출사가 예정된 대회에서, 경기 시작 전 &apos;스위치 ON&apos;, 경기 종료 후 &apos;스위치
            OFF&apos;만 설정해 주세요.
          </p>
        </li>
        <li className="landing-guide-feature landing-guide-feature--b">
          <strong className="landing-guide-feature-title">스마트한 시간 알림</strong>
          <p className="landing-guide-feature-body">
            당신이 [오켱] 작가의 카메라 렌즈 앞(근처)을 통과한 정확한 찰나의 시각을 알림으로 신속하게
            전해드립니다.
          </p>
        </li>
        <li className="landing-guide-feature landing-guide-feature--c">
          <strong className="landing-guide-feature-title">스트레스 없는 다이렉트 검색</strong>
          <p className="landing-guide-feature-body">
            전달받은 가이드 시각을 기반으로 [오켱 앨범]에서 즉시 검색해 보세요. 무한 스크롤의 피로감 없이,
            오직 당신만을 위한 최고의 컷을 곧바로 마주할 수 있습니다. 우측하단에 시각 표시!
          </p>
        </li>
        <li className="landing-guide-feature landing-guide-feature--d">
          <strong className="landing-guide-feature-title">기존과 융합</strong>
          <p className="landing-guide-feature-body">
            기존의 구글앨범의 배번호 인식 시스템에 [오켱 감지 시스템]을 함께 활용하신다면, 당신의 위대한
            레이스는 단 한 순간도 빠짐없이 완벽하게 기록될 것입니다.
          </p>
        </li>
      </ol>

      <p className="landing-guide-closing">
        당신의 열정을
        <br />
        가장 아름답게 담아내기 위해,
        <br />
        기술과 감성으로
        <br />
        늘 함께하겠습니다.
      </p>
    </article>
  )
}
