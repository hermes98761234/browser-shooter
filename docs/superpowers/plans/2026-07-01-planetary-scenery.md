# Planetary Scenery (Sidewalks, Labels, Street Objects, Road Tuning) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring planetary mode closer to the streets-gl reference look: sidewalks flanking roads, floating place-name labels, street lamps/benches, and road-width tuning — using only data already in the loaded OpenMapTiles vector tiles.

**Architecture:** Extend the existing `PlanetaryScenery` (data extraction from MapLibre `queryRenderedFeatures`) → `PlanetaryEngine.setX(...)` (mesh building) → `PlanetaryMode.tsx` game-loop wiring (rebuild on `rebuildVersion` change) pipeline. No new files, no new dependencies.

**Tech Stack:** TypeScript, Three.js, MapLibre GL (mocked in tests), vitest (jsdom environment).

**Spec:** `docs/superpowers/specs/2026-07-01-planetary-scenery-design.md`

## Global Constraints

- No new npm dependencies.
- Caps (from spec): 40 labels, 200 lamps, 80 benches. Label draw distance 300 m.
- Street objects and labels: `castShadow` stays false; both hidden at perf level 2 (`setPerfLevel`).
- All new meshes respect the fog-far cull (`isBeyond()` against `cullFar()`).
- Git Push Policy (project CLAUDE.md): push after every commit. CI is watched in the final task; if it fails, fix and push before reporting done.
- Test command: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts src/planetary/__tests__/PlanetaryEngine.test.ts` (or the single file under work). Final gate: `npm run build` (catches test-file type errors `tsc --noEmit` misses).
- In tests, `identity(lng, lat)` maps to local `[lng * 111320, -lat * 111320]` — a `[[0,0],[0.001,0]]` LineString is a ~111 m line along +X at z = 0, and its left-hand normal is +Z.
- jsdom has no 2D canvas: `canvas.getContext('2d')` returns `null`. Label sprite creation must guard on this and tests must not assert sprite counts.

---

### Task 1: Road width tuning + ferry skip

**Files:**
- Modify: `src/planetary/PlanetaryScenery.ts:20-29` (constants) and `:151-165` (`extractRoads`)
- Test: `src/planetary/__tests__/PlanetaryScenery.test.ts`

**Interfaces:**
- Consumes: existing `stripsFromFeature`, `ROAD_HALF_WIDTHS`, `PATH_CLASSES`.
- Produces: no API change. `class=minor` renders 8 m wide; `track` is a 3 m-wide `kind: 'path'`; `pedestrian` 3 m; `steps` 2 m; `ferry`/`aerialway`/`cable_car` features produce no strips.

- [ ] **Step 1: Write the failing tests**

Append to `src/planetary/__tests__/PlanetaryScenery.test.ts` (uses the file's existing `makeMap` and `identity` helpers):

```ts
describe('PlanetaryScenery — road coverage tuning', () => {
  const line = { type: 'LineString', coordinates: [[0, 0], [0.001, 0]] }
  const feat = (cls: string) => ({
    sourceLayer: 'transportation',
    geometry: line,
    properties: { class: cls },
  })

  it('renders class=minor at 8 m width, kind road', () => {
    const sc = new PlanetaryScenery(makeMap([feat('minor')]) as any, identity)
    const { roads } = sc.update(0, 0)
    const road = roads.find(r => r.kind === 'road')!
    expect(road).toBeDefined()
    expect(road.corners[0].distanceTo(road.corners[1])).toBeCloseTo(8, 0)
  })

  it('classifies class=track as a 3 m-wide path', () => {
    const sc = new PlanetaryScenery(makeMap([feat('track')]) as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads[0].kind).toBe('path')
    expect(roads[0].corners[0].distanceTo(roads[0].corners[1])).toBeCloseTo(3, 0)
  })

  it('skips ferry lines (no phantom roads across water)', () => {
    const sc = new PlanetaryScenery(makeMap([feat('ferry')]) as any, identity)
    expect(sc.update(0, 0).roads).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: the 3 new tests FAIL (minor width 6, track kind 'road', ferry produces a strip). All pre-existing tests PASS.

- [ ] **Step 3: Implement**

In `src/planetary/PlanetaryScenery.ts`, extend the constants (lines 20-29):

```ts
const ROAD_HALF_WIDTHS: Record<string, number> = {
  motorway: 8, trunk: 8,
  primary: 6, secondary: 6,
  tertiary: 4, residential: 4, service: 4, minor: 4,
  path: 2, footway: 2, cycleway: 2,
  track: 1.5, pedestrian: 1.5, steps: 1,
}
const DEFAULT_HALF_WIDTH = 3

const PATH_CLASSES = new Set(['pedestrian', 'path', 'footway', 'cycleway', 'steps', 'bridleway', 'track'])
const RAIL_CLASSES = new Set(['rail', 'transit', 'tram', 'subway', 'light_rail', 'narrow_gauge', 'funicular', 'monorail'])
// Water/air transport lines must not paint roads on the ground.
const SKIP_ROAD_CLASSES = new Set(['ferry', 'aerialway', 'cable_car'])
```

In `extractRoads()` (line ~154), add the skip right after the tunnel check:

```ts
      if (f.properties?.brunnel === 'tunnel') continue
      const cls = (f.properties?.subclass ?? f.properties?.class ?? 'residential') as string
      if (SKIP_ROAD_CLASSES.has(cls)) continue
```

(The `cls` line already exists — only the `SKIP_ROAD_CLASSES` check is new, placed after it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/planetary/PlanetaryScenery.ts src/planetary/__tests__/PlanetaryScenery.test.ts
git commit -m "feat(planetary): tune road widths for minor/track/pedestrian/steps, skip ferry lines"
git push
```

---

### Task 2: Sidewalks flanking car roads

**Files:**
- Modify: `src/planetary/PlanetaryScenery.ts:118-165` (`stripsFromFeature`, `extractRoads`)
- Test: `src/planetary/__tests__/PlanetaryScenery.test.ts`

**Interfaces:**
- Consumes: `stripsFromFeature(f, halfWidth, kind, y, strips)` from the existing file.
- Produces: `stripsFromFeature` gains a trailing optional param `lateralOffset = 0` (strip centerline shifted along the segment normal). Every `kind: 'road'` feature now yields 3 strips per segment: 1 road + 2 sidewalks (`kind: 'path'`, y = 0.04, 1.5 m wide, centerline at ±(roadHalfWidth + 1)). Existing `RoadStrip` type unchanged — later tasks and the engine need no changes for sidewalks to render (pathMat already exists).

- [ ] **Step 1: Write the failing tests**

Append to `PlanetaryScenery.test.ts`:

```ts
describe('PlanetaryScenery — sidewalks', () => {
  it('emits two path strips flanking each car road segment', () => {
    const sc = new PlanetaryScenery(makeMap([roadFeature]) as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads.filter(r => r.kind === 'road')).toHaveLength(1)
    expect(roads.filter(r => r.kind === 'path')).toHaveLength(2)
  })

  it('sidewalks are 1.5 m wide at y=0.04, centered 5 m either side of a residential centerline', () => {
    const sc = new PlanetaryScenery(makeMap([roadFeature]) as any, identity)
    const sidewalks = sc.update(0, 0).roads.filter(r => r.kind === 'path')
    for (const s of sidewalks) {
      expect(s.corners[0].y).toBeCloseTo(0.04)
      expect(s.corners[0].distanceTo(s.corners[1])).toBeCloseTo(1.5, 1)
    }
    // roadFeature runs along +X at z=0; residential halfWidth 4 → centers at z = ±5
    const centerZ = (s: (typeof sidewalks)[0]) => (s.corners[0].z + s.corners[1].z) / 2
    const zs = sidewalks.map(centerZ).sort((a, b) => a - b)
    expect(zs[0]).toBeCloseTo(-5, 1)
    expect(zs[1]).toBeCloseTo(5, 1)
  })

  it('does not add sidewalks to footways or rails', () => {
    const footway = { id: 'f1', sourceLayer: 'transportation', geometry: { type: 'LineString', coordinates: [[0, 0], [0.001, 0]] }, properties: { class: 'footway' } }
    const rail = { id: 'r1', sourceLayer: 'transportation', geometry: { type: 'LineString', coordinates: [[0, 0.001], [0.001, 0.001]] }, properties: { class: 'rail' } }
    const sc = new PlanetaryScenery(makeMap([footway, rail]) as any, identity)
    expect(sc.update(0, 0).roads).toHaveLength(2)
  })
})
```

Also update the existing dedupe test (`'dedupes a feature rendered by multiple style layers...'`, currently `expect(roads).toHaveLength(1)`), since a car road now yields 3 strips:

```ts
    expect(roads.filter(r => r.kind === 'road')).toHaveLength(1)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: the 3 new tests FAIL (no sidewalk strips yet). The updated dedupe test PASSES either way (filter is backward-compatible).

- [ ] **Step 3: Implement**

Replace `stripsFromFeature` (lines 118-149) with an offset-aware version — with `lateralOffset = 0` the corner math is identical to the current code:

```ts
  /** Expand a feature's line(s) into quad strips of the given half-width,
   *  with the strip centerline shifted `lateralOffset` m along the segment normal. */
  private stripsFromFeature(f: MapGeoJSONFeature, halfWidth: number, kind: RoadStrip['kind'], y: number, strips: RoadStrip[], lateralOffset = 0): void {
    const lines: [number, number][][] =
      f.geometry.type === 'LineString'
        ? [f.geometry.coordinates as [number, number][]]
        : f.geometry.type === 'MultiLineString'
        ? (f.geometry.coordinates as [number, number][][])
        : []
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = this.toLocal(line[i][0], line[i][1])
        const [bx, bz] = this.toLocal(line[i + 1][0], line[i + 1][1])
        const dx = bx - ax
        const dz = bz - az
        const len = Math.sqrt(dx * dx + dz * dz)
        if (len < 0.1) continue
        // Unit normal in XZ plane (perpendicular to segment)
        const ux = -dz / len
        const uz = dx / len
        const outer = lateralOffset + halfWidth
        const inner = lateralOffset - halfWidth
        strips.push({
          corners: [
            new THREE.Vector3(ax + ux * outer, y, az + uz * outer),
            new THREE.Vector3(ax + ux * inner, y, az + uz * inner),
            new THREE.Vector3(bx + ux * inner, y, bz + uz * inner),
            new THREE.Vector3(bx + ux * outer, y, bz + uz * outer),
          ],
          uvLength: len,
          kind,
        })
      }
    }
  }
```

Add a constant near the other road constants:

```ts
const SIDEWALK_HALF_WIDTH = 0.75  // 1.5 m sidewalks, streets-gl look
```

In `extractRoads()`, after the existing `this.stripsFromFeature(f, halfWidth, kind, 0.05, strips)` call:

```ts
      this.stripsFromFeature(f, halfWidth, kind, 0.05, strips)
      // Sidewalks flank car roads only (not paths/rails). y=0.04 so roads win overlaps.
      if (kind === 'road') {
        const off = halfWidth + 1
        this.stripsFromFeature(f, SIDEWALK_HALF_WIDTH, 'path', 0.04, strips, off)
        this.stripsFromFeature(f, SIDEWALK_HALF_WIDTH, 'path', 0.04, strips, -off)
      }
```

`// ponytail: sidewalks triple the per-segment mesh count in setRoads; if draw calls ever dominate frame time, merge strips per material into one geometry there.`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: all PASS. Also run `npx vitest run src/planetary` — `PlanetarySpawns`/`PlanetaryNavmesh` tests may consume road strips; if any assert on strip counts, update them to filter by `kind`.

- [ ] **Step 5: Commit and push**

```bash
git add src/planetary/PlanetaryScenery.ts src/planetary/__tests__/PlanetaryScenery.test.ts
git commit -m "feat(planetary): concrete sidewalks flanking car roads"
git push
```

---

### Task 3: Place-name label extraction

**Files:**
- Modify: `src/planetary/PlanetaryScenery.ts` (new constants, `LabelSpec`, `SceneryData`, `update()`, new `extractLabels()`)
- Test: `src/planetary/__tests__/PlanetaryScenery.test.ts`

**Interfaces:**
- Consumes: `queryBySourceLayer(Set)` and `toLocal` from the existing class.
- Produces: `export interface LabelSpec { text: string; x: number; z: number }`; `SceneryData` gains `labels: LabelSpec[]` (the ≤40 named `poi`/`place` points nearest the player, nearest first). Task 4's engine method consumes `LabelSpec[]`.

- [ ] **Step 1: Write the failing tests**

Append to `PlanetaryScenery.test.ts`:

```ts
describe('PlanetaryScenery — labels', () => {
  const poi = (name: string | undefined, lng: number, id?: number) => ({
    id,
    sourceLayer: 'poi',
    geometry: { type: 'Point', coordinates: [lng, 0] },
    properties: name === undefined ? {} : { name },
  })

  it('extracts named POIs as labels with local coords', () => {
    const sc = new PlanetaryScenery(makeMap([poi('Cafe Mars', 0.0001)]) as any, identity)
    const { labels } = sc.update(0, 0)
    expect(labels).toHaveLength(1)
    expect(labels[0].text).toBe('Cafe Mars')
    expect(labels[0].x).toBeCloseTo(11.1, 0)
  })

  it('extracts named place features (e.g. suburb names)', () => {
    const place = { sourceLayer: 'place', geometry: { type: 'Point', coordinates: [0.0002, 0] }, properties: { name: 'Old Town' } }
    const sc = new PlanetaryScenery(makeMap([place]) as any, identity)
    expect(sc.update(0, 0).labels.map(l => l.text)).toEqual(['Old Town'])
  })

  it('ignores unnamed features', () => {
    const sc = new PlanetaryScenery(makeMap([poi(undefined, 0.0001)]) as any, identity)
    expect(sc.update(0, 0).labels).toHaveLength(0)
  })

  it('caps at the 40 labels nearest the player, nearest first', () => {
    const features = Array.from({ length: 60 }, (_, i) => poi(`p${i}`, 0.0001 * (i + 1), i))
    const sc = new PlanetaryScenery(makeMap(features) as any, identity)
    const { labels } = sc.update(0, 0)
    expect(labels).toHaveLength(40)
    expect(labels[0].text).toBe('p0')
  })
})
```

Also update the two query-count tests — `extractLabels` adds a 7th `queryRenderedFeatures` call per rebuild:

- `'skips re-scan within 50 m'`: `toHaveBeenCalledTimes(6)` → `toHaveBeenCalledTimes(7)` (and its comment: roads, waterways, trees, green, water, buildings, labels)
- `'markStale forces re-scan within 50 m'`: `toHaveBeenCalledTimes(12)` → `toHaveBeenCalledTimes(14)`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: new label tests FAIL (`labels` undefined); the two updated count tests FAIL (still 6/12 calls).

- [ ] **Step 3: Implement**

In `PlanetaryScenery.ts`, add constants near the other source-layer constants:

```ts
const LABEL_SOURCE_LAYERS = new Set(['poi', 'place'])
const LABEL_CAP = 40  // nearest named features get floating labels
```

Add the type and extend `SceneryData`:

```ts
export interface LabelSpec {
  text: string
  x: number
  z: number
}
```

```ts
export interface SceneryData {
  roads: RoadStrip[]
  treePositions: THREE.Vector3[]
  greenTriangles: Float32Array  // flat [x,z, x,z, ...] for triangulated green areas
  waterTriangles: Float32Array  // flat [x,z, x,z, ...] for triangulated water areas
  buildings: BuildingSpec[]
  labels: LabelSpec[]
}
```

Update the initial `_data` (line 62) to include `labels: []`, and `update()` to compute and store them:

```ts
    const [px, pz] = this.toLocal(lng, lat)
    const green = this.extractGreenAreas()
    this._data = {
      roads: [...this.extractRoads(), ...this.extractWaterways()],
      treePositions: [...this.extractTrees(), ...green.forestTrees],
      greenTriangles: green.triangles,
      waterTriangles: this.extractWaterAreas(),
      buildings: this.extractBuildings(),
      labels: this.extractLabels(px, pz),
    }
```

New extractor (after `extractTrees`):

```ts
  private extractLabels(px: number, pz: number): LabelSpec[] {
    const out: LabelSpec[] = []
    for (const f of this.queryBySourceLayer(LABEL_SOURCE_LAYERS)) {
      if (f.geometry.type !== 'Point') continue
      const name = f.properties?.name
      if (typeof name !== 'string' || name.length === 0) continue
      const [lng, lat] = f.geometry.coordinates as [number, number]
      const [x, z] = this.toLocal(lng, lat)
      out.push({ text: name, x, z })
    }
    out.sort((a, b) =>
      ((a.x - px) ** 2 + (a.z - pz) ** 2) - ((b.x - px) ** 2 + (b.z - pz) ** 2))
    return out.slice(0, LABEL_CAP)
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/planetary/PlanetaryScenery.ts src/planetary/__tests__/PlanetaryScenery.test.ts
git commit -m "feat(planetary): extract nearest named poi/place features as label specs"
git push
```

---

### Task 4: Label rendering + game-loop wiring

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts` (label group, `setLabels`, `makeLabelSprite`, `setPerfLevel`, `dispose`)
- Modify: `src/planetary/PlanetaryMode.tsx:483-488` (destructure + call)
- Test: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Interfaces:**
- Consumes: `LabelSpec` from Task 3 (`import type { LabelSpec } from './PlanetaryScenery'`).
- Produces: `engine.setLabels(specs: LabelSpec[]): void`. The label container is `THREE.Group` named `'labels'` (used by tests and `setPerfLevel`). Labels render as `THREE.Sprite`s (auto-face camera, zero per-frame cost), draw distance 300 m, always on top (`depthTest: false`, `renderOrder = 999`) like the streets-gl reference.

- [ ] **Step 1: Write the failing tests**

Append to `PlanetaryEngine.test.ts`:

```ts
describe('PlanetaryEngine — labels', () => {
  it('setLabels survives an environment without 2D canvas and clears previous labels', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    expect(() => engine.setLabels([{ text: 'Кафе Марс', x: 10, z: 10 }])).not.toThrow()
    expect(() => engine.setLabels([])).not.toThrow()
    expect(engine.scene.getObjectByName('labels')).toBeDefined()
    engine.dispose()
  })

  it('setPerfLevel(2) hides the label group', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setPerfLevel(2)
    expect(engine.scene.getObjectByName('labels')!.visible).toBe(false)
    engine.dispose()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: FAIL — `engine.setLabels is not a function`.

- [ ] **Step 3: Implement engine side**

In `PlanetaryEngine.ts`:

Import the type (extend the existing `RoadStrip` type import):

```ts
import type { RoadStrip, LabelSpec } from './PlanetaryScenery'
```

Add field next to `private roads = new THREE.Group()`:

```ts
  private labels = new THREE.Group()
```

In the constructor next to `this.scene.add(this.roads)`:

```ts
    this.labels.name = 'labels'
    this.scene.add(this.labels)
```

Add methods (after `setWaterAreas`):

```ts
  /** Floating place-name labels (streets-gl style). Sprites auto-face the camera. */
  setLabels(specs: LabelSpec[]): void {
    for (const child of this.labels.children) {
      const s = child as THREE.Sprite
      s.material.map?.dispose()
      s.material.dispose()
    }
    this.labels.clear()
    for (const spec of specs) {
      if (this.isBeyond(spec.x, spec.z, 300)) continue  // labels read badly beyond 300 m
      const sprite = this.makeLabelSprite(spec.text)
      if (!sprite) return  // no 2D canvas (jsdom/headless) — labels are cosmetic, skip
      sprite.position.set(spec.x, 10, spec.z)
      this.labels.add(sprite)
    }
  }

  private makeLabelSprite(text: string): THREE.Sprite | null {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const font = 'bold 40px sans-serif'
    ctx.font = font
    canvas.width = Math.ceil(ctx.measureText(text).width) + 16
    canvas.height = 56
    ctx.font = font  // canvas resize resets 2D state
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.fillStyle = '#ffffff'
    ctx.strokeText(text, 8, 28)
    ctx.fillText(text, 8, 28)
    const tex = new THREE.CanvasTexture(canvas)
    // depthTest off + high renderOrder: labels stay readable through buildings,
    // matching the streets-gl reference.
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false })
    const sprite = new THREE.Sprite(mat)
    sprite.renderOrder = 999
    sprite.scale.set(canvas.width * 0.045, canvas.height * 0.045, 1)  // 40px glyphs ≈ 1.8 m tall
    return sprite
  }
```

In `setPerfLevel`, inside the `if (level >= 2) {` block:

```ts
      this.labels.visible = false
```

In `dispose()`, before `this.renderer?.domElement.remove()`:

```ts
    this.setLabels([])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: all PASS.

- [ ] **Step 5: Wire into the game loop**

In `PlanetaryMode.tsx` (block "6b", ~line 483), extend the destructure and calls:

```ts
            const { roads, treePositions, greenTriangles, waterTriangles, buildings, labels } = sceneryRef.current.data
            engine.setRoads(roads)
            engine.setTrees(treePositions)
            engine.setGreenAreas(greenTriangles)
            engine.setWaterAreas(waterTriangles)
            engine.setBuildings(buildings)
            engine.setLabels(labels)
```

- [ ] **Step 6: Run the planetary suite**

Run: `npx vitest run src/planetary`
Expected: all PASS.

- [ ] **Step 7: Commit and push**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/PlanetaryMode.tsx src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "feat(planetary): floating place-name label sprites"
git push
```

---

### Task 5: Street object extraction (lamps + benches)

**Files:**
- Modify: `src/planetary/PlanetaryScenery.ts` (`SceneryData`, `BenchSpec`, `extractRoads` return shape, new `placeAlongFeature`, `update()`)
- Test: `src/planetary/__tests__/PlanetaryScenery.test.ts`

**Interfaces:**
- Consumes: `extractRoads()` internals from Tasks 1-2 (`cls`, `kind`, `halfWidth` per feature).
- Produces: `export interface BenchSpec { x: number; z: number; yaw: number }`; `SceneryData` gains `lampPositions: THREE.Vector3[]` (cap 200) and `benches: BenchSpec[]` (cap 80). `extractRoads()` changes its return type from `RoadStrip[]` to `{ strips: RoadStrip[]; lamps: THREE.Vector3[]; benches: BenchSpec[] }` (private method — only `update()` calls it). Task 6 consumes `engine.setStreetObjects(lamps: THREE.Vector3[], benches: BenchSpec[])`.

- [ ] **Step 1: Write the failing tests**

Append to `PlanetaryScenery.test.ts`:

```ts
describe('PlanetaryScenery — street objects', () => {
  const longFeat = (cls: string, coords: number[][] = [[0, 0], [0.01, 0]]) => ({
    sourceLayer: 'transportation',
    geometry: { type: 'LineString', coordinates: coords },  // 0.01° ≈ 1113 m
    properties: { class: cls },
  })

  it('places lamps every ~35 m along car roads, on the sidewalk line', () => {
    const sc = new PlanetaryScenery(makeMap([longFeat('residential')]) as any, identity)
    const { lampPositions } = sc.update(0, 0)
    expect(lampPositions.length).toBeGreaterThan(25)
    // residential halfWidth 4 → lamps on the sidewalk centerline at z = +5
    for (const p of lampPositions) expect(p.z).toBeCloseTo(5, 1)
  })

  it('caps lamps at 200', () => {
    const sc = new PlanetaryScenery(makeMap([longFeat('residential', [[0, 0], [0.1, 0]])]) as any, identity)
    expect(sc.update(0, 0).lampPositions).toHaveLength(200)
  })

  it('places benches with yaw along footways, capped at 80', () => {
    const sc = new PlanetaryScenery(makeMap([longFeat('footway')]) as any, identity)
    const { benches } = sc.update(0, 0)
    expect(benches.length).toBeGreaterThan(10)
    expect(benches.length).toBeLessThanOrEqual(80)
    expect(typeof benches[0].yaw).toBe('number')
  })

  it('does not put lamps on footways or benches on car roads', () => {
    const scPath = new PlanetaryScenery(makeMap([longFeat('footway')]) as any, identity)
    expect(scPath.update(0, 0).lampPositions).toHaveLength(0)
    const scRoad = new PlanetaryScenery(makeMap([longFeat('residential')]) as any, identity)
    expect(scRoad.update(0, 0).benches).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: FAIL — `lampPositions`/`benches` undefined.

- [ ] **Step 3: Implement**

In `PlanetaryScenery.ts`, add constants:

```ts
const LAMP_STEP = 35        // one street lamp per ~35 m of car road
const LAMP_CAP = 200
const BENCH_STEP = 50       // one bench per ~50 m of footpath
const BENCH_CAP = 80
```

Add the type and extend `SceneryData` (and the initial `_data` with `lampPositions: [], benches: []`):

```ts
export interface BenchSpec {
  x: number
  z: number
  yaw: number  // rotation.y aligning the bench's long axis with the path
}
```

```ts
export interface SceneryData {
  roads: RoadStrip[]
  treePositions: THREE.Vector3[]
  greenTriangles: Float32Array  // flat [x,z, x,z, ...] for triangulated green areas
  waterTriangles: Float32Array  // flat [x,z, x,z, ...] for triangulated water areas
  buildings: BuildingSpec[]
  labels: LabelSpec[]
  lampPositions: THREE.Vector3[]
  benches: BenchSpec[]
}
```

Add the walk helper (near `stripsFromFeature`):

```ts
  /** Walk a feature's line(s), emitting a point every `step` meters,
   *  laterally offset from the line by `offset` m along the segment normal. */
  private placeAlongFeature(
    f: MapGeoJSONFeature,
    step: number,
    offset: number,
    emit: (x: number, z: number, yaw: number) => void,
  ): void {
    const lines: [number, number][][] =
      f.geometry.type === 'LineString'
        ? [f.geometry.coordinates as [number, number][]]
        : f.geometry.type === 'MultiLineString'
        ? (f.geometry.coordinates as [number, number][][])
        : []
    for (const line of lines) {
      let acc = step / 2  // first object half a step in, not at the corner
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = this.toLocal(line[i][0], line[i][1])
        const [bx, bz] = this.toLocal(line[i + 1][0], line[i + 1][1])
        const dx = bx - ax
        const dz = bz - az
        const len = Math.sqrt(dx * dx + dz * dz)
        if (len < 0.1) continue
        const ux = -dz / len
        const uz = dx / len
        // rotation.y turning an X-aligned object to point along (dx, dz)
        const yaw = Math.atan2(-dz, dx)
        while (acc <= len) {
          const t = acc / len
          emit(ax + dx * t + ux * offset, az + dz * t + uz * offset, yaw)
          acc += step
        }
        acc -= len
      }
    }
  }
```

Change `extractRoads()` to also collect objects (full replacement of the method):

```ts
  private extractRoads(): { strips: RoadStrip[]; lamps: THREE.Vector3[]; benches: BenchSpec[] } {
    const strips: RoadStrip[] = []
    const lamps: THREE.Vector3[] = []
    const benches: BenchSpec[] = []
    const features = this.queryBySourceLayer(ROAD_SOURCE_LAYER)
    for (const f of features) {
      // Tunnels (subway lines, underpasses) are underground — drawing them on the
      // surface paints phantom roads/rails across the map.
      if (f.properties?.brunnel === 'tunnel') continue
      const cls = (f.properties?.subclass ?? f.properties?.class ?? 'residential') as string
      if (SKIP_ROAD_CLASSES.has(cls)) continue
      const isRail = RAIL_CLASSES.has(cls)
      const halfWidth = isRail ? 1.5 : ROAD_HALF_WIDTHS[cls] ?? DEFAULT_HALF_WIDTH
      const kind: RoadStrip['kind'] = isRail ? 'rail' : PATH_CLASSES.has(cls) ? 'path' : 'road'
      this.stripsFromFeature(f, halfWidth, kind, 0.05, strips)
      // Sidewalks flank car roads only (not paths/rails). y=0.04 so roads win overlaps.
      if (kind === 'road') {
        const off = halfWidth + 1
        this.stripsFromFeature(f, SIDEWALK_HALF_WIDTH, 'path', 0.04, strips, off)
        this.stripsFromFeature(f, SIDEWALK_HALF_WIDTH, 'path', 0.04, strips, -off)
        this.placeAlongFeature(f, LAMP_STEP, off, (x, z) => {
          if (lamps.length < LAMP_CAP) lamps.push(new THREE.Vector3(x, 0, z))
        })
      } else if (kind === 'path') {
        this.placeAlongFeature(f, BENCH_STEP, 1.4, (x, z, yaw) => {
          if (benches.length < BENCH_CAP) benches.push({ x, z, yaw })
        })
      }
    }
    return { strips, lamps, benches }
  }
```

Update `update()`:

```ts
    const [px, pz] = this.toLocal(lng, lat)
    const green = this.extractGreenAreas()
    const roadData = this.extractRoads()
    this._data = {
      roads: [...roadData.strips, ...this.extractWaterways()],
      treePositions: [...this.extractTrees(), ...green.forestTrees],
      greenTriangles: green.triangles,
      waterTriangles: this.extractWaterAreas(),
      buildings: this.extractBuildings(),
      labels: this.extractLabels(px, pz),
      lampPositions: roadData.lamps,
      benches: roadData.benches,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts`
Expected: all PASS (Task 2's sidewalk tests included — same code path moved, not changed).

- [ ] **Step 5: Commit and push**

```bash
git add src/planetary/PlanetaryScenery.ts src/planetary/__tests__/PlanetaryScenery.test.ts
git commit -m "feat(planetary): extract lamp and bench placements along roads and footpaths"
git push
```

---

### Task 6: Street object rendering + game-loop wiring

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts` (street-objects group, materials, `setStreetObjects`, `setPerfLevel`, `dispose`)
- Modify: `src/planetary/PlanetaryMode.tsx` (block 6b destructure + call)
- Test: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Interfaces:**
- Consumes: `BenchSpec` from Task 5 (`import type { RoadStrip, LabelSpec, BenchSpec } from './PlanetaryScenery'`), lamp `THREE.Vector3[]`.
- Produces: `engine.setStreetObjects(lamps: THREE.Vector3[], benches: BenchSpec[]): void`. Container is a `THREE.Group` named `'street-objects'` holding up to 4 `InstancedMesh`es (lamp poles, lamp heads, bench seats, bench backs — no geometry merging, so no BufferGeometryUtils import). No shadows. Hidden at perf level 2.

- [ ] **Step 1: Write the failing tests**

Append to `PlanetaryEngine.test.ts`:

```ts
describe('PlanetaryEngine — street objects', () => {
  it('setStreetObjects adds instanced lamp and bench meshes', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setStreetObjects([new THREE.Vector3(10, 0, 10)], [{ x: 5, z: 5, yaw: 0.5 }])
    const group = engine.scene.getObjectByName('street-objects')!
    // lamp pole + lamp head + bench seat + bench back
    expect(group.children.filter(o => o instanceof THREE.InstancedMesh)).toHaveLength(4)
    engine.dispose()
  })

  it('culls street objects beyond the fog-far distance and rebuilds cleanly', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setViewFromPlayer(new THREE.Vector3(0, 1.7, 0), 0, 0)
    engine.setStreetObjects([new THREE.Vector3(10, 0, 10), new THREE.Vector3(800, 0, 800)], [])
    const group = engine.scene.getObjectByName('street-objects')!
    const poles = group.children[0] as THREE.InstancedMesh
    expect(poles.count).toBe(1)
    engine.setStreetObjects([], [])
    expect(group.children).toHaveLength(0)
    engine.dispose()
  })

  it('setPerfLevel(2) hides street objects', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setPerfLevel(2)
    expect(engine.scene.getObjectByName('street-objects')!.visible).toBe(false)
    engine.dispose()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: FAIL — `engine.setStreetObjects is not a function`.

- [ ] **Step 3: Implement engine side**

In `PlanetaryEngine.ts`:

Extend the type import:

```ts
import type { RoadStrip, LabelSpec, BenchSpec } from './PlanetaryScenery'
```

Add fields next to `private labels`:

```ts
  private streetObjects = new THREE.Group()
  private lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x3c4048, metalness: 0.6, roughness: 0.5 })
  private lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc })  // basic = always lit, cheap glow look
  private benchMat = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.9, metalness: 0 })
```

In the constructor next to the labels group:

```ts
    this.streetObjects.name = 'street-objects'
    this.scene.add(this.streetObjects)
```

Add the method (after `setLabels`):

```ts
  /** Instanced street furniture: lamp posts along car roads, benches along footpaths. */
  setStreetObjects(lamps: THREE.Vector3[], benches: BenchSpec[]): void {
    for (const m of this.streetObjects.children) {
      if (m instanceof THREE.Mesh) m.geometry.dispose()
    }
    this.streetObjects.clear()
    const far = this.cullFar()
    const dummy = new THREE.Object3D()

    const nearLamps = lamps.filter(p => !this.isBeyond(p.x, p.z, far))
    if (nearLamps.length > 0) {
      // Geometries pre-translated so the instance origin sits on the ground.
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.1, 5, 6).translate(0, 2.5, 0)
      const headGeo = new THREE.SphereGeometry(0.25, 8, 6).translate(0, 5, 0)
      const poles = new THREE.InstancedMesh(poleGeo, this.lampPoleMat, nearLamps.length)
      const heads = new THREE.InstancedMesh(headGeo, this.lampHeadMat, nearLamps.length)
      for (let i = 0; i < nearLamps.length; i++) {
        dummy.position.set(nearLamps[i].x, 0, nearLamps[i].z)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        poles.setMatrixAt(i, dummy.matrix)
        heads.setMatrixAt(i, dummy.matrix)
      }
      this.streetObjects.add(poles, heads)
    }

    const nearBenches = benches.filter(b => !this.isBeyond(b.x, b.z, far))
    if (nearBenches.length > 0) {
      // Two instanced boxes sharing the same per-instance matrices — avoids a
      // BufferGeometryUtils merge for a two-box prop.
      const seatGeo = new THREE.BoxGeometry(1.6, 0.08, 0.5).translate(0, 0.45, 0)
      const backGeo = new THREE.BoxGeometry(1.6, 0.5, 0.08).translate(0, 0.75, -0.25)
      const seats = new THREE.InstancedMesh(seatGeo, this.benchMat, nearBenches.length)
      const backs = new THREE.InstancedMesh(backGeo, this.benchMat, nearBenches.length)
      for (let i = 0; i < nearBenches.length; i++) {
        dummy.position.set(nearBenches[i].x, 0, nearBenches[i].z)
        dummy.rotation.set(0, nearBenches[i].yaw, 0)
        dummy.updateMatrix()
        seats.setMatrixAt(i, dummy.matrix)
        backs.setMatrixAt(i, dummy.matrix)
      }
      this.streetObjects.add(seats, backs)
    }
  }
