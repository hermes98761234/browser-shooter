# Map Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow players to create, save, share and play on custom maps — stored in localStorage, downloadable as JSON, selectable in MatchSetup, and automatically synced to clients in multiplayer via the existing `welcome` message.

**Architecture:** `SavedMap` objects (ZoneDef + metadata) live in localStorage under `'browser-shooter-maps'`. Custom maps are selected in MatchSetup with `zoneId: 'custom'` and `customZone: ZoneDef` in `MatchConfig`; the host's welcome message already transmits the full config to clients so no new protocol messages are needed. A 2D SVG top-down editor (`MapEditor.tsx`) lets players draw walls, place cover, set spawns and bombsites, then save or download.

**Tech Stack:** React 19, TypeScript, SVG (no canvas lib needed), Vitest 3, localStorage

## Global Constraints

- No new npm dependencies. Use `Date.now().toString(36) + Math.random().toString(36).slice(2,6)` for IDs.
- Follow the existing terminal aesthetic: monospace font, `#1d1d2a` background, `#ff6600` active, `#3a3a55` borders, `#fff` text.
- Arena coordinate space: x is east/west, z is north/south, y is up. The top-down SVG maps `x → SVG x`, `z → SVG y`.
- Test files live alongside source: `src/zones/mapStore.test.ts`, `src/zones/registry.test.ts` (extend existing), `src/session/MatchConfig.test.ts` (extend existing).
- Run tests with: `npx vitest run` from project root.
- Commit after every task.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/zones/mapStore.ts` | Create | CRUD for SavedMap[] in localStorage |
| `src/zones/mapStore.test.ts` | Create | Unit tests for mapStore |
| `src/session/MatchConfig.ts` | Modify | Add `customZone?: ZoneDef` field |
| `src/session/MatchConfig.test.ts` | Modify | Test customZone field round-trips |
| `src/zones/registry.ts` | Modify | Handle `zoneId === 'custom'` |
| `src/zones/registry.test.ts` | Modify | Test custom zone lookup |
| `src/ui/MapEditor.tsx` | Create | 2D SVG top-down map editor |
| `src/ui/MatchSetup.tsx` | Modify | My Maps section + Create/Upload buttons |
| `src/types.ts` | Modify | Add `'mapeditor'` to GameState |
| `src/App.tsx` | Modify | Wire MapEditor screen + customZone through hostGame |
| `src/net/NetClient.ts` | Modify | Auto-save received customZone on welcome |

---

### Task 1: mapStore — localStorage CRUD

**Files:**
- Create: `src/zones/mapStore.ts`
- Create: `src/zones/mapStore.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface SavedMap { id: string; name: string; createdAt: number; zone: ZoneDef }
  function loadMaps(): SavedMap[]
  function saveMap(map: SavedMap): void        // upsert by id
  function deleteMap(id: string): void
  function findByName(name: string): SavedMap | undefined
  function newMapId(): string
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/zones/mapStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadMaps, saveMap, deleteMap, findByName, newMapId } from './mapStore'
import type { SavedMap } from './mapStore'
import type { ZoneDef } from './ZoneDef'
import { DAYLIGHT } from './ZoneDef'

const STUB_ZONE: ZoneDef = {
  id: 'test', name: 'Test', description: 'stub', arenaSize: 30,
  floorColor: 0x444444, lighting: DAYLIGHT,
  structures: [], ctSpawns: [[0, -20]], tSpawns: [[0, 20]],
  bombsites: [{ id: 'A', center: [10, 0] }, { id: 'B', center: [-10, 0] }],
}

const makeMap = (id: string, name: string): SavedMap =>
  ({ id, name, createdAt: 1000, zone: STUB_ZONE })

beforeEach(() => localStorage.clear())

