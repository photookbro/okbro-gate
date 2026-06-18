const STEPS = [
  { num: 1, icon: '🏃', label: '앱 켜기' },
  { num: 2, icon: '📍', label: '촬영 감지 ON' },
  { num: 3, icon: '🎬', label: '촬영자 근처 통과' },
  { num: 4, icon: '⏰', label: '시각 자동 수신' },
  { num: 5, icon: '🖼️', label: '사진 쉽게 찾기' },
] as const

const STEP_GAP = 72
const SVG_WIDTH = 56 + STEPS.length * STEP_GAP

function wrapLabel(label: string, maxLen: number): string[] {
  if (label.length <= maxLen) return [label]
  const mid = Math.ceil(label.length / 2)
  const space = label.lastIndexOf(' ', mid + 2)
  if (space > 0) {
    return [label.slice(0, space), label.slice(space + 1)]
  }
  return [label.slice(0, mid), label.slice(mid)]
}

export function GpsHintInfographic() {
  return (
    <div
      className="gps-hint-infographic-wrap overflow-x-auto"
      role="img"
      aria-label="지오펜싱 사용법: 앱 켜기, 촬영 감지 ON, 촬영자 근처 통과, 시각 자동 수신, 사진 쉽게 찾기"
    >
      <svg
        viewBox={`0 0 ${SVG_WIDTH} 96`}
        className="mx-auto h-auto w-full max-w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="gps-hint-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#FF5500" />
          </marker>
        </defs>

        {STEPS.map((step, index) => {
          const cx = 52 + index * STEP_GAP
          const lines = wrapLabel(step.label, 7)

          return (
            <g key={step.label}>
              <circle
                cx={cx}
                cy={30}
                r={24}
                fill="#eff6ff"
                stroke="#FF5500"
                strokeWidth="2"
              />
              <text x={cx} y={36} textAnchor="middle" fontSize="18">
                {step.icon}
              </text>
              <text
                x={cx - 20}
                y={22}
                fontSize="9"
                fontWeight="700"
                fill="#FF5500"
              >
                {step.num}
              </text>
              {lines.map((line, lineIndex) => (
                <text
                  key={line}
                  x={cx}
                  y={68 + lineIndex * 11}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill="#1f2937"
                >
                  {line}
                </text>
              ))}

              {index < STEPS.length - 1 && (
                <line
                  x1={cx + 26}
                  y1={30}
                  x2={cx + STEP_GAP - 26}
                  y2={30}
                  stroke="#FF5500"
                  strokeWidth="2"
                  markerEnd="url(#gps-hint-arrow)"
                  opacity="0.85"
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
