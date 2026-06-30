# Planetary Visual Parity v2 — Corrected Implementation Plan

Reimplementation of the reverted visual-parity effort, scoped to the **lean working subset**
plus a **building data-pipeline rewrite**. Bakes in fixes for the bugs that sank v1.

## Global Constraints (binding — reviewers copy verbatim)

- **three** `^0.170`, **postprocessing** `^6.36.0` (installed). Vitest + jsdom for tests.
- **No DEM terrain. No cascaded shadows. No astronomical sun.** Keep the existing single
  2048² shadow map and the existing deterministic `SunSystem`.
- **BuildingGeometry returns ONE `THREE.BufferGeometry` with two material groups**
  (group 0 = walls → materialIndex 0; group 1 = roof → materialIndex 1). The caller builds
  `new THREE.Mesh(geo, [wallMat, roofMat])`. **No external buffer-slicing** (that path caused
  the v1 double-offset bug).
- **Building footprints are absolute local XZ meters.** Geometry is built at those absolute
  coordinates; the mesh is added at the group origin with **no `.position` offset**. This is
  the rule that prevents the double-offset bug — do not reintroduce a per-mesh position.
- **PostProcessing must use the postprocessing v6 API exactly:**
  `new EffectPass(camera, ...effects)` (camera first — never `undefined`),
  `new SMAAEffect({ preset: SMAAPreset.MEDIUM })`,
  `new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })`,
  `new BloomEffect({ blendFunction: BlendFunction.SCREEN, ... })`. No SSAO, no NormalPass.
- **Graceful degradation:** if `EffectComposer` construction throws, `composer = null` and the
  engine renders with `renderer.render(scene, camera)`.
- Verify with `npm run build` (NOT just `tsc --noEmit` — it misses test-file type errors)
  and `npm run lint` and `npm run test`.

---

## Task 1: PlanetaryConfig

**File (NEW):** `src/planetary/PlanetaryConfig.ts`

Centralized constants. Only what the lean subset uses:

```typescript
export const PLANETARY_CONFIG = {
  post: {
    defaultPreset: 'medium' as 'low' | 'medium' | 'high',
    bloomThreshold: 1.0,
    bloomIntensity: 0.5,
  },
  building: {
    minHeight: 3,
    wallColor: 0xc8b89d,   // warm beige fallback
    roofColor: 0x8b4513,   // terracotta fallback
  },
}
```

**Verify:** `npm run build`. **Commit:** `feat(planetary): add PlanetaryConfig constants`.

---

## Task 2: AtmosphereConfig (TDD)

**Files (NEW):** `src/planetary/AtmosphereConfig.ts`, `src/planetary/__tests__/AtmosphereConfig.test.ts`

Maps sun **elevation in radians** to atmosphere state. Pure function of elevation — no Three.js
renderer needed, testable in jsdom.

```typescript
import * as THREE from 'three'

export interface AtmosphereState {
  turbidity: number
  rayleigh: number
  mieCoefficient: number
  mieDirectionalG: number
  fogColor: THREE.Color
  sunColor: THREE.Color
  sunIntensity: number
  hemiSky: THREE.Color     // HemisphereLight sky color
  hemiGround: THREE.Color   // HemisphereLight ground color
  hemiIntensity: number
}
```

`AtmosphereConfig.update(sunElevationRad: number): AtmosphereState` — piecewise-lerp between
named keyframes (night < -0.1, sunrise around 0, day, midday > 0.6). Use `THREE.Color.lerpColors`
and numeric lerp. Store and expose last state via a `state` getter.

Keyframe intent (tune freely, keep monotonic where noted):
- **night** (elev < -0.1): sunIntensity 0, fog `0x080810` (r < 0.1), hemiIntensity ~0.15.
- **sunrise/sunset** (~0): warm — fog & sun r > 0.5 (orange `~0xff7030` / `~0xff6020`).
- **day** (0.05–0.6): fog `~0x9ec7e8`, sun white, sunIntensity ~1.2, hemiIntensity ~0.6.
- **midday** (> 0.6): deeper blue fog, sunIntensity ~1.4.