```

In `setPerfLevel`, inside `if (level >= 2) {`, next to the labels line:

```ts
      this.streetObjects.visible = false
```

In `dispose()`, next to `this.setLabels([])`:

```ts
    this.setStreetObjects([], [])
    this.lampPoleMat.dispose()
    this.lampHeadMat.dispose()
    this.benchMat.dispose()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: all PASS.

- [ ] **Step 5: Wire into the game loop**

In `PlanetaryMode.tsx` block 6b (extended in Task 4), final form:

```ts
            const { roads, treePositions, greenTriangles, waterTriangles, buildings, labels, lampPositions, benches } = sceneryRef.current.data
            engine.setRoads(roads)
            engine.setTrees(treePositions)
            engine.setGreenAreas(greenTriangles)
            engine.setWaterAreas(waterTriangles)
            engine.setBuildings(buildings)
            engine.setLabels(labels)
            engine.setStreetObjects(lampPositions, benches)
```

- [ ] **Step 6: Run the full planetary suite**

Run: `npx vitest run src/planetary`
Expected: all PASS.

- [ ] **Step 7: Commit and push**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/PlanetaryMode.tsx src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "feat(planetary): instanced street lamps and benches"
git push
```

---

### Task 7: Full verification

**Files:** none new — verification only.

- [ ] **Step 1: Full test suite + build**

Run: `npm run build && npx vitest run`
Expected: build succeeds; no NEW test failures. (Memory note: some Playwright e2e specs fail on main independently of changes — compare against main, don't chase those.)

- [ ] **Step 2: Fix anything red, commit, push**

If Step 1 surfaced failures caused by this work, fix and re-run until green, then commit and push.

- [ ] **Step 3: Watch CI**

```bash
gh run list --repo hermes98761234/browser-shooter --branch main --limit 2
gh run watch <latest-run-id> --exit-status
```

Expected: success. If CI fails, fix and push before reporting done.

- [ ] **Step 4: Visual sanity check (best-effort)**

Load planetary mode headlessly (the `window.__eng` debug handle + drive-script recipe from project memory) and confirm: sidewalk strips flank roads, label sprites exist (`__eng.scene.getObjectByName('labels').children.length > 0` — requires a real canvas, so only in the browser run, not jsdom), street objects group has 4 instanced meshes, and frame time hasn't regressed past the 70 ms degrade threshold at perf level 0/1.
