# Planetary Mode: Sidewalks, Water, Building Variety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three visual-fidelity features to Planetary Mode: sidewalk/path styling distinct from roads, rendered water polygons, and wall-color variety between small houses and other buildings.

**Architecture:** Extend the existing OMT-tile extract/render pipeline (`PlanetaryScenery.ts` queries MapLibre `queryRenderedFeatures` → typed data → `PlanetaryEngine.ts` builds Three.js meshes). Each feature adds one classification field or one new extractor on the scenery side, and one new material or render method on the engine side. No new abstractions, no collision changes, no new config system.

**Tech Stack:** TypeScript, Three.js, MapLibre GL (OpenMapTiles "liberty" style via OpenFreeMap), Vitest.

## Global Constraints

- Culling distance: 600m (`PLANETARY_CONFIG.fogFar` in `src/planetary/PlanetaryConfig.ts`) — matches `scene.fog.far`. Any new per-object cull must use this same value via `this.cullFar()` / `this.isBeyond()` in `PlanetaryEngine.ts`.
- Scenery rescan gate: 50m (`RESCAN_METERS` in `PlanetaryScenery.ts`) — new extractors run inside the existing `update()` method, so they inherit this gate automatically; do not add a separate gate.
- New optional fields on shared interfaces (`RoadStrip.kind`, `BuildingSpec.buildingType`) must be optional with a safe default, so existing object literals in tests and call sites keep compiling without changes.
- No new npm dependencies. No new texture assets — new materials are flat colors, matching the project's existing inline-material style (see `greenMat`, `laneMat` in `PlanetaryEngine.ts`).
- Test command: `npx vitest run <file>` for a single file, `npm test` for the full suite. Before considering any task done, also run `npm run build` at least once per task batch — `tsc --noEmit` alone misses type errors in test files on this project (see `docs/superpowers/specs` history), `npm run build` catches them.

---

### Task 1: Classify road strips as `road` or `path`

**Files:**
- Modify: `src/planetary/PlanetaryScenery.ts` (`RoadStrip` interface ~line 26-30, `extractRoads()` ~line 97-133)
- Test: `src/planetary/__tests__/PlanetaryScenery.test.ts`

**Interfaces:**
- Produces: `RoadStrip.kind?: 'road' | 'path'` (undefined treated as `'road'` by consumers). Consumed by `PlanetaryEngine.setRoads()` in Task 2.

- [ ] **Step 1: Write the failing tests**

Add to `src/planetary/__tests__/PlanetaryScenery.test.ts`, inside the existing `describe('PlanetaryScenery — roads', ...)` block or as a new block right after it:

