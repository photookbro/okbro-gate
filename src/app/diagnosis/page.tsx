'use client'

export default function DiagnosisPage() {
  return (
    <div className="diagnosis-page">
      <iframe
        src="/diagnosis-app.html"
        title="영양 성분 자가진단"
        className="diagnosis-frame"
      />
    </div>
  )
}
