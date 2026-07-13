'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  DEFAULT_MAP_ZOOM,
  defaultMapCenterStrings,
  formatCoordinate,
  hasValidCoordinates,
  parseCoordinate,
  resolveMapCenter,
} from '@/lib/gps-map-defaults'

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export type GpsMapSlot = 1 | 2

type AdminGpsLocationMapProps = {
  activeSlot: GpsMapSlot
  onActiveSlotChange: (slot: GpsMapSlot) => void
  slot1Lat: string
  slot1Lng: string
  slot2Lat: string
  slot2Lng: string
  onApply: (slot: GpsMapSlot, lat: string, lng: string) => void | Promise<void>
  visible?: boolean
  applying?: boolean
  statusMessage?: string
  statusError?: string
}

function getSlotCoordinates(
  slot: GpsMapSlot,
  slot1Lat: string,
  slot1Lng: string,
  slot2Lat: string,
  slot2Lng: string
) {
  if (slot === 1) {
    return { lat: slot1Lat, lng: slot1Lng }
  }
  return { lat: slot2Lat, lng: slot2Lng }
}

export function AdminGpsLocationMap({
  activeSlot,
  onActiveSlotChange,
  slot1Lat,
  slot1Lng,
  slot2Lat,
  slot2Lng,
  onApply,
  visible = true,
  applying = false,
  statusMessage = '',
  statusError = '',
}: AdminGpsLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const autoLocatedSlotsRef = useRef<Set<GpsMapSlot>>(new Set())
  const [draftLat, setDraftLat] = useState(() => defaultMapCenterStrings().lat)
  const [draftLng, setDraftLng] = useState(() => defaultMapCenterStrings().lng)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchResults, setSearchResults] = useState<
    { label: string; lat: number; lng: number }[]
  >([])

  const syncDraftFromSlot = useCallback(
    (slot: GpsMapSlot) => {
      const { lat, lng } = getSlotCoordinates(slot, slot1Lat, slot1Lng, slot2Lat, slot2Lng)
      const center = resolveMapCenter(lat, lng)
      setDraftLat(formatCoordinate(center.lat))
      setDraftLng(formatCoordinate(center.lng))
    },
    [slot1Lat, slot1Lng, slot2Lat, slot2Lng]
  )

  const placeMarker = useCallback((lat: number, lng: number, moveView = false) => {
    const map = mapRef.current
    if (!map) return

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng], { icon: defaultIcon }).addTo(map)
    }

    if (moveView) {
      map.setView([lat, lng], map.getZoom())
    }
  }, [])

  useEffect(() => {
    syncDraftFromSlot(activeSlot)
  }, [activeSlot, syncDraftFromSlot])

  useEffect(() => {
    if (!visible || !mapContainerRef.current || mapRef.current) return

    const { lat, lng } = getSlotCoordinates(activeSlot, slot1Lat, slot1Lng, slot2Lat, slot2Lng)
    const center = resolveMapCenter(lat, lng)

    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: DEFAULT_MAP_ZOOM,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    markerRef.current = L.marker([center.lat, center.lng], { icon: defaultIcon }).addTo(map)

    map.on('click', event => {
      const lat = formatCoordinate(event.latlng.lat)
      const lng = formatCoordinate(event.latlng.lng)
      setDraftLat(lat)
      setDraftLng(lng)
      placeMarker(event.latlng.lat, event.latlng.lng)
      setLocationError('')
    })

    mapRef.current = map

    const timer = window.setTimeout(() => {
      map.invalidateSize()
      map.setView([center.lat, center.lng], DEFAULT_MAP_ZOOM)
    }, 150)

    return () => {
      window.clearTimeout(timer)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [visible, activeSlot, slot1Lat, slot1Lng, slot2Lat, slot2Lng, placeMarker])

  useEffect(() => {
    if (!visible) {
      autoLocatedSlotsRef.current = new Set()
      return
    }

    const { lat, lng } = getSlotCoordinates(activeSlot, slot1Lat, slot1Lng, slot2Lat, slot2Lng)
    if (hasValidCoordinates(lat, lng) || autoLocatedSlotsRef.current.has(activeSlot)) return
    if (!navigator.geolocation) return

    autoLocatedSlotsRef.current.add(activeSlot)
    setLocating(true)

    let cancelled = false

    navigator.geolocation.getCurrentPosition(
      position => {
        if (cancelled) return
        setDraftLat(formatCoordinate(position.coords.latitude))
        setDraftLng(formatCoordinate(position.coords.longitude))
        setLocating(false)
      },
      () => {
        if (cancelled) return
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 }
    )

    return () => {
      cancelled = true
    }
  }, [visible, activeSlot, slot1Lat, slot1Lng, slot2Lat, slot2Lng])

  useEffect(() => {
    if (!visible || !mapRef.current) return

    const lat = parseCoordinate(draftLat)
    const lng = parseCoordinate(draftLng)
    if (lat == null || lng == null) return

    placeMarker(lat, lng, true)
  }, [draftLat, draftLng, visible, placeMarker])

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError('이 브라우저에서는 위치 정보를 사용할 수 없어요.')
      return
    }

    setLocating(true)
    setLocationError('')

    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = formatCoordinate(position.coords.latitude)
        const lng = formatCoordinate(position.coords.longitude)
        setDraftLat(lat)
        setDraftLng(lng)
        setLocating(false)
      },
      () => {
        setLocationError('현재 위치를 가져오지 못했어요. 위치 권한을 확인해주세요.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  async function handleSearch() {
    const query = searchQuery.trim()
    if (!query) return

    setSearching(true)
    setSearchError('')
    setSearchResults([])

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`
      )
      if (!res.ok) {
        setSearchError('검색에 실패했어요')
        return
      }
      const data = (await res.json()) as { display_name: string; lat: string; lon: string }[]
      if (data.length === 0) {
        setSearchError('검색 결과가 없어요')
        return
      }
      setSearchResults(
        data.map(item => ({
          label: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
        }))
      )
    } catch {
      setSearchError('검색 중 오류가 발생했어요')
    } finally {
      setSearching(false)
    }
  }

  function handleSelectSearchResult(lat: number, lng: number) {
    setDraftLat(formatCoordinate(lat))
    setDraftLng(formatCoordinate(lng))
    setSearchResults([])
    setSearchQuery('')
    setLocationError('')
  }

  async function handleApply() {
    const lat = parseCoordinate(draftLat)
    const lng = parseCoordinate(draftLng)
    if (lat == null || lng == null) {
      setLocationError('유효한 위도·경도를 선택해주세요.')
      return
    }

    await onApply(activeSlot, formatCoordinate(lat), formatCoordinate(lng))
  }

  return (
    <section className="admin-gps-map-section">
      <div className="admin-gps-map-header">
        <div>
          <p className="admin-gps-map-title">촬영 위치 지도</p>
          <p className="admin-gps-map-subtitle">지도를 클릭해 위치를 고른 뒤 저장하세요.</p>
          <p className="admin-gps-map-subtitle">
            정확도를 위해 최대한 확대해서 클릭하거나 &apos;현재 내 위치&apos; 버튼을 이용하세요.
          </p>
        </div>
        <div className="admin-gps-map-slot-tabs" role="tablist" aria-label="촬영 위치 선택">
          {([1, 2] as const).map(slot => (
            <button
              key={slot}
              type="button"
              role="tab"
              aria-selected={activeSlot === slot}
              className={activeSlot === slot ? 'admin-gps-map-slot-tab-active' : 'admin-gps-map-slot-tab'}
              onClick={() => onActiveSlotChange(slot)}
            >
              {slot}차 촬영
            </button>
          ))}
        </div>
      </div>

      <div className="admin-gps-map-search">
        <input
          className="input-field"
          type="text"
          placeholder="주소 또는 장소명 검색 (예: 잠실종합운동장)"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleSearch()
            }
          }}
        />
        <button
          type="button"
          className="btn-secondary-inline"
          onClick={() => void handleSearch()}
          disabled={searching || !searchQuery.trim()}
        >
          {searching ? '검색 중...' : '검색'}
        </button>
      </div>

      {searchError ? <p className="alert-danger">{searchError}</p> : null}

      {searchResults.length > 0 && (
        <ul className="admin-gps-map-search-results">
          {searchResults.map((result, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => handleSelectSearchResult(result.lat, result.lng)}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={mapContainerRef} className="admin-gps-map-container" aria-label="촬영 위치 지도" />

      <div className="admin-gps-map-coords">
        <label className="admin-gps-map-coord-field">
          <span className="label-field">위도</span>
          <input
            className="input-field"
            type="number"
            step="any"
            value={draftLat}
            onChange={e => setDraftLat(e.target.value)}
          />
        </label>
        <label className="admin-gps-map-coord-field">
          <span className="label-field">경도</span>
          <input
            className="input-field"
            type="number"
            step="any"
            value={draftLng}
            onChange={e => setDraftLng(e.target.value)}
          />
        </label>
      </div>

      <div className="admin-gps-map-actions">
        <button
          type="button"
          className="btn-secondary-inline"
          onClick={handleUseCurrentLocation}
          disabled={locating || applying}
        >
          {locating ? '위치 확인 중...' : '현재 내 위치'}
        </button>
        <button
          type="button"
          className="btn-primary-inline"
          onClick={() => void handleApply()}
          disabled={applying}
        >
          {applying ? '저장 중...' : '이 위치로 설정'}
        </button>
      </div>

      {locationError ? <p className="alert-danger">{locationError}</p> : null}
      {statusError ? <p className="alert-danger">{statusError}</p> : null}
      {statusMessage ? <p className="alert-success">{statusMessage}</p> : null}
    </section>
  )
}
