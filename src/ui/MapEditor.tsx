import React, { useRef, useState, useCallback } from 'react'
import type { ZoneDef, ZoneStructure, StructureMaterial } from '../zones/ZoneDef'
import { DAYLIGHT } from '../zones/ZoneDef'
import { saveMap, newMapId } from '../zones/mapStore'
import type { SavedMap } from '../zones/mapStore'
import { MapEditorCanvas } from './MapEditorCanvas'
import type { Tool, TopSnapRef } from './MapEditorCanvas'
import { BlockPropertiesPanel } from './BlockPropertiesPanel'

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'wall', label: 'Wall' }, { value: 'crate', label: 'Crate' },
  { value: 'concrete', label: 'Concrete' }, { value: 'metal', label: 'Metal' },
  { value: 'wood', label: 'Wood' }, { value: 'tspawn', label: 'T Spawn' },
  { value: 'ctspawn', label: 'CT Spawn' }, { value: 'bombA', label: 'Site A' },
  { value: 'bombB', label: 'Site B' }, { value: 'eraser', label: 'Eraser' },
]
const ARENA_SIZES = [20, 30, 40, 50]

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
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const topSnapRef = useRef<TopSnapRef | null>(null)

  const handlePlaceStructure = useCallback((s: ZoneStructure) => {
    const newIdx = zone.structures.length
    setZone((prev) => ({ ...prev, structures: [...prev.structures, s] }))
    setSelectedIdx(newIdx)
  }, [zone.structures.length])

  const handlePlaceSpawn = useCallback((type: 'T' | 'CT', x: number, z: number) => {
    setZone((prev) =>
      type === 'T'
        ? { ...prev, tSpawns: [...prev.tSpawns, [x, z]] }
        : { ...prev, ctSpawns: [...prev.ctSpawns, [x, z]] }
    )
  }, [])

  const handleMoveBombsite = useCallback((id: 'A' | 'B', x: number, z: number) => {
    setZone((prev) => ({
      ...prev,
      bombsites: prev.bombsites.map((b) =>
        b.id === id ? { ...b, center: [x, z] as [number, number] } : b
      ),
    }))
  }, [])

  const handleDeleteStructure = useCallback((idx: number) => {
    setSelectedIdx(null)
    setZone((prev) => ({ ...prev, structures: prev.structures.filter((_, i) => i !== idx) }))
  }, [])

  const handleDeleteSpawn = useCallback((type: 'T' | 'CT', idx: number) => {
    setZone((prev) =>
      type === 'T'
        ? { ...prev, tSpawns: prev.tSpawns.filter((_, i) => i !== idx) }
        : { ...prev, ctSpawns: prev.ctSpawns.filter((_, i) => i !== idx) }
    )
  }, [])

  const handleUpdateStructure = useCallback((s: ZoneStructure) => {
    setZone((prev) => ({
      ...prev,
      structures: prev.structures.map((existing, i) => (i === selectedIdx ? s : existing)),
    }))
  }, [selectedIdx])

  function handleSave() {
    const map: SavedMap = {
      id: initial?.id ?? newMapId(),
      name: mapName.trim() || 'Unnamed',
      createdAt: initial?.createdAt ?? Date.now(),
      zone: { ...zone, name: mapName.trim() || 'Unnamed', id: initial?.zone.id ?? zone.id },
    }
    saveMap(map)
    onSave(map)
  }

  function handleDownload() {
    const payload = JSON.stringify({ version: 1, name: mapName, zone: { ...zone, name: mapName } }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${mapName.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const selectedStructure = selectedIdx !== null ? zone.structures[selectedIdx] : null

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0e0e1a', display: 'flex',
      fontFamily: 'monospace', color: '#fff', overflow: 'hidden', zIndex: 60 }}>

      {/* Left panel */}
      <div style={{ width: 180, minWidth: 180, background: '#12121e', borderRight: '1px solid #3a3a55',
        display: 'flex', flexDirection: 'column', gap: 8, padding: 12, overflowY: 'auto' }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>MAP EDITOR</div>

        <input
          value={mapName} onChange={(e) => setMapName(e.target.value)}
          placeholder="Map name"
          style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 13,
            background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55',
            width: '100%', boxSizing: 'border-box' }}
        />

        <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>ARENA SIZE</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ARENA_SIZES.map((s) => (
            <button key={s} style={btn(zone.arenaSize === s)}
              onClick={() => setZone((prev) => ({
                ...makeDefaultZone(s), structures: prev.structures,
                ctSpawns: prev.ctSpawns, tSpawns: prev.tSpawns,
                bombsites: prev.bombsites, name: prev.name,
              }))}>
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

        <button
          style={{ ...btn(false), marginTop: 4 }}
          onClick={() => topSnapRef.current?.snap()}
        >
          ⊤ Top View
        </button>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, opacity: 0.5 }}>
            {zone.structures.length} structs · {zone.tSpawns.length}T · {zone.ctSpawns.length}CT
          </div>
          <button style={btn(false)} onClick={() => {
            setSelectedIdx(null)
            setZone((prev) => ({ ...prev, structures: [], tSpawns: [], ctSpawns: [] }))
          }}>Clear</button>
          <button style={btn(false)} onClick={handleDownload}>Download</button>
          <button style={btn(false)} onClick={onCancel}>Cancel</button>
          <button style={btn(true)} onClick={handleSave}>Save Map</button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapEditorCanvas
          zone={zone} tool={tool} selectedIdx={selectedIdx}
          topSnapRef={topSnapRef}
          onPlaceStructure={handlePlaceStructure}
          onPlaceSpawn={handlePlaceSpawn}
          onMoveBombsite={handleMoveBombsite}
          onSelectStructure={setSelectedIdx}
          onDeleteStructure={handleDeleteStructure}
          onDeleteSpawn={handleDeleteSpawn}
        />
      </div>

      {/* Right panel — shown only when a block is selected */}
      {selectedStructure && (
        <BlockPropertiesPanel
          structure={selectedStructure}
          onUpdate={handleUpdateStructure}
          onDelete={() => handleDeleteStructure(selectedIdx!)}
        />
      )}
    </div>
  )
}