**Tests (write FIRST, must fail before impl):**
- elev `-0.2` → `sunIntensity === 0`, `fogColor.r < 0.1`.
- elev `0.5` → `sunIntensity > 1.0`, `sunColor.r > 0.9`.
- elev `0.0` → `fogColor.r > 0.5` and `sunColor.r > 0.5` (warm).

**Verify:** `npx vitest run src/planetary/__tests__/AtmosphereConfig.test.ts` (3 pass), `npm run build`.
**Commit:** `feat(planetary): add AtmosphereConfig — sun-elevation→sky/fog mapping`.

---

## Task 3: BuildingGeometry (TDD)

**Files (NEW):** `src/planetary/BuildingGeometry.ts`, `src/planetary/__tests__/BuildingGeometry.test.ts`

```typescript
export interface BuildingSpec {
  footprint: [number, number][]   // ring of absolute local [x, z] meters; may be open or closed
  height: number                   // absolute top Y (meters)
  minHeight?: number               // ground Y (default 0)
  roofShape?: string               // 'flat' | 'gabled' | 'hipped' | 'pyramidal' | other→flat
  roofHeight?: number              // peak rise above `height`'s eave; capped to 50% of wall height
}
```

`static generate(spec: BuildingSpec): THREE.BufferGeometry`

Rules:
- Throw if footprint (after dropping a duplicate closing point) has < 3 vertices.
- Throw if `height < PLANETARY_CONFIG.building.minHeight`.
- Walls: extrude each footprint edge from `minHeight` to `height` as two triangles, outward
  normal `(-dz, 0, dx)/len`. UV: u = cumulative edge length / 4, v = wallHeight / 4.
- Roof: build at `height` (flat) or rising to `height + min(roofHeight, wallHeight*0.5)`.
  - `flat` / no roofHeight: fan-triangulate the top polygon, normal `(0,1,0)`.
  - `gabled`: ridge along the longest footprint axis through the centroid; two sloped quads +
    two gable-end triangles. **No degenerate triangles** (the v1 `addTriangle3D(Vj, Vr, Vr)` is
    a bug — do not emit any triangle with a repeated vertex).
  - `hipped`: edges slope inward to an inset top polygon at the ridge height.
  - `pyramidal`: every edge slopes to the centroid apex.
  - unknown shape → flat.
- Compute correct per-triangle normals for all roof faces (use the cross product; never leave a
  zero-length normal — fall back to `(0,1,0)`).
- Build NON-indexed position/normal/uv `Float32Array`s. Emit **walls first, then roof**. Then:
  `geo.addGroup(0, wallVertCount, 0)` and `geo.addGroup(wallVertCount, roofVertCount, 1)`.

**Tests (write FIRST):** flat roof generates > 0 verts and has 2 groups with materialIndex 0 and 1;
gabled roof generates > 20 verts and contains **no degenerate triangles** (assert every triangle
has 3 distinct positions); `< 3` vertices throws; `height 2` throws; `roofHeight 8` on `height 10`
still produces valid geometry (cap applied); unknown shape `'onion'` falls back to flat (no throw).

**Verify:** `npx vitest run src/planetary/__tests__/BuildingGeometry.test.ts`, `npm run build`.
**Commit:** `feat(planetary): BuildingGeometry — footprint walls + roofs, two material groups`.

---

## Task 4: PostProcessing

**File (NEW):** `src/planetary/PostProcessing.ts`

```typescript
import {
  EffectComposer, RenderPass, EffectPass,
  BloomEffect, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode,
  BlendFunction, KernelSize,
} from 'postprocessing'
import type * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

export type PostQuality = 'low' | 'medium' | 'high'

export class PostProcessing {
  composer: EffectComposer | null = null
  // bloom + smaa + tonemapping; preset gates bloom/smaa on/off (low = tonemapping only)
}
```

