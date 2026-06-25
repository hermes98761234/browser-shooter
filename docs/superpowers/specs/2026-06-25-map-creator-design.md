# Map Creator Design

**Date:** 2026-06-25  
**Status:** Approved (via /goal mandate)

## Overview

Allow players to create, save, share, and play on custom maps. Custom maps are `ZoneDef` objects stored in `localStorage`, shareable as JSON files, and automatically synced to all players in a multiplayer match via the existing `welcome` message.

---

## Data Model

### `SavedMap` envelope

```ts
interface SavedMap {
  id: string        // nanoid (8 chars)
  name: string
  createdAt: number // Date.now()
  zone: ZoneDef
}
```

Stored as `JSON.stringify(SavedMap[])` in `localStorage` under key `'browser-shooter-maps'`.

Maps are small (~5–20 KB each). `localStorage` (5 MB typical limit) holds hundreds of maps comfortably.

### `ZoneDef` shape (existing, unchanged)

```ts
interface ZoneDef {
  id: string; name: string; description: string
  arenaSize: number           // half-extent, e.g. 30
  floorColor: number; skyColor?: number
  fogNear?: number; fogFar?: number
  lighting: ZoneLighting
  structures: ZoneStructure[] // [{center:[x,y,z], size:[w,h,d], material}]
  ctSpawns: [number,number][] // [x,z] pairs
  tSpawns: [number,number][]  // [x,z] pairs
  bombsites: ZoneBombsite[]   // [{id:'A'|'B', center:[x,z]}]
}
```

---

## MatchConfig Extension

Add one optional field to `MatchConfig`:

```ts
customZone?: ZoneDef  // present when zoneId === 'custom'
```

The existing `welcome` message already transmits the full `MatchConfig` to clients, so no protocol changes are needed — the `customZone` rides along for free.

---

## Components

### `src/zones/mapStore.ts` (new)

Pure CRUD module, no React dependency:

```ts
loadMaps(): SavedMap[]
saveMap(map: SavedMap): void     // upsert by id
deleteMap(id: string): void
findByName(name: string): SavedMap | undefined
```

Used by MapEditor and auto-save on client receive.

### `src/ui/MapEditor.tsx` (new)

A full-screen editor screen with two panels:

**Left panel — tool palette + settings:**
- Tool selector: `Wall | Crate | Concrete | Metal | Wood | T-Spawn | CT-Spawn | Bombsite-A | Bombsite-B | Eraser`
- Map name text input
- Arena size selector (20 / 30 / 40 half-extent)
- Floor color picker (hex input)
- Sky color picker
- Theme preset buttons (daylight / dusk / night)
- Save button → writes to `MapStore`
- Download button → exports JSON file
- Cancel button

**Right panel — 2D top-down SVG canvas:**
- Grid lines at 1-unit intervals
- Rendered `ZoneStructure` boxes as colored SVG rects
- Spawn point markers (T=orange circle, CT=blue circle)
- Bombsite zones (A=red circle, B=green circle)
- **Wall placement:** click-drag draws a rectangle
- **Other structures:** single click places at snapped grid cell
- **Eraser:** click removes the hovered element
- Click any placed element to select it and delete (Delete key)

The editor maintains local state as a `ZoneDef` draft. On Save it wraps in a `SavedMap` envelope and calls `mapStore.saveMap()`.

### `src/ui/MatchSetup.tsx` (modified)

Below the existing zone selector buttons, add:

1. **"My Maps" section** — renders a button per `SavedMap` from `mapStore.loadMaps()`. Selecting one sets `zoneId: 'custom'` and attaches the zone inline.
2. **"Create Map" button** — navigates to `MapEditor` screen.
3. **"Upload Map" button** — hidden `<input type="file" accept=".json">` trigger; parses the file and adds it to the map list, then selects it.

### `src/zones/registry.ts` (modified)

Handle the new `'custom'` zone id:

```ts
// when zoneId === 'custom', caller must pass customZone directly
export function getZone(zoneId: string, seed?: number, customZone?: ZoneDef): ZoneDef {
  if (zoneId === 'custom' && customZone) return customZone
  // ... existing lookup
}
```

### `src/session/MatchConfig.ts` (modified)

Add `customZone?: ZoneDef` field.

### `src/net/NetClient.ts` (modified)

On `welcome` message receipt, if `config.customZone` exists, call `mapStore.saveMap()` to add it to the player's local library (skip if a map with the same name already exists).

### `src/App.tsx` (modified)

- Add `'mapEditor'` to the app screen state union
- Render `<MapEditor onSave={...} onCancel={...} />` when active
- When host creates match with `zoneId === 'custom'`, pass `customZone` into `MatchConfig` before creating `GameSession`

---

## Multiplayer Sync Flow

```
Host                                  Client
────────────────────────────────────────────
Select custom map in MatchSetup
  ↓
MatchConfig = { zoneId: 'custom', customZone: ZoneDef }
  ↓
new GameSession(config)
  getZone('custom', _, customZone) → ZoneDef
  ↓
Client joins
  ↓
send 'welcome' { ...config }        → receive welcome
                                       config.customZone → loadZone
                                       mapStore.saveMap(customZone)
                                       ↓
                                       Map appears in client's My Maps list
```

---

## Download / Upload Format

```json
{
  "version": 1,
  "name": "My Map",
  "zone": { ...ZoneDef }
}
```

- **Download:** `URL.createObjectURL(new Blob([JSON.stringify(envelope)], {type:'application/json'}))` → auto-click `<a download="mapname.json">`
- **Upload:** `FileReader.readAsText` → `JSON.parse` → validate `zone.arenaSize` and `zone.structures` exist → `mapStore.saveMap()` or immediate use

---

## Validation

On upload/import, check:
- `zone.arenaSize` is a positive number
- `zone.structures` is an array
- `zone.ctSpawns.length >= 1` and `zone.tSpawns.length >= 1`
- `zone.bombsites.length === 2` (for competitive modes; warn only, don't block)

Reject with an inline error message if invalid JSON or missing required fields.

---

## Testing

- Unit test `mapStore.ts`: save, load, delete, findByName (using `localStorage` mock)
- E2e: create a map, save it, select it in MatchSetup, start a solo match — verify the custom map loads