```ts
describe('PlanetaryScenery — road kind', () => {
  it('classifies footway class as kind "path"', () => {
    const footway = {
      sourceLayer: 'transportation',
      geometry: { type: 'LineString', coordinates: [[0, 0], [0.001, 0]] },
      properties: { class: 'footway' },
    }
    const map = makeMap([footway])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads[0].kind).toBe('path')
  })

  it('classifies residential class as kind "road"', () => {
    const map = makeMap([roadFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads[0].kind).toBe('road')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: the two new tests FAIL with `expected undefined to be 'path'` / `'road'` (the `kind` field doesn't exist yet).

- [ ] **Step 3: Implement classification**

In `src/planetary/PlanetaryScenery.ts`, add a constant near the other class sets (after `GREEN_SOURCE_LAYERS` / near `ROAD_HALF_WIDTHS`):

```ts
const PATH_CLASSES = new Set(['pedestrian', 'path', 'footway', 'cycleway', 'steps', 'bridleway'])
```

Update the `RoadStrip` interface:

```ts
export interface RoadStrip {
  // quad corners in local XZ (Y=0.05 to sit above ground)
  corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
  uvLength: number  // segment length in meters, for UV tiling
  kind?: 'road' | 'path'  // 'path' = pedestrian/footway/cycleway/etc.; undefined treated as 'road'
}
```

In `extractRoads()`, right after `const halfWidth = ROAD_HALF_WIDTHS[cls] ?? DEFAULT_HALF_WIDTH`, add:

```ts
const kind: 'road' | 'path' = PATH_CLASSES.has(cls) ? 'path' : 'road'
```

And add `kind,` to the object pushed into `strips`:

```ts
strips.push({
  corners: [
    new THREE.Vector3(ax + nx, 0.05, az + nz),
    new THREE.Vector3(ax - nx, 0.05, az - nz),
    new THREE.Vector3(bx - nx, 0.05, bz - nz),
    new THREE.Vector3(bx + nx, 0.05, bz + nz),
  ],
  uvLength: len,
  kind,
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: all tests PASS, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryScenery.ts src/planetary/__tests__/PlanetaryScenery.test.ts
git commit -m "feat(planetary): classify road strips as road or path"
```

---

### Task 2: Render path strips with a distinct material and no centerline

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts` (material fields ~line 44-49, constructor ~line 112-116, `setRoads()` ~line 227-292)
- Test: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Interfaces:**
- Consumes: `RoadStrip.kind` from Task 1.
- Produces: no new public API; `setRoads()` behavior changes for `kind: 'path'` strips.

- [ ] **Step 1: Write the failing test**

Add to `src/planetary/__tests__/PlanetaryEngine.test.ts`, after the existing `makeFarRoadStrip()` function:

```ts
function makePathStrip(): RoadStrip {
  return {
    corners: [
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(0, 0.05, 2),
      new THREE.Vector3(10, 0.05, 2),
      new THREE.Vector3(10, 0.05, 0),
    ],
    uvLength: 10,
    kind: 'path',
  }
}
```

Add inside `describe('PlanetaryEngine — setRoads / setTrees / setGreenAreas', ...)`:

```ts
it('setRoads skips the centerline mesh for path strips', () => {
  const container = document.createElement('div')
  const engine = new PlanetaryEngine(container)
  ;(engine.map as any)._triggerLoad()
  let before = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) before++ })
  engine.setRoads([makePathStrip()])
  let after = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) after++ })
  // path strip adds only the surface mesh, no centerline
  expect(after - before).toBe(1)
  engine.dispose()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: FAIL — currently every strip (road or path) gets a surface mesh AND a centerline mesh, so `after - before` is `2`, not `1`.

- [ ] **Step 3: Implement path material and centerline skip**

In `src/planetary/PlanetaryEngine.ts`, add a field next to `private roadMat: THREE.MeshStandardMaterial`:

```ts
private pathMat: THREE.MeshStandardMaterial
```

In the constructor, right after the existing road material setup block (`this.roadMat = new THREE.MeshStandardMaterial({ map: roadTex ?? undefined, roughness: 1, metalness: 0 })`), add:

```ts
this.pathMat = new THREE.MeshStandardMaterial({ color: 0xb0aca4, roughness: 1, metalness: 0 })
```

In `setRoads()`, change:

```ts
const mesh = new THREE.Mesh(geo, this.roadMat)
```

to:

```ts
const mesh = new THREE.Mesh(geo, strip.kind === 'path' ? this.pathMat : this.roadMat)
```

Then wrap the entire centerline-marking block (from `const yOffset = 0.02` down through `this.roads.add(laneMesh)`) in:

```ts
if (strip.kind !== 'path') {
  // ...existing centerline block unchanged...
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: all tests PASS, including the new one. The pre-existing `'culls roads beyond the fog-far distance'` test still passes because `makeRoadStrip()`/`makeFarRoadStrip()` have `kind` undefined, which is treated as `'road'` (centerline still added).

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "feat(planetary): render sidewalks/paths distinct from roads, no centerline"
```

---

### Task 3: Extract water polygons

**Files:**
- Modify: `src/planetary/PlanetaryScenery.ts` (source-layer constants ~line 13-16, `SceneryData` interface ~line 32-37, constructor `_data` initializer ~line 43, `update()` ~line 79-95, new `extractWaterAreas()` method near `extractGreenAreas()` ~line 149-174)
- Test: `src/planetary/__tests__/PlanetaryScenery.test.ts`

**Interfaces:**
- Produces: `SceneryData.waterTriangles: Float32Array` (flat `[x, z, x, z, ...]`, same shape as `greenTriangles`). Consumed by `PlanetaryEngine.setWaterAreas()` in Task 4.

- [ ] **Step 1: Write the failing tests**

Add near the top of `src/planetary/__tests__/PlanetaryScenery.test.ts`, after `grassFeature`:

```ts
const waterFeature = {
  sourceLayer: 'water',
  geometry: {
    type: 'Polygon',
    coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]],
  },
  properties: { class: 'lake' },
}
```

Add a new describe block (e.g. after `describe('PlanetaryScenery — green areas', ...)`):

```ts
describe('PlanetaryScenery — water areas', () => {
  it('triangulates a water polygon', () => {
    const map = makeMap([waterFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { waterTriangles } = sc.update(0, 0)
    expect(waterTriangles.length).toBeGreaterThan(0)
    expect(waterTriangles.length % 6).toBe(0)
  })

  it('initial data has empty waterTriangles', () => {
    const map = makeMap([])
    const sc = new PlanetaryScenery(map as any, identity)
    expect(sc.data.waterTriangles).toEqual(new Float32Array(0))
  })
})
```

Also update these two pre-existing assertions in the same file, which count `queryRenderedFeatures` calls per `update()` — adding a 5th extractor changes the count from 4 to 5 per rebuild:

In `'skips re-scan within 50 m'`:
```ts
expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(4)
```
becomes:
```ts
expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(5)
```

In `'markStale forces re-scan within 50 m'`:
```ts
expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(8)
```
becomes:
```ts
expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(10)
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: the two new water tests FAIL (`waterTriangles` doesn't exist on the returned/data object — TypeScript will also flag this once you try to destructure it, but Vitest's transpiler runs anyway, so the failure shows as `waterTriangles` being `undefined`, e.g. `Cannot read properties of undefined`). The two count assertions you just edited will also currently FAIL (still returning 4/8) until Step 3 is done.

- [ ] **Step 3: Implement water extraction**

In `src/planetary/PlanetaryScenery.ts`, add near the other source-layer constants:

```ts
const WATER_SOURCE_LAYER = 'water'
```

Update `SceneryData`:

```ts
export interface SceneryData {
  roads: RoadStrip[]
  treePositions: THREE.Vector3[]
  greenTriangles: Float32Array  // flat [x,z, x,z, ...] for triangulated green areas
  waterTriangles: Float32Array  // flat [x,z, x,z, ...] for triangulated water areas
  buildings: BuildingSpec[]
}
```

Update the `_data` field initializer in the class body:

```ts
private _data: SceneryData = {
  roads: [], treePositions: [], greenTriangles: new Float32Array(0),
  waterTriangles: new Float32Array(0), buildings: [],
}
```

In `update()`, add `waterTriangles` to the rebuilt object:

```ts
this._data = {
  roads: this.extractRoads(),
  treePositions: this.extractTrees(),
  greenTriangles: this.extractGreenAreas(),
  waterTriangles: this.extractWaterAreas(),
  buildings: this.extractBuildings(),
}
```

Add a new method, right after `extractGreenAreas()`:

```ts
private extractWaterAreas(): Float32Array {
  const verts: number[] = []
  const features = this.queryBySourceLayer(WATER_SOURCE_LAYER)
  for (const f of features) {
    const rings: [number, number][][] =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates[0] as [number, number][]]
        : f.geometry.type === 'MultiPolygon'
        ? (f.geometry.coordinates as [number, number][][][]).map(p => p[0])
        : []
    for (const ring of rings) {
      const local = ring.map(([lng, lat]) => this.toLocal(lng, lat))
      const pts = local.map(([x, z]) => new THREE.Vector2(x, z))
      const tris = THREE.ShapeUtils.triangulateShape(pts, [])
      for (const [i, j, k] of tris) {
        verts.push(local[i][0], local[i][1])
        verts.push(local[j][0], local[j][1])
        verts.push(local[k][0], local[k][1])
      }
    }
  }
  return new Float32Array(verts)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryScenery.ts src/planetary/__tests__/PlanetaryScenery.test.ts
git commit -m "feat(planetary): extract water polygons from OMT water layer"
```

---

### Task 4: Render water areas and wire into the game loop

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts` (material/group fields ~line 39-49, constructor ~line 121, new `setWaterAreas()` method near `setGreenAreas()` ~line 318-344)
- Modify: `src/planetary/PlanetaryMode.tsx` (~lines 348-360)
- Test: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Interfaces:**
- Consumes: `SceneryData.waterTriangles` from Task 3.
- Produces: `PlanetaryEngine.setWaterAreas(triangles: Float32Array): void` — consumed by `PlanetaryMode.tsx`.

- [ ] **Step 1: Write the failing test**

Add inside `describe('PlanetaryEngine — setRoads / setTrees / setGreenAreas', ...)` in `src/planetary/__tests__/PlanetaryEngine.test.ts`, after the `'setGreenAreas adds a mesh to scene'` test:

```ts
it('setWaterAreas adds a mesh to scene', () => {
  const container = document.createElement('div')
  const engine = new PlanetaryEngine(container)
  ;(engine.map as any)._triggerLoad()
  const tris = new Float32Array([0,0, 10,0, 10,10, 0,0, 10,10, 0,10])
  let before = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) before++ })
  engine.setWaterAreas(tris)
  let after = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) after++ })
  expect(after).toBeGreaterThan(before)
  engine.dispose()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: FAIL — `engine.setWaterAreas is not a function`.