describe('mapStore', () => {
  it('starts empty', () => expect(loadMaps()).toEqual([]))

  it('saves and loads a map', () => {
    saveMap(makeMap('abc', 'My Map'))
    expect(loadMaps()).toHaveLength(1)
    expect(loadMaps()[0].name).toBe('My Map')
  })

  it('upserts by id', () => {
    saveMap(makeMap('abc', 'v1'))
    saveMap(makeMap('abc', 'v2'))
    expect(loadMaps()).toHaveLength(1)
    expect(loadMaps()[0].name).toBe('v2')
  })

  it('deletes by id', () => {
    saveMap(makeMap('abc', 'Map'))
    deleteMap('abc')
    expect(loadMaps()).toHaveLength(0)
  })

  it('finds by name', () => {
    saveMap(makeMap('abc', 'Dust'))
    expect(findByName('Dust')?.id).toBe('abc')
    expect(findByName('Nope')).toBeUndefined()
  })

  it('newMapId returns unique strings', () => {
    expect(newMapId()).not.toBe(newMapId())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/zones/mapStore.test.ts
```
Expected: FAIL — "Cannot find module './mapStore'"

- [ ] **Step 3: Implement mapStore.ts**

```ts
// src/zones/mapStore.ts
import type { ZoneDef } from './ZoneDef'

export interface SavedMap {
  id: string
  name: string
  createdAt: number
  zone: ZoneDef
}

const KEY = 'browser-shooter-maps'

export function loadMaps(): SavedMap[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SavedMap[]) : []
  } catch {
    return []
  }
}

export function saveMap(map: SavedMap): void {
  try {
    const maps = loadMaps().filter((m) => m.id !== map.id)
    localStorage.setItem(KEY, JSON.stringify([...maps, map]))
  } catch { /* storage full — silently skip */ }
}

export function deleteMap(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadMaps().filter((m) => m.id !== id)))
  } catch { /* ignore */ }
}

export function findByName(name: string): SavedMap | undefined {
  return loadMaps().find((m) => m.name === name)
}

export function newMapId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/zones/mapStore.test.ts
```
Expected: PASS — all 6 tests green

- [ ] **Step 5: Commit**

```bash
git add src/zones/mapStore.ts src/zones/mapStore.test.ts
git commit -m "feat: add mapStore for localStorage-backed custom map CRUD"
```

---

### Task 2: MatchConfig + registry — support custom zones

**Files:**
- Modify: `src/session/MatchConfig.ts`
- Modify: `src/session/MatchConfig.test.ts`
- Modify: `src/zones/registry.ts`
- Modify: `src/zones/registry.test.ts`

**Interfaces:**
- Consumes: `ZoneDef` from `src/zones/ZoneDef.ts`
- Produces:
  ```ts
  // MatchConfig gets:
  customZone?: ZoneDef
  // getZone signature changes to:
  function getZone(id?: string, seed?: number, customZone?: ZoneDef): ZoneDef
  ```

- [ ] **Step 1: Extend MatchConfig.test.ts with failing tests**

Add at the end of `src/session/MatchConfig.test.ts`:

```ts
import type { ZoneDef } from '../zones/ZoneDef'
import { DAYLIGHT } from '../zones/ZoneDef'

const STUB_ZONE: ZoneDef = {
  id: 'custom-xyz', name: 'My Map', description: 'test', arenaSize: 30,
  floorColor: 0x444444, lighting: DAYLIGHT,
  structures: [], ctSpawns: [[0, -20]], tSpawns: [[0, 20]],
  bombsites: [{ id: 'A', center: [10, 0] }, { id: 'B', center: [-10, 0] }],
}

