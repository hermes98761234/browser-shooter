# streets-gl Visual Detail — Design Spec

**Date:** 2026-06-29  
**Status:** Approved

## Goal

Upgrade the Planetary Mode 3D scene from plain gray boxes + flat green ground to a streets-gl–level rendering with textured building facades, OSM-sourced road geometry, billboard trees, green area meshes, real-time shadow maps, and a dynamic sun / time-of-day system. All visual assets copied from the streets-gl repository (MIT licensed, same as this project).

## Context

Current rendering pipeline:
- MapLibre GL loaded as a hidden OSM tile source
- `PlanetaryCollision` queries `queryRenderedFeatures` on `idle` → building boxes → `BoxCollider`
- `PlanetaryEngine.setBuildings()` renders boxes as plain gray `MeshStandardMaterial`
- Ground: flat `PlaneGeometry` with solid green color
- No roads, no trees, no shadows, fixed daytime sky color

## Architecture

### New files

#### `src/planetary/PlanetaryScenery.ts`
Mirrors `PlanetaryCollision` in structure — queries MapLibre rendered features on `idle` for non-building OSM layers and converts to local coordinate space.

Queries:
- **Roads**: query layers in priority order: `transportation`, `road`, `road_link`. The OpenFreeMap liberty style uses `transportation` at zoom 17. `queryRenderedFeatures` is called with all three names and returns only those that exist — no error if a layer is absent. Feature geometry: `LineString`/`MultiLineString`. Each segment is buffered to road half-width by type:
  - `motorway`, `trunk`: 8 m half-width
  - `primary`, `secondary`: 6 m
  - `tertiary`, `residential`, `service`: 4 m
  - `path`, `footway`, `cycleway`: 2 m
  - Unknown: 3 m default
  Output: array of `RoadStrip` — four corner points (local XZ) + length for UV tiling.
- **Trees**: layer `poi_label` or `nature` filtered to `natural=tree`. Feature geometry: `Point`. Output: array of `THREE.Vector3` (local XZ, Y=0).
- **Green areas**: layers `landuse`, `landcover` filtered to `class=grass|park|forest|farmland`. Feature geometry: `Polygon`/`MultiPolygon`. Triangulated with `earcut`. Output: flat `Float32Array` of XZ vertices (Y=0).

Triggers: same `markStale()` + `update(lng, lat)` pattern as `PlanetaryCollision`, with identical 50 m rescan gate and `rebuildVersion` counter.

Returns structured data typed as:
```ts
interface RoadStrip {
  corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]  // quad in XZ
  uvLength: number  // road length in meters for UV tiling
}

interface SceneryData {
  roads: RoadStrip[]
  treePositions: THREE.Vector3[]
  greenTriangles: Float32Array  // flat [x,z, x,z, ...]
}
```

#### `src/planetary/SunSystem.ts`
Converts a time-of-day value (0–24 h) to sun position and light properties.

```ts
interface SunState {
  direction: THREE.Vector3   // normalized, pointing toward sun
  color: THREE.Color
  intensity: number          // 0 at night, 1.2 at noon
  skyTop: THREE.Color
  skyHorizon: THREE.Color
}

class SunSystem {
  compute(hour: number): SunState
}
```

Sun elevation: `Math.sin((hour - 6) / 12 * Math.PI)` clamped to [-0.2, 1].  
Azimuth: fixed south (rotates 180° from east to west over the day).  
Color: interpolated through keyframes: dawn `#ff9060`, noon `#ffffff`, dusk `#ff6030`, night `#102040`.  
Sky top: `#1a1a4a` → `#4a90d9` → `#87ceeb` → `#4a90d9` → `#1a1a4a`.  
Sky horizon: `#ff6035` → `#9ec7e8` → `#9ec7e8` → `#ff6035` → `#1a1a4a`.

### Modified files

#### `src/planetary/PlanetaryEngine.ts`

New methods added:

**`setBuildings(boxes)`** (already exists — enhanced):  
- Apply `buildingFacadeTex` (loaded once from `src/planetary/assets/building-facade.png`) to all building faces via UV repeat.  
- Tint material color per building using a small palette derived from OSM `building:colour` (passed as metadata alongside boxes). Default: `#c8c0b0`.

**`setRoads(roads: RoadStrip[])`**:  
- Disposes old road group.  
- For each `RoadStrip`, creates a `PlaneGeometry` (two triangles) oriented in XZ, UV-tiled so asphalt texture tiles every 4 m.  
- All road planes share one `MeshStandardMaterial` with `roadAsphaltTex`.  
- Lane marking overlay: thin white `PlaneGeometry` centered on each strip, UV-mapped to a dashed line pattern (can use a 4×64 px white dash texture or procedural UV trick).