- [ ] **Step 3: Implement water rendering**

In `src/planetary/PlanetaryEngine.ts`, add a field next to `private greenAreas: THREE.Mesh | null = null`:

```ts
private waterAreas: THREE.Mesh | null = null
```

Add a field next to `private greenMat: THREE.MeshStandardMaterial`:

```ts
private waterMat: THREE.MeshStandardMaterial
```

In the constructor, right after `this.greenMat = new THREE.MeshStandardMaterial({ color: 0x4a6b38, roughness: 1, metalness: 0 })`, add:

```ts
this.waterMat = new THREE.MeshStandardMaterial({ color: 0x2f6690, roughness: 0.15, metalness: 0.1 })
```

Add a new method right after `setGreenAreas()`:

```ts
setWaterAreas(triangles: Float32Array): void {
  if (this.waterAreas) {
    this.waterAreas.geometry.dispose()
    this.scene.remove(this.waterAreas)
    this.waterAreas = null
  }
  if (triangles.length === 0) return
  const vertCount = triangles.length / 2
  const pos = new Float32Array(vertCount * 3)
  for (let i = 0; i < vertCount; i++) {
    pos[i * 3] = triangles[i * 2]
    pos[i * 3 + 1] = 0.015
    pos[i * 3 + 2] = triangles[i * 2 + 1]
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  this.waterAreas = new THREE.Mesh(geo, this.waterMat)
  this.scene.add(this.waterAreas)
}
```