describe('customZone field', () => {
  it('MatchConfig accepts a customZone', () => {
    const c: MatchConfig = { ...defaultMatchConfig(), zoneId: 'custom', customZone: STUB_ZONE }
    expect(c.customZone?.name).toBe('My Map')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/session/MatchConfig.test.ts
```
Expected: TypeScript error — `customZone` does not exist on `MatchConfig`

- [ ] **Step 3: Add `customZone` to MatchConfig.ts**

In `src/session/MatchConfig.ts`, add the import and the field:

```ts
import type { ZoneDef } from '../zones/ZoneDef'
```

Add after the `randomSeed?` line in the interface:

```ts
  customZone?: ZoneDef     // full zone definition when zoneId === 'custom'
```

- [ ] **Step 4: Add failing registry test**

Add to the end of `src/zones/registry.test.ts`:

```ts
import { DAYLIGHT } from './ZoneDef'
import type { ZoneDef } from './ZoneDef'

describe('custom zone lookup', () => {
  const custom: ZoneDef = {
    id: 'custom-1', name: 'Mine', description: 'd', arenaSize: 30,
    floorColor: 0, lighting: DAYLIGHT, structures: [],
    ctSpawns: [[0, -20]], tSpawns: [[0, 20]],
    bombsites: [{ id: 'A', center: [10, 0] }, { id: 'B', center: [-10, 0] }],
  }

  it('returns the customZone when zoneId is "custom"', () => {
    expect(getZone('custom', undefined, custom)).toBe(custom)
  })

  it('falls back to arid when zoneId is "custom" but no customZone provided', () => {
    expect(getZone('custom').id).toBe('arid')
  })
})
```

- [ ] **Step 5: Update registry.ts**

Replace the `getZone` function in `src/zones/registry.ts`:

```ts
/** Look up a zone by id, falling back to the default (Arid) for unknown/undefined ids. */
export function getZone(id?: string, seed?: number, customZone?: ZoneDef): ZoneDef {
  if (id === 'custom' && customZone) return customZone
  if (id === 'random') return generateRandomZone(seed)
  return ZONES.find((z) => z.id === id) ?? ARID
}
```

- [ ] **Step 6: Run both test files to verify passing**

```bash
npx vitest run src/session/MatchConfig.test.ts src/zones/registry.test.ts
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/session/MatchConfig.ts src/session/MatchConfig.test.ts src/zones/registry.ts src/zones/registry.test.ts
git commit -m "feat: add customZone support to MatchConfig and registry"
```

---

### Task 3: MapEditor — 2D SVG top-down editor

**Files:**
- Create: `src/ui/MapEditor.tsx`

**Interfaces:**
- Consumes: `ZoneDef`, `ZoneStructure`, `StructureMaterial`, `ZoneBombsite`, `DAYLIGHT` from `src/zones/ZoneDef.ts`; `SavedMap`, `saveMap`, `newMapId` from `src/zones/mapStore.ts`
- Produces:
  ```ts
  function MapEditor(props: {
    initial?: SavedMap        // if editing an existing map
    onSave: (map: SavedMap) => void
    onCancel: () => void
  }): JSX.Element
  ```

- [ ] **Step 1: Create MapEditor.tsx**

```tsx
// src/ui/MapEditor.tsx
import React, { useState, useRef, useCallback } from 'react'
import type { ZoneDef, ZoneStructure, StructureMaterial, ZoneBombsite } from '../zones/ZoneDef'
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
      // Remove nearest structure
      setZone((prev) => {
        let best = -1, bestDist = Infinity
        prev.structures.forEach((s, i) => {
          const dist = Math.hypot(s.center[0] - x, s.center[2] - z)
          if (dist < bestDist) { bestDist = dist; best = i }
        })
        if (best === -1 || bestDist > 5) return prev
        return { ...prev, structures: prev.structures.filter((_, i) => i !== best) }
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
    saveMap(map)
    onSave(map)
  }

  function handleDownload() {
    const payload = JSON.stringify({ version: 1, name: mapName, zone }, null, 2)
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
              onClick={() => setZone((prev) => ({ ...makeDefaultZone(s), structures: prev.structures, name: prev.name }))}>
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
          <button style={btn(false)} onClick={() => setZone((prev) => ({ ...prev, structures: [] }))}>Clear</button>
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/MapEditor.tsx
git commit -m "feat: add MapEditor 2D SVG top-down map editor"
```

---

### Task 4: MatchSetup — My Maps section + Create/Upload buttons

**Files:**
- Modify: `src/ui/MatchSetup.tsx`

**Interfaces:**
- Consumes: `SavedMap`, `loadMaps`, `saveMap`, `newMapId` from `src/zones/mapStore.ts`; `ZoneDef` from `src/zones/ZoneDef.ts`
- Produces: new props on MatchSetup:
  ```ts
  onCreateMap: () => void
  // zoneId === 'custom' + customZone in the config passed to onConfirm
  ```
- MatchConfig consumed by onConfirm now includes `customZone?: ZoneDef`

- [ ] **Step 1: Update MatchSetup.tsx**

Replace the entire file contents:

```tsx
// src/ui/MatchSetup.tsx
import React, { useRef, useState } from 'react'
import type { MatchConfig, DamagePolicy, JoinPolicy } from '../session/MatchConfig'
import { defaultCompetitiveConfig } from '../session/MatchConfig'
import type { GameMode } from '../session/protocol'
import { ZONES, DEFAULT_ZONE_ID } from '../zones/registry'
import { loadMaps, saveMap, newMapId } from '../zones/mapStore'
import type { SavedMap } from '../zones/mapStore'
import type { ZoneDef } from '../zones/ZoneDef'
import { BattlefieldBackground } from './BattlefieldBackground'

const MODES: { value: GameMode; label: string }[] = [
  { value: 'coop', label: 'Co-op (vs AI)' },
  { value: 'pvp', label: 'Team PvP (no AI)' },
  { value: 'hybrid', label: 'Hybrid (teams + AI)' },
  { value: 'competitive', label: 'Competitive (CS-style)' },
]
const POLICIES: { value: DamagePolicy; label: string }[] = [
  { value: 'team', label: 'Opposite team only' },
  { value: 'friendly', label: 'Friendly fire ON' },
  { value: 'ffa', label: 'Free-for-all' },
]
const FRAG_LIMITS = [10, 30, 50, 0]

const btn = (active: boolean): React.CSSProperties => ({
  padding: '10px 16px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 14,
  background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
  border: '1px solid #3a3a55',
})

const smallBtn: React.CSSProperties = {
  padding: '6px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
  background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55',
}

export function MatchSetup({
  onConfirm, onBack, onCreateMap,
}: {
  onConfirm: (c: MatchConfig) => void
  onBack: () => void
  onCreateMap: () => void
}) {
  const [mode, setMode] = useState<GameMode>('pvp')
  const [policy, setPolicy] = useState<DamagePolicy>('team')
  const [frag, setFrag] = useState(30)
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>('lobby')
  const [password, setPassword] = useState('')
  const [zoneId, setZoneId] = useState<string>(DEFAULT_ZONE_ID)
  const [customZone, setCustomZone] = useState<ZoneDef | undefined>(undefined)
  const [myMaps, setMyMaps] = useState<SavedMap[]>(() => loadMaps())
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function selectCustomMap(m: SavedMap) {
    setZoneId('custom')
    setCustomZone(m.zone)
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target!.result as string)
        const zone: ZoneDef = parsed.zone ?? parsed
        if (!zone.arenaSize || !Array.isArray(zone.structures)) {
          setUploadError('Invalid map file.')
          return
        }
        const map: SavedMap = {
          id: newMapId(),
          name: parsed.name ?? zone.name ?? 'Uploaded Map',
          createdAt: Date.now(),
          zone,
        }
        saveMap(map)
        setMyMaps(loadMaps())
        selectCustomMap(map)
      } catch {
        setUploadError('Could not parse map file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function buildConfig(): MatchConfig {
    const base = mode === 'competitive'
      ? { ...defaultCompetitiveConfig(), damagePolicy: policy }
      : { mode, damagePolicy: policy, fragLimit: frag }
    return {
      ...base,
      joinPolicy,
      zoneId,
      ...(password ? { password } : {}),
      ...(zoneId === 'custom' && customZone ? { customZone } : {}),
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate', zIndex: 50 }}>
      <BattlefieldBackground />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start', gap: 20,
        fontFamily: 'monospace', color: '#fff', overflowY: 'auto',
        padding: 'calc(24px + var(--safe-top)) 16px calc(24px + var(--safe-bottom))', boxSizing: 'border-box' }}>
        <h2 style={{ margin: 0 }}>MATCH SETUP</h2>

        <div><div style={{ opacity: 0.6, marginBottom: 6 }}>MODE</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {MODES.map(m => <button key={m.value} style={btn(mode === m.value)} onClick={() => setMode(m.value)}>{m.label}</button>)}
          </div>
        </div>

        <div><div style={{ opacity: 0.6, marginBottom: 6 }}>ZONE</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560 }}>
            {ZONES.map(m => {
              const active = zoneId === m.id
              return (
                <button key={m.id} onClick={() => { setZoneId(m.id); setCustomZone(undefined) }} style={{
                  cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left',
                  padding: '8px 12px', width: 170, boxSizing: 'border-box',
                  background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
                  border: active ? '1px solid #ff6600' : '1px solid #3a3a55',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold' }}>{m.name}</div>
                  <div style={{ fontSize: 11, opacity: active ? 0.75 : 0.6, marginTop: 3, lineHeight: 1.3 }}>{m.description}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* My Maps section */}
        <div style={{ width: '100%', maxWidth: 560 }}>
          <div style={{ opacity: 0.6, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            MY MAPS
            <button style={smallBtn} onClick={onCreateMap}>+ Create</button>
            <button style={smallBtn} onClick={() => fileRef.current?.click()}>↑ Upload</button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleUpload} />
          </div>
          {uploadError && <div style={{ color: '#ff4444', fontSize: 12, marginBottom: 6 }}>{uploadError}</div>}
          {myMaps.length === 0
            ? <div style={{ opacity: 0.4, fontSize: 12 }}>No custom maps yet — create one or upload a .json file.</div>
            : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {myMaps.map((m) => {
                  const active = zoneId === 'custom' && customZone?.id === m.zone.id
                  return (
                    <button key={m.id} onClick={() => selectCustomMap(m)} style={{
                      cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left',
                      padding: '8px 12px', width: 170, boxSizing: 'border-box',
                      background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
                      border: active ? '1px solid #ff6600' : '1px solid #3a3a55',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 'bold' }}>{m.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3 }}>{m.zone.arenaSize * 2}×{m.zone.arenaSize * 2} · {m.zone.structures.length} objs</div>
                    </button>
                  )
                })}
              </div>
            )
          }
        </div>

        {mode !== 'coop' && (
          <div><div style={{ opacity: 0.6, marginBottom: 6 }}>DAMAGE POLICY</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {POLICIES.map(p => <button key={p.value} style={btn(policy === p.value)} onClick={() => setPolicy(p.value)}>{p.label}</button>)}
            </div>
          </div>
        )}

        {mode !== 'coop' && mode !== 'competitive' && (
          <div><div style={{ opacity: 0.6, marginBottom: 6 }}>FRAG LIMIT</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {FRAG_LIMITS.map(f => <button key={f} style={btn(frag === f)} onClick={() => setFrag(f)}>{f === 0 ? 'Endless' : f}</button>)}
            </div>
          </div>
        )}

        <div><div style={{ opacity: 0.6, marginBottom: 6 }}>JOIN POLICY</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button style={btn(joinPolicy === 'lobby')} onClick={() => setJoinPolicy('lobby')}>Lobby</button>
            <button style={btn(joinPolicy === 'free')} onClick={() => setJoinPolicy('free')}>Free</button>
          </div>
          <input
            placeholder="Password (optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 8, padding: 8, fontFamily: 'monospace', fontSize: 16,
              background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55',
              width: 'min(220px, calc(100vw - 64px))', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button style={btn(false)} onClick={onBack}>Back</button>
          <button style={btn(true)} onClick={() => onConfirm(buildConfig())}>Create Room</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors (MatchSetup now requires `onCreateMap` prop — this will error if App.tsx not yet updated; that's Task 5)

- [ ] **Step 3: Commit (but note App.tsx will also need changes — see Task 5 before final commit)**

```bash
git add src/ui/MatchSetup.tsx
git commit -m "feat: add My Maps section and Create/Upload to MatchSetup"
```

---

### Task 5: App.tsx + types.ts — wire MapEditor screen + customZone

**Files:**
- Modify: `src/types.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `MapEditor` from `src/ui/MapEditor.tsx`; `SavedMap` from `src/zones/mapStore.ts`; `getZone` (updated signature) from `src/zones/registry.ts`; `customZone` in `MatchConfig`

- [ ] **Step 1: Add 'mapeditor' to GameState in types.ts**

In `src/types.ts`, change line 9:

Old:
```ts
export type GameState = 'menu' | 'mpmenu' | 'settings' | 'teamselect' | 'playing' | 'paused' | 'gameover' | 'matchover'
```

New:
```ts
export type GameState = 'menu' | 'mpmenu' | 'settings' | 'teamselect' | 'playing' | 'paused' | 'gameover' | 'matchover' | 'mapeditor'
```

- [ ] **Step 2: Add MapEditor import to App.tsx**

Add near the other UI imports in `src/App.tsx` (around line 53):

```ts
import { MapEditor } from './ui/MapEditor'
import type { SavedMap } from './zones/mapStore'
```

- [ ] **Step 3: Update hostGame to pass customZone to getZone**

In `src/App.tsx`, find the `hostGame` callback (around line 383). Find this line:

```ts
    fresh.collisionWorld = scene
      ? rebuildArena(scene, getZone(config.zoneId, config.randomSeed))
```

Change it to:

```ts
    fresh.collisionWorld = scene
      ? rebuildArena(scene, getZone(config.zoneId, config.randomSeed, config.customZone))
```

- [ ] **Step 4: Add onCreateMap handler and MapEditor render to App.tsx**

Find the `MatchSetup` render in App.tsx (around line 1452):

```tsx
      {gameState === 'mpmenu' && showMatchSetup && (
        <MatchSetup
          onBack={() => setShowMatchSetup(false)}
          onConfirm={(c) => { setShowMatchSetup(false); void hostGame(c).catch(() => setJoinError('Could not start hosting.')) }}
        />
      )}
```

Replace it with:

```tsx
      {gameState === 'mpmenu' && showMatchSetup && (
        <MatchSetup
          onBack={() => setShowMatchSetup(false)}
          onConfirm={(c) => { setShowMatchSetup(false); void hostGame(c).catch(() => setJoinError('Could not start hosting.')) }}
          onCreateMap={() => { setShowMatchSetup(false); updateGameState('mapeditor') }}
        />
      )}
      {gameState === 'mapeditor' && (
        <MapEditor
          onSave={(_map: SavedMap) => { updateGameState('mpmenu'); setShowMatchSetup(true) }}
          onCancel={() => { updateGameState('mpmenu'); setShowMatchSetup(true) }}
        />
      )}
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 6: Run all unit tests**

```bash
npx vitest run
```
Expected: all existing tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/App.tsx
git commit -m "feat: wire MapEditor screen into App and pass customZone through hostGame"
```

---

### Task 6: NetClient — auto-save received custom maps

**Files:**
- Modify: `src/net/NetClient.ts`

**Interfaces:**
- Consumes: `saveMap`, `findByName`, `newMapId` from `src/zones/mapStore.ts`; `config.customZone` from `MatchConfig`

- [ ] **Step 1: Add mapStore import to NetClient.ts**

Add near the top imports in `src/net/NetClient.ts`:

```ts
import { saveMap, findByName, newMapId } from '../zones/mapStore'
```

- [ ] **Step 2: Auto-save in the welcome handler**

In `src/net/NetClient.ts`, find the `handle` method's `welcome` branch (around line 144):

```ts
    if (msg.type === 'welcome') {
      this.playerId = msg.playerId
      this.config = msg.config
      this.mode = msg.config.mode
      this.welcomeCb?.(msg.playerId, msg.config.mode, msg.players, msg.started)
```

Add the auto-save right after `this.mode = msg.config.mode`:

```ts
    if (msg.type === 'welcome') {
      this.playerId = msg.playerId
      this.config = msg.config
      this.mode = msg.config.mode
      if (msg.config.customZone) {
        const zone = msg.config.customZone
        if (!findByName(zone.name)) {
          saveMap({ id: newMapId(), name: zone.name, createdAt: Date.now(), zone })
        }
      }
      this.welcomeCb?.(msg.playerId, msg.config.mode, msg.players, msg.started)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/net/NetClient.ts
git commit -m "feat: auto-save received custom map on multiplayer join"
```

---

### Task 7: Also handle solo play with custom zones (singleplayer getZone call)

**Files:**
- Modify: `src/App.tsx`

**Note:** The singleplayer `TeamSelect` flow also calls `getZone`. Check that single-player custom-map selections also pass `customZone`.

- [ ] **Step 1: Find singleplayer getZone call in App.tsx**

```bash
grep -n "getZone" src/App.tsx
```

Look for all `getZone(` calls. Each one that uses `config.zoneId` should also pass `config.customZone` as the third argument.

- [ ] **Step 2: Update all getZone calls in App.tsx to pass customZone**

For each call of the form `getZone(someZoneId, someSeed)` that comes from a MatchConfig or zoneId variable, add the third argument:

```ts
getZone(config.zoneId, config.randomSeed, config.customZone)
```

If the call uses a standalone `zoneId` string (not from a MatchConfig), leave it as-is.

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "fix: pass customZone to getZone in all App.tsx call sites"
```

---

### Task 8: Push and create PR

- [ ] **Step 1: Run full test suite one final time**

```bash
npx vitest run
```
Expected: all tests PASS

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Push branch**

```bash
git push
```

- [ ] **Step 4: Create PR**

```bash
gh pr create \
  --title "feat: map creator with browser storage, file import/export, and multiplayer sync" \
  --body "$(cat <<'EOF'
## Summary

- Add 2D SVG top-down map editor (MapEditor.tsx) — click-drag to place walls/crates, set spawns and bombsites, name and save
- Custom maps persist in localStorage via mapStore.ts (save, load, delete, find by name)
- MatchSetup shows a My Maps section with Create Map and Upload .json buttons
- MatchConfig extended with customZone?: ZoneDef; transmitted to clients via existing welcome message
- Clients auto-save received custom maps so they appear in their own map list after a multiplayer game
- File download (JSON export) and upload (JSON import with validation) supported

## Test plan

- [ ] Open MatchSetup → My Maps shows empty state with Create / Upload buttons
- [ ] Create Map → MapEditor opens; draw walls, place spawns, name map, Save → returns to MatchSetup with map in list
- [ ] Select custom map → Create Room → game loads on custom layout
- [ ] Download a map from MapEditor → file saved as .json
- [ ] Upload .json file in MatchSetup → appears in My Maps, selectable
- [ ] Host with custom map → client joins → client's My Maps list receives the map automatically
- [ ] \`npx vitest run\` → all tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Map creator UI (MapEditor.tsx — Task 3)
- ✅ Browser storage (mapStore.ts — Task 1)
- ✅ Map list UI in MatchSetup (Task 4)
- ✅ Download / Upload (Task 3 download, Task 4 upload)
- ✅ Multiplayer sync (Task 2 MatchConfig, Task 6 auto-save)
- ✅ Auto-add to library when client plays a new map (Task 6)
- ✅ PR creation (Task 8)

**Type consistency:**
- `SavedMap` produced in Task 1, consumed in Tasks 3, 4, 5 — consistent
- `getZone(id?, seed?, customZone?)` defined in Task 2, called in Tasks 5, 7 — consistent
- `MatchConfig.customZone` added in Task 2, used in Tasks 4 (build config), 5 (hostGame), 6 (NetClient) — consistent
- `newMapId()` exported from mapStore (Task 1), used in Tasks 3, 4, 6 — consistent
