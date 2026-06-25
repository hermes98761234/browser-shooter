// src/ui/MapEditor.tsx
import React, { useState, useRef, useCallback } from 'react'
import type { ZoneDef, ZoneStructure, StructureMaterial } from '../zones/ZoneDef'
import { DAYLIGHT } from '../zones/ZoneDef'
import { saveMap, newMapId } from '../zones/mapStore'
import type { SavedMap } from '../zones/mapStore'

type Tool = 'wall' | 'crate' | 'concrete' | 'metal' | 'wood' | 'tspawn' | 'ctspawn' | 'bombA' | 'bombB' | 'eraser'

const MATERIAL_COLOR: Record<StructureMaterial, string> = {
  wall: '#8b8b8b', crate: '#8b6914', concrete: '#bbbbbb', metal: '#6688aa', wood: '#aa7744',
}

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'wall', label: 'Wall' }, { value: 'crate', label: 'Crate' },
  { value: 'concrete', label: 'Concrete' }, { value: 'metal', label: 'Metal' },
  { value: 'wood', label: 'Wood' }, { value: 'tspawn', label: 'T Spawn' },
  { value: 'ctspawn', label: 'CT Spawn' }, { value: 'bombA', label: 'Site A' },
  { value: 'bombB', label: 'Site B' }, { value: 'eraser', label: 'Eraser' },
]

const ARENA_SIZES = [20, 30, 40, 50]
const SVG_SIZE = 500
const SPAWN_RADIUS = 1.5 // arena units

function arenaToSvg(val: number, arenaSize: number): number {
  return (val + arenaSize) / (arenaSize * 2) * SVG_SIZE
}

function svgToArena(val: number, arenaSize: number): number {
  return (val / SVG_SIZE) * (arenaSize * 2) - arenaSize
}

function snapToGrid(val: number): number {
  return Math.round(val)
}

function makeDefaultZone(arenaSize: number): ZoneDef {
  const s = arenaSize
  return {
    id: newMapId(), name: 'My Map', description: 'Custom map',
    arenaSize, floorColor: 0x444444, skyColor: 0x87ceeb,
    lighting: DAYLIGHT, structures: [],
    ctSpawns: [[0, -(s - 10)], [3, -(s - 10)], [-3, -(s - 10)]],
    tSpawns: [[0, s - 10], [3, s - 10], [-3, s - 10]],
    bombsites: [
      { id: 'A', center: [Math.round(s * 0.5), 0] },
      { id: 'B', center: [-Math.round(s * 0.5), 0] },
    ],
  }
}

type DragState = { startX: number; startZ: number; curX: number; curZ: number } | null

const btn = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
  background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
  border: '1px solid #3a3a55',
})