(Water sits at y=0.015, just above the grass mesh's y=0.01, to avoid z-fighting where a pond meets a park edge. No UV/texture needed — flat color only.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Wire into the game loop**

In `src/planetary/PlanetaryMode.tsx`, at lines 348-360, change:

```ts
        // 6b. Rebuild scenery (roads, trees, green areas) when stale
        if (sceneryRef.current) {
          sceneryRef.current.update(center.lng, center.lat)
          const sv = sceneryRef.current.rebuildVersion
          if (sv !== lastSceneryVersionRef.current) {
            lastSceneryVersionRef.current = sv
            const { roads, treePositions, greenTriangles, buildings } = sceneryRef.current.data
            engine.setRoads(roads)
            engine.setTrees(treePositions)
            engine.setGreenAreas(greenTriangles)
            engine.setBuildings(buildings)
          }
        }
```

to:

```ts
        // 6b. Rebuild scenery (roads, trees, green/water areas) when stale
        if (sceneryRef.current) {
          sceneryRef.current.update(center.lng, center.lat)
          const sv = sceneryRef.current.rebuildVersion
          if (sv !== lastSceneryVersionRef.current) {
            lastSceneryVersionRef.current = sv
            const { roads, treePositions, greenTriangles, waterTriangles, buildings } = sceneryRef.current.data
            engine.setRoads(roads)
            engine.setTrees(treePositions)
            engine.setGreenAreas(greenTriangles)
            engine.setWaterAreas(waterTriangles)
            engine.setBuildings(buildings)
          }
        }
```

There is no dedicated test file for `PlanetaryMode.tsx` (it's an integration/wiring layer covered by manual verification), so this step's check is the build step below rather than a unit test.

- [ ] **Step 6: Verify the project still builds**

Run: `npm run build`
Expected: succeeds with no TypeScript errors (confirms the destructured `waterTriangles` matches the `SceneryData` type and `engine.setWaterAreas` signature matches the call site).

- [ ] **Step 7: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/PlanetaryMode.tsx src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "feat(planetary): render water areas and wire into game loop"
```

---

### Task 5: Classify buildings as `house` or `other`

**Files:**
- Modify: `src/planetary/BuildingGeometry.ts` (`BuildingSpec` interface ~line 4-10)
- Modify: `src/planetary/PlanetaryScenery.ts` (`extractBuildings()` ~line 176-205)
- Test: `src/planetary/__tests__/PlanetaryScenery.test.ts`

**Interfaces:**
- Produces: `BuildingSpec.buildingType?: 'house' | 'other'` (undefined treated as `'other'`). Consumed by `PlanetaryEngine.setBuildings()` in Task 6.

- [ ] **Step 1: Write the failing tests**

Add inside `describe('PlanetaryScenery — buildings', ...)` in `src/planetary/__tests__/PlanetaryScenery.test.ts` (near the other building tests, this file already defines `buildingPolygon` with no `building` tag and `makeLayeredMap` as an alias for `makeMap`):

```ts
it('tags building=house as buildingType "house"', () => {
  const houseFeature = {
    sourceLayer: 'building',
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]]] },
    properties: { render_height: 6, building: 'house' },
  }
  const map = makeLayeredMap([houseFeature])
  const sc = new PlanetaryScenery(map as any, identity)
  const { buildings } = sc.update(0, 0)
  expect(buildings[0].buildingType).toBe('house')
})

