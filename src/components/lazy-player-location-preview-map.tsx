'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { EventsListLocation } from '@/lib/events-list-client'

const PlayerLocationPreviewMap = dynamic(
  () => import('@/components/player-location-preview-map').then(mod => mod.PlayerLocationPreviewMap),
  { ssr: false }
)

type LazyPlayerLocationPreviewMapProps = {
  locations: EventsListLocation[]
}

/** 뷰포트에 들어올 때만 Leaflet 청크·타일 로드 */
export function LazyPlayerLocationPreviewMap({ locations }: LazyPlayerLocationPreviewMapProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const el = rootRef.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px 0px', threshold: 0.01 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  if (locations.length === 0) return null

  return (
    <div ref={rootRef} className="event-upcoming-map">
      {visible ? (
        <PlayerLocationPreviewMap locations={locations} />
      ) : (
        <div className="player-location-preview-map player-location-preview-map-placeholder" aria-hidden="true" />
      )}
    </div>
  )
}
