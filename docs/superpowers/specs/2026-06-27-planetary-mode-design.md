# Planetary Mode Design

**Date**: 2026-06-27  
**Project**: browser-shooter  
**Feature**: Planetary Mode — real-world OSM map, full FPS game loop, jump anywhere on Earth

---

## Overview

A new game mode added to browser-shooter where the map is the entire Earth, rendered in realtime from MapLibre GL vector tiles. Players drop into any city via a 2D map picker, walk around in first-person, and play a full CS-style game (rounds, economy, bomb) with buildings and roads sourced from OSM.

---

## Architecture

MapLibre GL JS owns the WebGL context and renders the world (buildings, roads, terrain). A Three.js `CustomLayerInterface` shares the same WebGL context to render game objects (players, weapons, bullets, effects). The existing game engine (weapons, economy, rounds, bots, networking) is ported unchanged — only player position format changes from `{x,y,z}` to `{lat,lon,bearing,pitch}`.

```
┌─────────────────────────────────────────────────────┐
│                  PLANETARY MODE                      │
│                                                      │
│  MapLibre GL JS (WebGL context owner)                │
│  • Renders world: buildings, roads, terrain          │
│  • Camera: lat/lon + pitch + bearing                 │
│  • Tile fetching, LRU cache, zoom math               │
│         │                                            │
│         │ CustomLayerInterface                       │
│         ▼                                            │
│  Three.js (shares WebGL context)                     │
│  • Renders game objects: players, weapons, effects   │
│  • Uses MapLibre's mercatorMatrix each frame         │
│                                                      │
│  Existing Game Engine (unchanged logic)              │
│  • Weapons, economy, rounds, bomb                    │
│  • Bots (navmesh from road tiles)                    │
│  • WebRTC P2P networking                             │
│                                                      │
│  Map Picker Overlay (2D MapLibre instance)           │
│  • Live player dots at real lat/lon                  │
│  • Click → fade → teleport into first-person         │
└─────────────────────────────────────────────────────┘
```

---

## Map Picker

- Fullscreen 2D MapLibre overlay, shown at mode entry and on `M` key
- Separate MapLibre instance from the game renderer
- Live player dots drawn from WebRTC position state (lat/lon)
- Click anywhere → fade to black → switch to first-person at that lat/lon
- MapLibre streams tiles for the clicked location automatically before spawning player

---

## FPS Camera

MapLibre owns the camera. Game inputs translate to MapLibre camera calls:

| Input | MapLibre call |
|-------|--------------|
| Mouse X | `map.setBearing(bearing + dx * sensitivity)` |
| Mouse Y | `map.setPitch(clamp(pitch + dy, 0, 85))` |
| WASD | `map.setCenter(offsetLatLon(center, bearing, speed))` |
| Player height | Fixed altitude offset in mercatorMatrix |

Three.js reads `mercatorMatrix` each frame to keep game objects geo-aligned with the world.

---

## Collision

`map.queryRenderedFeatures({ layers: ['building'] })` returns visible building footprints with height. These are converted to AABBs and fed into the existing `CollisionWorld`:

- Re-query only when player moves > 50m
- Extrude polygon footprint + height → AABB
- Pass AABB set to `CollisionWorld.update(boxes)`

---

## Bot Navigation

Road network from vector tiles becomes a runtime navmesh near the active play area:

- `queryRenderedFeatures({ layers: ['road'] })` → road linestrings
- Build graph: nodes = intersections, edges = road segments
- A* pathfinding on graph for bot waypoints
- Existing bot steering code unchanged

---

## Spawn Points

- Query OSM `park`, `plaza`, `pitch` features near dropped location for open areas
- Fall back to road intersections if no open areas found
- Spawn radius: 200m from drop point

---

## Game Logic Port

**Unchanged**: weapons, economy, buy menu, bomb/round system, HUD, WebRTC networking, voice chat.

**Changed**: player position schema `{x,y,z}` → `{lat,lon,bearing,pitch}`. Networking already serializes as JSON — schema change only, no logic change.

**Mode entry**: new mode select screen before arena:
```
[Arena Mode]     ← existing
[Planetary Mode] ← new → map picker → drop → full game loop
```

**Round boundaries** (no fixed map edges):
- Round area = 500m radius around median player position
- Bomb sites = 2 largest open areas within that radius
- Out-of-bounds: warn at 600m, eliminated at 700m

---

## What's Not In Scope

- Replacing Three.js renderer (MapLibre handles world rendering)
- Offline tile preprocessing / CDN pipeline (MapLibre tiles used directly)
- LOD billboard impostors (MapLibre handles its own LOD)
- Planetary-scale origin rebasing (MapLibre + mercatorMatrix handles precision)