it('tags building=apartments as buildingType "other"', () => {
  const apartmentsFeature = {
    sourceLayer: 'building',
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]]] },
    properties: { render_height: 30, building: 'apartments' },
  }
  const map = makeLayeredMap([apartmentsFeature])
  const sc = new PlanetaryScenery(map as any, identity)
  const { buildings } = sc.update(0, 0)
  expect(buildings[0].buildingType).toBe('other')
})

it('defaults to buildingType "other" when building tag is absent', () => {
  const map = makeLayeredMap([buildingPolygon])
  const sc = new PlanetaryScenery(map as any, identity)
  const { buildings } = sc.update(0, 0)
  expect(buildings[0].buildingType).toBe('other')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: FAIL — `buildings[0].buildingType` is `undefined` for all three.

- [ ] **Step 3: Implement classification**

In `src/planetary/BuildingGeometry.ts`, add one field to `BuildingSpec`:

```ts
export interface BuildingSpec {
  footprint: [number, number][]   // ring of absolute local [x, z] meters; may be open or closed
  height: number                   // absolute top Y (meters)
  minHeight?: number               // ground Y (default 0)
  roofShape?: string               // 'flat' | 'gabled' | 'hipped' | 'pyramidal' | other→flat
  roofHeight?: number              // peak rise above height's eave; capped to 50% of wall height
  buildingType?: 'house' | 'other' // wall-material hint only; does not affect geometry generation
}
```

In `src/planetary/PlanetaryScenery.ts`, add a constant near `PATH_CLASSES`:

```ts
const HOUSE_BUILDING_TAGS = new Set(['house', 'detached', 'semidetached_house', 'bungalow', 'cabin', 'farm'])
```

In `extractBuildings()`, right after `const roofShape = String(props['roof:shape'] ?? 'flat')`, add:

```ts
const buildingType: 'house' | 'other' = HOUSE_BUILDING_TAGS.has(String(props.building ?? '')) ? 'house' : 'other'
```

And add `buildingType` to the pushed spec:

```ts
specs.push({ footprint, height, minHeight, roofShape, buildingType })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planetary/BuildingGeometry.ts src/planetary/PlanetaryScenery.ts src/planetary/__tests__/PlanetaryScenery.test.ts
git commit -m "feat(planetary): classify buildings as house or other by OSM building tag"
```

---

### Task 6: Render houses with a distinct wall material

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts` (material field ~line 44, constructor ~line 104, `setBuildings()` ~line 207-225)
- Test: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Interfaces:**
- Consumes: `BuildingSpec.buildingType` from Task 5.
- Produces: no new public API; `setBuildings()` mesh material array changes per building.

- [ ] **Step 1: Write the failing test**

Add inside `describe('PlanetaryEngine', ...)` in `src/planetary/__tests__/PlanetaryEngine.test.ts`, after the `'culls buildings beyond the fog-far distance'` test:

```ts
it('uses a distinct wall material for buildingType "house" vs "other"', () => {
  const container = document.createElement('div')
  const engine = new PlanetaryEngine(container)

  const specs: BuildingSpec[] = [
    { footprint: [[0,0],[8,0],[8,8],[0,8]], height: 6, roofShape: 'flat', buildingType: 'house' },
    { footprint: [[20,0],[28,0],[28,8],[20,8]], height: 12, roofShape: 'flat', buildingType: 'other' },
  ]
  engine.setBuildings(specs)

  const buildingMeshes: THREE.Mesh[] = []
  engine.scene.traverse(o => {
    if (o instanceof THREE.Mesh && Array.isArray(o.material) && o.material.length === 2) buildingMeshes.push(o)
  })
  expect(buildingMeshes).toHaveLength(2)

  const houseWall = (buildingMeshes[0].material as THREE.Material[])[0] as THREE.MeshStandardMaterial
  const otherWall = (buildingMeshes[1].material as THREE.Material[])[0] as THREE.MeshStandardMaterial
  expect(houseWall.color.getHex()).toBe(0xe8dcc0)
  expect(otherWall.color.getHex()).not.toBe(0xe8dcc0)

  engine.dispose()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: FAIL — both meshes currently share `this.wallMat`, so `houseWall.color.getHex()` is `0xffffff` (default), not `0xe8dcc0`.

- [ ] **Step 3: Implement house wall material**

In `src/planetary/PlanetaryEngine.ts`, add a field next to `private wallMat: THREE.MeshStandardMaterial`:

```ts
private houseWallMat: THREE.MeshStandardMaterial
```

In the constructor, right after the existing `this.wallMat = new THREE.MeshStandardMaterial({...})` block, add:

```ts
this.houseWallMat = new THREE.MeshStandardMaterial({
  color: 0xe8dcc0,
  roughness: 0.9,
  metalness: 0,
  side: THREE.DoubleSide,
})
```

In `setBuildings()`, change:

```ts
const mesh = new THREE.Mesh(geo, [this.wallMat, this.roofMat])
```

to:

```ts
const wallMaterial = spec.buildingType === 'house' ? this.houseWallMat : this.wallMat
const mesh = new THREE.Mesh(geo, [wallMaterial, this.roofMat])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: all tests PASS, including the new one. The pre-existing `'builds building meshes from footprint specs'` test still passes because its specs have no `buildingType` (undefined → falls into `this.wallMat`, unchanged behavior).

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "feat(planetary): render house buildings with a distinct wall tint"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including all tests modified/added in Tasks 1-6.

- [ ] **Step 2: Run the full build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no new lint errors introduced by this work (pre-existing warnings in unrelated files are not this plan's concern).

- [ ] **Step 4: Manual verification in-browser**

Start the dev server (`npm run dev`), enter Planetary Mode, and navigate to an area with mapped footways/parks and a water body (e.g. a city with a river or lake). Confirm:
- Footway/path/cycleway strips render as flat light-gray with no white centerline, visually distinct from asphalt roads.
- Water polygons render as a flat blue surface.
- Buildings tagged `building=house`/`detached`/etc. show a cream wall tint distinct from the textured apartment-block facade.

Note in the final report if any of these can't be verified because the current dev spawn location has no mapped footways/water/houses nearby — that's a map-data availability issue, not a code defect.