- Constructor `(renderer, scene, camera)`: in a `try`, build composer, add `RenderPass`, build
  effects, add a single `EffectPass(camera, ...activeEffects)`. On any throw → `composer = null`.
- Active effects by preset: `low` = `[tone]`; `medium`/`high` = `[bloom, smaa, tone]`.
- `setQuality(preset)`: rebuild the EffectPass (remove old EffectPass, add new) when preset changes.
- `render(dt: number)`: `if (this.composer) this.composer.render(dt)` — caller handles the no-post path.
- `setSize(w, h)`: `this.composer?.setSize(w, h)`.
- `get active(): boolean` → `this.composer !== null`.
- `dispose()`: dispose composer + effects.

**Exact v6 API (do not deviate):**
`new BloomEffect({ blendFunction: BlendFunction.SCREEN, kernelSize: KernelSize.MEDIUM, luminanceThreshold: PLANETARY_CONFIG.post.bloomThreshold, luminanceSmoothing: 0.1, intensity: PLANETARY_CONFIG.post.bloomIntensity })`,
`new SMAAEffect({ preset: SMAAPreset.MEDIUM })`,
`new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })`,
`new EffectPass(camera, ...effects)`.

**Verify:** `npm run build`. **Commit:** `feat(planetary): PostProcessing — bloom/SMAA/ACES, graceful fallback`.

---

## Task 5: PlanetaryScenery.extractBuildings (modify)

**File:** `src/planetary/PlanetaryScenery.ts`

- Add `const BUILDING_LAYERS = ['building']`.
- Add to `SceneryData`: `buildings: BuildingSpec[]` (import `BuildingSpec` from `./BuildingGeometry`).
- New private `extractBuildings(): BuildingSpec[]`:
  - `queryRenderedFeatures(undefined, { layers: BUILDING_LAYERS })`.
  - Polygon → rings `[coords[0]]`; MultiPolygon → `coords.map(p => p[0])`. Skip others.
  - Each ring: map `[lng, lat]` → `this.toLocal(lng, lat)` → `[x, z]`.
  - `height = Number(props.render_height ?? props.height ?? (Number(props['building:levels']) * 3) ?? 6)`;
    guard `NaN`/`<= 0` → skip. `minHeight = Number(props.render_min_height ?? 0) || 0`.
  - `roofShape = String(props['roof:shape'] ?? 'flat')` (OMT usually lacks it → 'flat').
  - Push `{ footprint, height, minHeight, roofShape }`. Skip rings with < 3 points.
- Call `extractBuildings()` in `update()` and include in the returned `SceneryData`. Update the
  initial `_data` literal to include `buildings: []`.

**Test:** extend/add a scenery test with a mocked `queryRenderedFeatures` returning one building
Polygon feature with `render_height: 12`; assert one spec with height 12 and a ≥3-point footprint.

**Verify:** `npm run test`, `npm run build`. **Commit:** `feat(planetary): extract building footprints from OMT building layer`.

---

## Task 6: PlanetaryEngine integration (modify)

**File:** `src/planetary/PlanetaryEngine.ts`

1. Imports: `AtmosphereConfig`, `BuildingGeometry`, `BuildingSpec`, `PostProcessing`, `PostQuality`, `PLANETARY_CONFIG`.
2. Fields: `private atmosphere = new AtmosphereConfig()`, `private hemi: THREE.HemisphereLight`
   (promote the existing hemisphere light to a field so atmosphere can drive it),
   `private wallMat`, `private roofMat` (MeshStandardMaterial; wall uses facade map, roughness 0.85,
   metalness 0.05; roof uses `PLANETARY_CONFIG.building.roofColor`, roughness 0.6, metalness 0.1),
   `private postProcess: PostProcessing | null = null`, `private postPreset: PostQuality`.