**`setTrees(positions: THREE.Vector3[])`**:  
- Disposes old tree group.  
- Use `THREE.InstancedMesh` with a `PlaneGeometry(6, 10)` and `MeshBasicMaterial` (`side=DoubleSide`, `transparent=true`, `alphaTest=0.5`, `map=treeSpriteTex`). Billboard: reset each instance's Y-rotation to face the camera each frame before rendering. One draw call for all trees regardless of count.  
- `treeSpriteTex` from `src/planetary/assets/tree-sprite.png`.  
- Scale: 10 m tall × 6 m wide. `castShadow = true`. Culled beyond 120 m from player.

**`setGreenAreas(triangles: Float32Array)`**:  
- Replaces the static ground `PlaneGeometry` only within OSM green area bounds.  
- Creates a `BufferGeometry` from the flat XZ array, Y=0, with UV = X/4, Z/4 for 4 m grass tile repeat.  
- `grassTex` from a seamless grass texture (can reuse streets-gl's ground texture if available, otherwise three.js stock or a free CC0 texture).

**`setSunAngle(state: SunState)`**:  
- Sets `this.sun.position` to `state.direction.multiplyScalar(200)`.  
- Sets `this.sun.color` and `this.sun.intensity`.  
- Updates `THREE.Sky` shader uniforms (sun position, turbidity, rayleigh, mieCoefficient).  
- Updates fog color to `state.skyHorizon`.

**Shadow setup** (constructor):  
```ts
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 400
sun.shadow.camera.left = sun.shadow.camera.bottom = -125
sun.shadow.camera.right = sun.shadow.camera.top = 125
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
```
Shadow camera follows player each frame: `sun.shadow.camera.position.copy(playerPos)`.

**Sky** (constructor):  
Add `THREE.Sky` (from `three/addons/objects/Sky.js`) to scene. Remove hardcoded `scene.background` color.

#### `src/planetary/PlanetaryMode.tsx`

- Add `sceneryRef = useRef<PlanetaryScenery | null>(null)` alongside `collisionRef`.
- On `engine.onReady`: instantiate `PlanetaryScenery` with same map + `toLocal` converter.
- On map `idle`: call `sceneryRef.current.markStale()` (same pattern as collision).
- In game loop: call `sceneryRef.current.update(center.lng, center.lat)`, check `rebuildVersion`, call `engine.setRoads/setTrees/setGreenAreas` when version changes.
- Add `sunHour` state (default 10.5 — mid-morning).
- Each frame: `engine.setSunAngle(sunSystem.compute(sunHour))`.
- Add time-of-day slider UI: `<input type="range" min={0} max={24} step={0.1} value={sunHour} onChange={e => setSunHour(+e.target.value)}/>` positioned in top-left above the [M] Map button. Label shows time as `HH:MM`.

### Assets

Directory: `src/planetary/assets/`

| File | Source | Usage |
|------|--------|-------|
| `building-facade.png` | streets-gl repo | UV-repeated on building walls |
| `road-asphalt.png` | streets-gl repo | UV-tiled along road geometry |
| `tree-sprite.png` | streets-gl repo | Billboard sprite for trees |

All three are MIT licensed. Copy verbatim from the streets-gl `public/` or `src/assets/` directory. No modifications needed.

Loaded in `PlanetaryEngine` constructor via `THREE.TextureLoader`. Textures set to `wrapS = wrapT = THREE.RepeatWrapping`.

## Data flow

```
map 'idle'
  ├─ PlanetaryCollision.markStale() → .update() → rebuildVersion++
  │     PlanetaryEngine.setBuildings(boxes)         [existing]
  └─ PlanetaryScenery.markStale() → .update() → rebuildVersion++
        PlanetaryEngine.setRoads(roads)             [new]
        PlanetaryEngine.setTrees(trees)             [new]
        PlanetaryEngine.setGreenAreas(triangles)    [new]

game loop (per frame)
  └─ engine.setSunAngle(sunSystem.compute(sunHour))
  └─ sun.shadow.camera follows player position
```

## Performance

- Road geometry: typically 20–80 strips in view → negligible draw calls (all share one material).
- Trees: InstancedMesh when >20 → one draw call for N trees.
- Green areas: one merged BufferGeometry per rebuild.
- Shadow map: 2048 px, updated every frame but frustum is tight (250 m). Acceptable on mid-range GPU.
- Rescan gate: 50 m travel before scenery rebuilds (same as buildings).

## Out of scope

- Night street lighting (lamp posts) — deferred.
- Building roof details — deferred.
- Road intersections with proper geometry — roads overlap at intersections (acceptable for game use).
- Dynamic weather / rain effects — deferred.
- LOD for distant buildings — deferred.

## Testing

- Unit tests for `SunSystem.compute()`: verify direction.y > 0 at noon, ≤ 0 at midnight.
- Unit tests for `PlanetaryScenery`: mock `queryRenderedFeatures` returning a road LineString, assert `roads` array has correct half-width buffer.
- Manual verification: spawn in a city area with visible roads and trees; confirm textures appear, shadows render, time-of-day slider moves the sun.