export function MapEditor({ initial, onSave, onCancel }: {
  initial?: SavedMap
  onSave: (map: SavedMap) => void
  onCancel: () => void
}) {
  const [zone, setZone] = useState<ZoneDef>(() => initial?.zone ?? makeDefaultZone(30))
  const [mapName, setMapName] = useState(initial?.name ?? 'My Map')
  const [tool, setTool] = useState<Tool>('wall')
  const [drag, setDrag] = useState<DragState>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const svgPt = useCallback((e: React.MouseEvent): { x: number; z: number } => {
    const rect = svgRef.current!.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width * SVG_SIZE
    const pz = (e.clientY - rect.top) / rect.height * SVG_SIZE
    return {
      x: snapToGrid(svgToArena(px, zone.arenaSize)),
      z: snapToGrid(svgToArena(pz, zone.arenaSize)),
    }
  }, [zone.arenaSize])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const { x, z } = svgPt(e)
    setDrag({ startX: x, startZ: z, curX: x, curZ: z })
  }, [svgPt])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag) return
    const { x, z } = svgPt(e)
    setDrag((d) => d ? { ...d, curX: x, curZ: z } : null)
  }, [drag, svgPt])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!drag) return
    const { x, z } = svgPt(e)
    setDrag(null)

    const ax = Math.min(drag.startX, x)
    const az = Math.min(drag.startZ, z)
    const bx = Math.max(drag.startX, x)
    const bz = Math.max(drag.startZ, z)
    const cx = (ax + bx) / 2
    const cz = (az + bz) / 2
    const w = Math.max(1, bx - ax)
    const d = Math.max(1, bz - az)

    if (tool === 'eraser') {
      setZone((prev) => {
        // Find nearest structure
        let bestStructIdx = -1, bestStructDist = Infinity
        prev.structures.forEach((s, i) => {
          const dist = Math.hypot(s.center[0] - x, s.center[2] - z)
          if (dist < bestStructDist) { bestStructDist = dist; bestStructIdx = i }
        })
        // Find nearest T-spawn
        let bestTIdx = -1, bestTDist = Infinity
        prev.tSpawns.forEach(([sx, sz], i) => {
          const dist = Math.hypot(sx - x, sz - z)
          if (dist < bestTDist) { bestTDist = dist; bestTIdx = i }
        })
        // Find nearest CT-spawn
        let bestCTIdx = -1, bestCTDist = Infinity
        prev.ctSpawns.forEach(([sx, sz], i) => {
          const dist = Math.hypot(sx - x, sz - z)
          if (dist < bestCTDist) { bestCTDist = dist; bestCTIdx = i }
        })
        // Remove whichever is closest, within 5 units
        const best = Math.min(
          bestStructIdx >= 0 ? bestStructDist : Infinity,
          bestTIdx >= 0 ? bestTDist : Infinity,
          bestCTIdx >= 0 ? bestCTDist : Infinity,
        )
        if (best > 5) return prev
        if (best === bestStructDist && bestStructIdx >= 0)
          return { ...prev, structures: prev.structures.filter((_, i) => i !== bestStructIdx) }
        if (best === bestTDist && bestTIdx >= 0)
          return { ...prev, tSpawns: prev.tSpawns.filter((_, i) => i !== bestTIdx) }
        return { ...prev, ctSpawns: prev.ctSpawns.filter((_, i) => i !== bestCTIdx) }
      })
      return
    }

    if (tool === 'tspawn') {
      setZone((prev) => ({ ...prev, tSpawns: [...prev.tSpawns, [x, z]] }))
      return
    }
    if (tool === 'ctspawn') {
      setZone((prev) => ({ ...prev, ctSpawns: [...prev.ctSpawns, [x, z]] }))
      return
    }
    if (tool === 'bombA') {
      setZone((prev) => ({
        ...prev,
        bombsites: prev.bombsites.map((b) => b.id === 'A' ? { ...b, center: [cx, cz] as [number,number] } : b),
      }))
      return
    }
    if (tool === 'bombB') {
      setZone((prev) => ({
        ...prev,
        bombsites: prev.bombsites.map((b) => b.id === 'B' ? { ...b, center: [cx, cz] as [number,number] } : b),
      }))
      return
    }

    // Structure tools
    const material = tool as StructureMaterial
    const height = material === 'wall' ? 3 : 1.5
    const yCenter = height / 2
    const newStructure: ZoneStructure = {
      center: [cx, yCenter, cz],
      size: [w, height, d],
      material,
    }
    setZone((prev) => ({ ...prev, structures: [...prev.structures, newStructure] }))
  }, [drag, svgPt, tool])

  function handleSave() {
    const map: SavedMap = {
      id: initial?.id ?? newMapId(),
      name: mapName.trim() || 'Unnamed',
      createdAt: initial?.createdAt ?? Date.now(),
      zone: { ...zone, name: mapName.trim() || 'Unnamed', id: initial?.zone.id ?? zone.id },
    }
    const saved = saveMap(map)
    if (!saved) {
      // Still call onSave so the map is usable this session even if not persisted
      onSave(map)
      return
    }
    onSave(map)
  }

  function handleDownload() {
    const payload = JSON.stringify({ version: 1, name: mapName, zone: { ...zone, name: mapName } }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${mapName.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const a = zone.arenaSize
  const gridLines: React.ReactNode[] = []
  for (let v = -a; v <= a; v += 5) {
    const pos = arenaToSvg(v, a)
    gridLines.push(
      <line key={`x${v}`} x1={pos} y1={0} x2={pos} y2={SVG_SIZE} stroke="#2a2a3a" strokeWidth={v === 0 ? 1.5 : 0.5} />,
      <line key={`z${v}`} x1={0} y1={pos} x2={SVG_SIZE} y2={pos} stroke="#2a2a3a" strokeWidth={v === 0 ? 1.5 : 0.5} />,
    )
  }

  const liveRect = drag && (tool === 'wall' || tool === 'crate' || tool === 'concrete' || tool === 'metal' || tool === 'wood') ? (() => {
    const ax = Math.min(drag.startX, drag.curX), bx = Math.max(drag.startX, drag.curX)
    const az = Math.min(drag.startZ, drag.curZ), bz = Math.max(drag.startZ, drag.curZ)
    return (
      <rect
        x={arenaToSvg(ax, a)} y={arenaToSvg(az, a)}
        width={(bx - ax) / (a * 2) * SVG_SIZE} height={(bz - az) / (a * 2) * SVG_SIZE}
        fill={MATERIAL_COLOR[tool as StructureMaterial]} opacity={0.6} stroke="#fff" strokeWidth={1}
      />
    )
  })() : null

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0e0e1a', display: 'flex',
      fontFamily: 'monospace', color: '#fff', overflow: 'hidden', zIndex: 60 }}>

      {/* Left panel */}
      <div style={{ width: 180, minWidth: 180, background: '#12121e', borderRight: '1px solid #3a3a55',
        display: 'flex', flexDirection: 'column', gap: 8, padding: 12, overflowY: 'auto' }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>MAP CREATOR</div>

        <input
          value={mapName} onChange={(e) => setMapName(e.target.value)}
          placeholder="Map name"
          style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 13,
            background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55', width: '100%', boxSizing: 'border-box' }}
        />

        <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>ARENA SIZE</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ARENA_SIZES.map((s) => (
            <button key={s} style={btn(zone.arenaSize === s)}
              onClick={() => setZone((prev) => ({ ...makeDefaultZone(s), structures: prev.structures, ctSpawns: prev.ctSpawns, tSpawns: prev.tSpawns, bombsites: prev.bombsites, name: prev.name }))}>
              {s * 2}
            </button>
          ))}
        </div>

        <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>TOOLS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TOOLS.map((t) => (
            <button key={t.value} style={btn(tool === t.value)} onClick={() => setTool(t.value)}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, opacity: 0.5 }}>
            {zone.structures.length} structures · {zone.tSpawns.length}T · {zone.ctSpawns.length}CT
          </div>
          <button style={btn(false)} onClick={() => setZone((prev) => ({ ...prev, structures: [], tSpawns: [], ctSpawns: [] }))}>Clear</button>
          <button style={btn(false)} onClick={handleDownload}>Download</button>
          <button style={btn(false)} onClick={onCancel}>Cancel</button>
          <button style={btn(true)} onClick={handleSave}>Save Map</button>
        </div>
      </div>

      {/* SVG canvas */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <svg
          ref={svgRef}
          width={SVG_SIZE} height={SVG_SIZE}
          style={{ background: `#${zone.floorColor.toString(16).padStart(6, '0')}`, cursor: 'crosshair',
            maxWidth: '100%', maxHeight: '100%', userSelect: 'none' }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={() => setDrag(null)}
        >
          {gridLines}

          {/* Arena border */}
          <rect x={0} y={0} width={SVG_SIZE} height={SVG_SIZE} fill="none" stroke="#ff6600" strokeWidth={2} />

          {/* Structures */}
          {zone.structures.map((s, i) => {
            const sx = arenaToSvg(s.center[0] - s.size[0] / 2, a)
            const sz = arenaToSvg(s.center[2] - s.size[2] / 2, a)
            const sw = s.size[0] / (a * 2) * SVG_SIZE
            const sh = s.size[2] / (a * 2) * SVG_SIZE
            return (
              <rect key={i} x={sx} y={sz} width={Math.max(2, sw)} height={Math.max(2, sh)}
                fill={MATERIAL_COLOR[s.material]} stroke="#000" strokeWidth={0.5} />
            )
          })}

          {/* Live drag preview */}
          {liveRect}

          {/* Bombsites */}
          {zone.bombsites.map((b) => {
            const bx = arenaToSvg(b.center[0], a)
            const bz = arenaToSvg(b.center[1], a)
            const r = 4 / (a * 2) * SVG_SIZE
            return (
              <g key={b.id}>
                <circle cx={bx} cy={bz} r={r} fill={b.id === 'A' ? 'rgba(255,50,50,0.3)' : 'rgba(50,200,50,0.3)'}
                  stroke={b.id === 'A' ? '#ff3232' : '#32c832'} strokeWidth={1.5} strokeDasharray="4 3" />
                <text x={bx} y={bz + 4} textAnchor="middle" fontSize={10} fill={b.id === 'A' ? '#ff3232' : '#32c832'}>{b.id}</text>
              </g>
            )
          })}

          {/* T spawns (orange) */}
          {zone.tSpawns.map(([x, z], i) => (
            <circle key={`t${i}`} cx={arenaToSvg(x, a)} cy={arenaToSvg(z, a)}
              r={SPAWN_RADIUS / (a * 2) * SVG_SIZE}
              fill="rgba(255,140,0,0.7)" stroke="#ff8c00" strokeWidth={1} />
          ))}

          {/* CT spawns (blue) */}
          {zone.ctSpawns.map(([x, z], i) => (
            <circle key={`ct${i}`} cx={arenaToSvg(x, a)} cy={arenaToSvg(z, a)}
              r={SPAWN_RADIUS / (a * 2) * SVG_SIZE}
              fill="rgba(60,120,255,0.7)" stroke="#3c78ff" strokeWidth={1} />
          ))}
        </svg>
      </div>
    </div>
  )
}
