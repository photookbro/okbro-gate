'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { EventsListLocation } from '@/lib/events-list-client'

const previewIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type PlayerLocationPreviewMapProps = {
  locations: EventsListLocation[]
}

/** 선수용 읽기 전용 촬영 위치 미리보기 지도 — 클릭/저장 없음, 마커만 표시 */
export function PlayerLocationPreviewMap({ locations }: PlayerLocationPreviewMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || locations.length === 0) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const markers = locations.map(location => {
      const label = locations.length > 1 ? `${location.location_number}차 촬영 위치` : '촬영 위치'
      return L.marker([location.lat, location.lng], { icon: previewIcon })
        .addTo(map)
        .bindPopup(label)
    })

    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 17)
    } else {
      const bounds = L.latLngBounds(locations.map(location => [location.lat, location.lng]))
      map.fitBounds(bounds, { padding: [32, 32] })
    }

    mapRef.current = map

    const timer = window.setTimeout(() => map.invalidateSize(), 100)

    return () => {
      window.clearTimeout(timer)
      markers.forEach(marker => marker.remove())
      map.remove()
      mapRef.current = null
    }
  }, [locations])

  if (locations.length === 0) return null

  return <div ref={containerRef} className="player-location-preview-map" aria-label="촬영 위치 미리보기 지도" />
}
