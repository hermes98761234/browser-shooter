# Planetary Mode Visual Parity with Streets-GL

**Date:** 2026-06-29
**Status:** Ready for implementation

## Overview

Upgrade browser-shooter's planetary mode 3D rendering to visual parity with
[streets-gl](https://github.com/StrandedKitty/streets-gl), staying within the
existing Three.js forward-rendered framework. Port geometry generation, material
configuration, atmosphere, and time-of-day logic from streets-gl (MIT license).
Add terrain elevation, CSM shadows, and a post-processing chain.

## Architecture

```
PlanetaryEngine (existing ─ enhanced)
  ├── Scene
  │   ├── TerrainMesh ── displaced PlaneGeometry from DEM tiles (NEW)
  │   ├── BuildingMeshes ── extruded footprint + roof per OSM tags (REWRITE)
  │   ├── RoadMeshes ── lane markings, sidewalks (ENHANCE)
  │   ├── Trees / GreenAreas ── keep existing billboard + triangulation
  │   └── Sky ── config-driven Three.js Sky (ENHANCE)
  ├── Lighting
  │   ├── CascadedShadowMap (4 cascades, 1024×1024 each) ── replaces single 2048²
  │   ├── DirectionalLight (sun) ── keep, driven by SunSystem
  │   └── HemisphereLight (sky fill) ── keep
  └── PostProcessing (NEW)
        ├── SSAOPass ── scene AO (half-res, radius 5m)
        ├── UnrealBloomPass ── bloom (threshold 1.0)
        ├── SMAAEffect ── anti-aliasing
        └── ToneMappingEffect ── ACES Filmic
```

### Why not deferred rendering?

Streets-gl uses a custom deferred G-buffer pipeline on raw WebGL2. Three.js is
inherently forward-rendered. Building a deferred path inside Three.js requires
deep framework modifications (custom materials, custom G-buffer, custom light
accumulation shader) — weeks of work with fragile maintenance. Instead we
achieve 90% of the visual improvement by layering post-processing and material
upgrades on the existing forward pipeline. The remaining 10% (screen-space
reflections, real-time PBR with many lights) is not critical for a shooter game
at street level.

## Components

### 1. BuildingGeometry (`src/planetary/BuildingGeometry.ts`) — NEW

Generates `THREE.BufferGeometry` from OSM building data per the
[Simple 3D Buildings](https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings) schema.

**Inputs:** footprint polygon (ring of `[lng, lat]` points), building tags:
`height`, `min_height`, `building:levels`, `roof:shape`, `roof:height`,
`roof:angle`.

**Output:** One geometry with walls (vertical quads from footprint extrusion)
and roof (flat gable hipped pyramidal dome — selected by `roof:shape`).

**Roof shapes supported:**
- `flat` — horizontal top face at `height` m
- `gabled` — ridge line along longest footprint axis, triangular cross-section
- `hipped` — all walls slope inwards to a flat top
- `pyramidal` — all walls slope to a single apex point
- All others → fall back to `flat`

**Simplification rules:**
- Merge coplanar wall quads where texture continuity allows
- Skip min_height > height (malformed data)
- If height < 3 m → skip (likely noise)
- If roof:height > building height → cap to 50% of building height

**Colors:** Port streets-gl logic — map `building:colour` and `roof:colour`
OSM tags to hex, with hardcoded fallbacks:
- Wall fallback: #c8b89d (warm beige)
- Roof fallback: #8b4513 (terracotta brown)

**PBR materials** (one for walls, one for roof, one per building):
- `buildingMat`: `MeshStandardMaterial` with roughness 0.85, metalness 0.05
- `roofMat`: `MeshStandardMaterial` with roughness 0.6, metalness 0.1
- Facade texture (current `building-facade.png`) applied to walls only, tiled as before
- Roof has solid color (no texture)

### 2. CascadedShadows (`src/planetary/CascadedShadows.ts`) — NEW

Replaces the single 2048² shadow map with 4 cascades at 1024² each.

- Uses `three-csm` npm package or manual `THREE.DirectionalLight` × 4 setup with custom frustum splitting
- Cascade splits: [0-20m, 20-60m, 60-180m, 180-600m] (tuned for street-level FPS)
- All shadow-receiving objects (buildings, ground, terrain) set `receiveShadow = true`
- All shadow-casting objects (buildings, terrain) set `castShadow = true`
- Per-frame: update cascade frustums centered on camera position

### 3. PostProcessing (`src/planetary/PostProcessing.ts`) — NEW

Wraps `postprocessing` (npm) `EffectComposer` with three passes:

```
renderer output
  → SSAOPass (half-res, radius 5, samples 16)
  → UnrealBloomPass (threshold 1.0, strength 0.5, radius 0.4)
  → SMAAEffect (edge detection, 1 pass)
  → ToneMappingEffect (ACES Filmic)
  → screen
```

Quality presets:
| Preset | SSAO res | SSAO samples | Bloom res | SMAA |
|--------|----------|--------------|-----------|------|
| low    | quarter  | 8            | off       | off  |
| medium | half     | 16           | half      | on   |
| high   | full     | 32           | full      | on   |

Auto-select: `medium` by default. If `performance.now()` reports < 30 fps
after 5 seconds of runtime, degrade to `low`. If `devicePixelRatio < 1.5`
and screen width < 1024 → `low`.

**Graceful degradation:** If the EffectComposer fails to initialize (WebGL
context issues, mobile GL), fall back to raw renderer with no post-processing.

**Dependency:** `postprocessing` npm package (already compatible with
Three.js 0.170+).

### 4. AtmosphereConfig (`src/planetary/AtmosphereConfig.ts`) — NEW

Computes sky / fog / directional-light colors from sun elevation angle.

- Port streets-gl's sun-elevation → color mapping logic
- Drives `THREE.Sky` uniforms (turbidity, rayleigh, mieCoefficient,
  mieDirectionalG) and THREE.Fog color
- Public method: `update(sunElevationRad: number)` — called each frame from
  `SunSystem` tick
- Sun elevation ranges:
  - < -0.1 rad (below horizon): night fog, dark sky
  - -0.1 to 0.1 rad: sunrise/sunset colors (orange, pink horizon)
  - 0.1 to 0.6 rad: daytime (blue sky, white fog)
  - > 0.6 rad: midday (deeper blue, minimal fog)

### 5. TerrainElevation (`src/planetary/TerrainElevation.ts`) — NEW

Adds a raster-DEM tile source to MapLibre and builds a heightfield mesh.

**Data source:** MapLibre-compatible Terrain-DEM tiles (RGB-encoded elevation,
where R×256 + G + B/256 − 32768 = meters).
URL must be tested and may be substituted during implementation. Candidate sources:
`maplibre://demotiles/terrain-tiles` (built-in), `https://api.maptiler.com/tiles/terrain-rgb-v2/`
(needs API key), or any public RGB terrain tile server.

**Approach:**
1. Add a `raster-dem` source to the MapLibre map pointing to
   `https://tiles.openfreemap.org/terrain/{z}/{x}/{y}.png` (if available)
   or equivalent free DEM source.
2. Once tiles load, sample elevation at each point of a regularly-spaced grid
   covering the visible area (grid ~2 m resolution, or 256 × 256 points over a
   500 m radius around player).
3. Build a `THREE.PlaneGeometry` with vertices displaced from sampled heights.
4. Each plane cell is ~2 m × 2 m. UV-mapped with a ground texture (existing
   green/grass color, or new terrain-shaded material).
5. Terrain mesh updates lazily — only when the player moves more than 100 m
   from the last sample position.

**Fallback:** If DEM tiles fail to load (network error, tile source offline),
terrain stays flat (current behavior). Log a warning once, don't spam.

**Texture:** Use ground color from an existing grass texture or a solid color
with slight noise (no external texture dependency).

### 6. TerrainShading (`src/planetary/TerrainShading.ts`) — NEW (in TerrainElevation)

Instead of a flat green ground:
- **Triplanar-mapped grass/dirt material** — the terrain mesh samples a small
  procedural grass texture from all three axes (XY, XZ, YZ) to avoid stretching
  on steep slopes.
- Material: `MeshStandardMaterial` with roughness 0.95, metalness 0.
- If triplanar shader is too complex, fall back to simple XZ UV unwrap + scale.

### 7. Road Enhancements

Enhance road rendering beyond flat quads:
- **Road material**: roughness 1.0, metalness 0 — keep existing
- **Lane markings**: add a thin white center-line quad 0.1 m wide, offset
  0.02 m above road surface, every 10 m along road strips
- **Sidewalks**: add narrow raised quads (0.15 m height, ~1.5 m width) along
  building-facing edges of roads — where OSM data includes `sidewalk=both`
  or `sidewalk=right/left`

If OSM sidewalk data is unavailable for a tile (common), skip sidewalks
for that tile.

### 8. Exposed Engine API (`PlanetaryEngine.ts` — ENHANCE)

New public methods:
- `setPostProcessingPreset(preset: 'low' | 'medium' | 'high')`
- `setTimeOfDay(hours: number)` — convenience to drive `SunSystem`
- `getTerrainHeight(x: number, z: number): number` — for
  vehicle/bot/weapon ground snapping

Existing methods preserved: `setViewFromPlayer`, `setBuildings`,
`setRoads`, `setTrees`, `setGreenAreas`, `render`, `dispose`.

### 9. Config (`src/planetary/PlanetaryConfig.ts`) — NEW

Centralized constants so tuning doesn't require code changes:

```ts
export const PLANETARY_CONFIG = {
  shadows: {
    cascadeCount: 4,
    cascadeResolution: 1024,
    cascadeSplits: [20, 60, 180, 600],
  },
  post: {
    defaultPreset: 'medium',
    ssaoRadius: 5,
    bloomThreshold: 1.0,
    bloomStrength: 0.5,
  },
  terrain: {
    gridResolution: 2,    // meters between samples
    gridRadius: 500,       // meters from player
    refreshDistance: 100,  // meters player must move to re-sample
  },
  building: {
    minHeight: 3,
    simplifyBuildings: false,
  },
}
```

## Data Flow

```
MapLibre (data source only — not rendered)
  │
  ├─ vector tile layers (buildings, roads, landuse, etc.)
  │    → queryRenderedFeatures / querySourceFeatures
  │    → BuildingGeometry.generate() → BufferGeometry → BuildingMeshes
  │    → Road rendering → RoadMeshes
  │
  └─ raster-dem tiles
       → map.queryTerrainElevation(lnglat) per grid point
       → TerrainElevation → displaced BufferGeometry → TerrainMesh

SunSystem (time-of-day tick)
  │
  ├→ AtmosphereConfig.update(sunElevation)
  │   ├→ Sky shader uniforms
  │   ├→ Fog color
  │   └→ HemisphereLight color
  │
  ├→ DirectionalLight position/intensity/color
  │
  └→ CascadedShadows.update(sun direction, camera pos)

Main render loop:
  1. Update sun position
  2. Update atmosphere
  3. Update cascade shadow maps
  4. Render scene to EffectComposer input
  5. Post-processing pass
  6. Composite to canvas

PlanetaryMode component
  └→ PlanetaryEngine instance (manages scene, rendering)
```

## Error Handling

| Failure | Behavior |
|---------|----------|
| DEM tiles fail/404/network error | Fall back to flat ground; log once |
| EffectComposer init fails | Render without post-processing; log once |
| OSM building with 0 or NaN height | Skip building; log warning |
| Unknown `roof:shape` value | Fall back to flat roof |
| Building footprint has < 3 vertices | Skip building |
| Texture loader fails | Use solid color fallback (existing) |
| Post-processing drops below 20 fps | Auto-degrade to `low` preset |
| CascadedShadowMap not supported (old browser) | Fall back to single shadow map |

## Testing

- `BuildingGeometry.test.ts`: verify vertex count for gable roof (specific
  footprint produces correct triangles), flat roof, hipped roof; verify
  minHeight < 3 filter; verify degenerate polygon rejection
- `CascadedShadows.test.ts`: verify cascade count, split distances match config;
  verify shadow map size allocations
- `AtmosphereConfig.test.ts`: verify sun elevation 0 rad → daytime colors;
  -0.3 → night colors; 0.0 → sunrise colors
- `TerrainElevation.test.ts`: verify grid generation dimensions; verify lazy
  refresh triggers at >100 m; verify fallback when DEM unavailable
- `PlanetaryEngine.test.ts` (extend): engine initializes with post-processing
  EffectComposer; `dispose()` cleans up all new resources
- Existing tests must continue to pass (no regressions)

## Non-Goals (explicitly out of scope)

- Real-time reflections / SSR
- TAA (too complex for forward renderer)
- Water rendering (coastlines, rivers)
- Air traffic visualization
- Labels / text rendering
- Depth of field
- Deferred rendering
- WebGPU migration
- Mobile-specific shader variants (handled by quality preset auto-degrade)

## Streets-GL Code to Port (MIT license)

| Source file (streets-gl) | What we port | Our destination |
|---|---|---|
| `app/objects/TileExtrudedMesh.ts` | Building extrusion + roof shape geometry math | `BuildingGeometry.ts` |
| `app/objects/Skybox.ts` | Sun elevation → sky color mapping constants | `AtmosphereConfig.ts` |
| `app/systems/MapTimeSystem.ts` | Sun azimuth/altitude calculation from lat/lng/date | Extend `SunSystem.ts` |
| `app/objects/TileHuggingMesh.ts` | Terrain mesh generation from height samples | `TerrainElevation.ts` |

No external runtime dependency on streets-gl — we copy the relevant math
into standalone files.

## Dependencies to Add

```json
"postprocessing": "^6.36.0"
```

(postprocessing v6 works with Three.js 0.160+; we're on 0.170)