3. **`setBuildings(specs: BuildingSpec[])`** (signature change from `BoxCollider[]`):
   - dispose old group. For each spec: `try { geo = BuildingGeometry.generate(spec) } catch { continue }`.
   - `const mesh = new THREE.Mesh(geo, [this.wallMat, this.roofMat])`. `castShadow = receiveShadow = true`.
   - **Do not set `mesh.position`** — footprints are absolute local XZ. Add to `this.buildings`.
   - UV facade tiling is already encoded by BuildingGeometry (u,v in /4 units); just ensure
     `wallMat.map` wrapS/wrapT = RepeatWrapping (already set in ctor).
4. **`setSunAngle(state)`:** after existing sun light updates, compute
   `const elev = Math.asin(THREE.MathUtils.clamp(state.direction.y, -1, 1))`,
   `const atmo = this.atmosphere.update(elev)`. Drive: `fog.color.copy(atmo.fogColor)`;
   `this.hemi.color.copy(atmo.hemiSky); this.hemi.groundColor.copy(atmo.hemiGround); this.hemi.intensity = atmo.hemiIntensity`;
   sky uniforms turbidity/rayleigh/mieCoefficient/mieDirectionalG from atmo. (Keep `sun.position`,
   `sun.color`, `sun.intensity` from the SunState as today — do not double-drive sun color.)
5. **`setRoads(roads)`:** after building each road quad mesh, add a thin **center-line** mesh:
   a 0.12 m-wide white quad strip running along the road centerline (interpolate between the
   two pairs of corners), raised `+0.02` Y above the road, using a shared
   `MeshBasicMaterial({ color: 0xffffff })` stored as a field (`this.laneMat`). Dispose it in `dispose()`.
   Keep it simple — one continuous quad per strip is fine.
6. **`render()`:** after the renderer is created, if `!this.postProcess` create
   `this.postProcess = new PostProcessing(this.renderer, this.scene, this.camera)` and set
   `this.renderer.toneMapping = THREE.NoToneMapping` when `this.postProcess.active`. On resize,
   also call `this.postProcess?.setSize(w, h)`. Replace the final `this.renderer.render(...)` with:
   `if (this.postProcess?.active) this.postProcess.render(1/60); else this.renderer.render(this.scene, this.camera)`.
7. **New methods:** `setPostProcessingPreset(preset: PostQuality)` → `this.postPreset = preset; this.postProcess?.setQuality(preset)`.
8. **`dispose()`:** `this.postProcess?.dispose()`.

**Verify:** `npm run build`. (Engine tests are updated in Task 7.)
**Commit:** `feat(planetary): integrate AtmosphereConfig, BuildingGeometry, PostProcessing; road lane markings`.

---

## Task 7: PlanetaryMode wiring + test fixes + full verification (modify)

**Files:** `src/planetary/PlanetaryMode.tsx`, `src/planetary/__tests__/PlanetaryEngine.test.ts`, and any scenery test.

1. **PlanetaryMode.tsx:** the scenery `update()` now yields `data.buildings`; call
   `engine.setBuildings(data.buildings)` instead of `engine.setBuildings(collisionWorld.boxes)`.
   **Collision is unchanged** — the collision world still builds from boxes; only the *render*
   buildings switch to footprints. Wire `setBuildings` wherever scenery rebuilds (same place roads
   are set), not from the collision boxes.
2. **PlanetaryEngine.test.ts:** `setBuildings` now takes `BuildingSpec[]` — update any call sites
   and assertions. Ensure the maplibre mock and any new imports don't break construction. If a test
   asserted box-based building meshes, update it to footprint specs.
3. Run the full gate and fix anything red:
   - `npm run build`
   - `npm run lint`
   - `npm run test`

**Commit:** `feat(planetary): wire footprint buildings into PlanetaryMode; update tests`.

---

## Notes for reviewers

- The two highest-risk bug classes from v1: (a) building **position double-offset** — guarded by
  the "absolute local XZ, no mesh.position" rule + material groups instead of buffer-slicing;
  (b) **postprocessing v6 API misuse** — guarded by the exact-API block in Task 4.
- OMT lacks `roof:shape`, so roofs render flat in practice; the gable/hipped/pyramidal paths are
  exercised only by unit tests. That is expected, not a gap.
