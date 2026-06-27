import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Team } from '../types'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const TEAM_COLOR = { ct: '#3a6ea5', t: '#a5703a' } as const

interface PlayerDot {
  id: string
  lng: number
  lat: number
  team: Team
}

interface MapPickerProps {
  playerPositions: PlayerDot[]
  onTeleport: (lng: number, lat: number) => void
  onClose: () => void
}

export function MapPicker({ playerPositions, onTeleport, onClose }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      zoom: 2,
      center: [0, 20],
    })
    map.addControl(new maplibregl.NavigationControl())
    map.on('click', e => onTeleport(e.lngLat.lng, e.lngLat.lat))
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Update player dots when positions change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = playerPositions.map(p => {
      const el = document.createElement('div')
      el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${TEAM_COLOR[p.team]};border:2px solid white`
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
    })
    return () => { markersRef.current.forEach(m => m.remove()) }
  }, [playerPositions])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <button
        aria-label="Close map picker"
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 101,
          padding: '8px 16px', background: '#222', color: 'white',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
        }}
      >
        Close
      </button>
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 16px',
        borderRadius: 6, fontSize: 13, pointerEvents: 'none',
      }}>
        Click anywhere to drop in
      </div>
    </div>
  )
}
