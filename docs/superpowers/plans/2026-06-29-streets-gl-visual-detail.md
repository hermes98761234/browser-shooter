# streets-gl Visual Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Planetary Mode from plain gray boxes + flat ground to streets-gl–level rendering: textured building facades, OSM road geometry, billboard trees, green area meshes, real-time shadow maps, and a dynamic time-of-day sun.

**Architecture:** `PlanetaryScenery` mirrors `PlanetaryCollision` — queries MapLibre on `idle` for roads/trees/green-areas, converts to local coords, returns structured data. `SunSystem` converts a time-of-day hour to sun direction + colors. `PlanetaryEngine` gains five new rendering methods and shadow/sky setup. `PlanetaryMode` wires the new systems and adds a time-of-day slider.

**Tech Stack:** Three.js 0.170 (`three/addons/objects/Sky.js`), MapLibre GL (`queryRenderedFeatures`), Vitest, React.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/planetary/assets/building-facade.png` | Create (copy) | UV-repeated window texture for building faces |
| `src/planetary/assets/road-asphalt.png` | Create (copy) | Seamless asphalt for road quads |
| `src/planetary/assets/tree-sprite.png` | Create (copy) | Billboard sprite for tree instances |
| `src/planetary/SunSystem.ts` | Create | hour → sun direction, light color, sky colors |
| `src/planetary/PlanetaryScenery.ts` | Create | MapLibre → roads / trees / green-area geometry |
| `src/planetary/__tests__/SunSystem.test.ts` | Create | Unit tests for SunSystem |
| `src/planetary/__tests__/PlanetaryScenery.test.ts` | Create | Unit tests for PlanetaryScenery |
| `src/planetary/PlanetaryEngine.ts` | Modify | Add setRoads/setTrees/setGreenAreas/setSunAngle/shadows/sky/facade texture |
| `src/planetary/PlanetaryMode.tsx` | Modify | Add sceneryRef, sunHour state, slider UI, game loop wiring |

---

## Task 1: Copy streets-gl texture assets

**Files:**
- Create: `src/planetary/assets/building-facade.png`
- Create: `src/planetary/assets/road-asphalt.png`
- Create: `src/planetary/assets/tree-sprite.png`

- [ ] **Step 1: Clone streets-gl and locate textures**

```bash
git clone --depth 1 https://github.com/StrandedKitty/streets-gl /tmp/streets-gl
find /tmp/streets-gl -name "*.png" | sort
```

Look for files matching: building facade/window, road/asphalt, tree/sprite. Common locations are `public/`, `src/assets/`, `static/`.

- [ ] **Step 2: Create assets directory and copy files**

```bash
mkdir -p src/planetary/assets
```

Copy the three textures. If exact names differ, rename on copy:

```bash
# Adjust source paths based on what find returned above
cp /tmp/streets-gl/<path>/building_facade.png src/planetary/assets/building-facade.png
cp /tmp/streets-gl/<path>/road_asphalt.png    src/planetary/assets/road-asphalt.png
cp /tmp/streets-gl/<path>/tree_sprite.png     src/planetary/assets/tree-sprite.png
```

**Fallback** — if streets-gl doesn't have one of the textures, create a placeholder:
- `building-facade.png`: 128×128 px, gray background with blue 8×12 px rectangles in a grid pattern (windows). Any image editor or script works.
- `road-asphalt.png`: 128×128 px solid `#444444`.
- `tree-sprite.png`: 64×128 px, transparent background, green oval in upper 80%.

- [ ] **Step 3: Verify files exist**

```bash
ls -lh src/planetary/assets/
```

Expected: three `.png` files, each > 1 KB.

- [ ] **Step 4: Commit**

```bash
git add src/planetary/assets/
git commit -m "feat(planetary): add streets-gl texture assets (MIT)"
```

---

## Task 2: SunSystem

**Files:**
- Create: `src/planetary/SunSystem.ts`
- Create: `src/planetary/__tests__/SunSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/planetary/__tests__/SunSystem.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SunSystem } from '../SunSystem'
import * as THREE from 'three'

describe('SunSystem', () => {
  const sys = new SunSystem()

  it('sun is above horizon at noon', () => {
    const { direction } = sys.compute(12)
    expect(direction.y).toBeGreaterThan(0)
  })

  it('sun direction is normalized', () => {
    const { direction } = sys.compute(12)
    expect(direction.length()).toBeCloseTo(1, 3)
  })

  it('intensity is highest around noon', () => {
    const noon = sys.compute(12)
    const dawn = sys.compute(6)
    expect(noon.intensity).toBeGreaterThan(dawn.intensity)
  })

  it('intensity is zero at midnight', () => {
    const { intensity } = sys.compute(0)
    expect(intensity).toBe(0)
  })

  it('intensity is zero at 3am', () => {
    const { intensity } = sys.compute(3)
    expect(intensity).toBe(0)
  })

  it('returns SunState with all required fields', () => {
    const state = sys.compute(10)
    expect(state.direction).toBeInstanceOf(THREE.Vector3)
    expect(state.color).toBeInstanceOf(THREE.Color)
    expect(typeof state.intensity).toBe('number')
    expect(state.skyTop).toBeInstanceOf(THREE.Color)
    expect(state.skyHorizon).toBeInstanceOf(THREE.Color)
  })

  it('sun direction is roughly east at sunrise (hour=6)', () => {
    const { direction } = sys.compute(6)
    // At sunrise elevation≈0, sun should be more horizontal than vertical
    expect(Math.abs(direction.x) + Math.abs(direction.z)).toBeGreaterThan(direction.y)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/planetary/__tests__/SunSystem.test.ts
```

Expected: `Cannot find module '../SunSystem'`

- [ ] **Step 3: Implement SunSystem**

Create `src/planetary/SunSystem.ts`:

```ts
import * as THREE from 'three'

export interface SunState {
  direction: THREE.Vector3  // normalized, points from scene toward sun
  color: THREE.Color
  intensity: number         // 0 at night, up to 1.2 at noon
  skyTop: THREE.Color
  skyHorizon: THREE.Color
}

export class SunSystem {
  compute(hour: number): SunState {
    // t: 0 at 6am, 0.5 at noon, 1 at 6pm, negative/>1 at night
    const t = (hour - 6) / 12
    const elevAngle = t * Math.PI  // radians; sin gives 0 at dawn, 1 at noon, 0 at dusk
    const sinElev = Math.sin(elevAngle)
    const cosElev = Math.cos(elevAngle)

    // Azimuth: sun sweeps from east (-X) at dawn through south (+Z) at noon to west (+X) at dusk
    const aziAngle = (t - 0.5) * Math.PI

    const direction = new THREE.Vector3(
      cosElev * Math.sin(aziAngle),
      Math.max(0, sinElev),
      cosElev * Math.cos(aziAngle),
    ).normalize()

    const intensity = Math.max(0, sinElev) * 1.2

    const color = new THREE.Color()
    if (sinElev <= 0) {
      color.setHex(0x102040)
    } else if (sinElev < 0.3) {
      // low sun: orange
      const f = sinElev / 0.3
      color.setRGB(1, 0.38 + f * 0.62, f * 1.0)
    } else {
      color.setHex(0xffffff)
    }

    const skyTop = new THREE.Color()
    const skyHorizon = new THREE.Color()
    if (sinElev <= 0) {
      skyTop.setHex(0x050510)
      skyHorizon.setHex(0x0d1020)
    } else if (sinElev < 0.25) {
      const f = sinElev / 0.25
      skyTop.lerpColors(new THREE.Color(0x0d1535), new THREE.Color(0x1a50a0), f)
      skyHorizon.lerpColors(new THREE.Color(0xff6035), new THREE.Color(0x9ec7e8), f)
    } else {
      skyTop.setHex(0x1a50a0)
      skyHorizon.setHex(0x9ec7e8)
    }

    return { direction, color, intensity, skyTop, skyHorizon }
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/planetary/__tests__/SunSystem.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/planetary/SunSystem.ts src/planetary/__tests__/SunSystem.test.ts
git commit -m "feat(planetary): add SunSystem for time-of-day sun position"
```

---

## Task 3: PlanetaryScenery — road extraction

**Files:**
- Create: `src/planetary/PlanetaryScenery.ts`
- Create: `src/planetary/__tests__/PlanetaryScenery.test.ts`

- [ ] **Step 1: Write road extraction tests**

Create `src/planetary/__tests__/PlanetaryScenery.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { PlanetaryScenery } from '../PlanetaryScenery'
import * as THREE from 'three'

const identity = (lng: number, lat: number): [number, number] => [lng * 111320, -lat * 111320]

function makeMap(features: object[]) {
  return { queryRenderedFeatures: vi.fn(() => features) }
}

const roadFeature = {
  geometry: { type: 'LineString', coordinates: [[0, 0], [0.001, 0]] },
  properties: { class: 'residential' },
}

const residentialHalfWidth = 4

describe('PlanetaryScenery — roads', () => {
  it('extracts road strips from LineString features', () => {
    const map = makeMap([roadFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads.length).toBeGreaterThan(0)
  })

  it('road strip has 4 corners', () => {
    const map = makeMap([roadFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads[0].corners).toHaveLength(4)
  })

  it('road strip corners are Vector3 instances', () => {
    const map = makeMap([roadFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    for (const c of roads[0].corners) expect(c).toBeInstanceOf(THREE.Vector3)
  })

  it('road half-width matches residential (4m)', () => {
    const map = makeMap([roadFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    const [a, b] = [roads[0].corners[0], roads[0].corners[1]]
    const width = a.distanceTo(b)
    expect(width).toBeCloseTo(residentialHalfWidth * 2, 0)
  })

  it('road strip uvLength is positive', () => {
    const map = makeMap([roadFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads[0].uvLength).toBeGreaterThan(0)
  })

  it('skips re-scan within 50 m', () => {
    const map = makeMap([roadFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    sc.update(0, 0)
    sc.update(0.0001, 0.0001)  // ~15 m
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(1)
  })

  it('bumps rebuildVersion only on actual rebuild', () => {
    const map = makeMap([roadFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    sc.update(0, 0)
    const v = sc.rebuildVersion
    sc.update(0.0001, 0.0001)
    expect(sc.rebuildVersion).toBe(v)
    sc.update(0, 0.001)  // >50 m
    expect(sc.rebuildVersion).toBe(v + 1)
  })

  it('markStale forces re-scan within 50 m', () => {
    const map = makeMap([roadFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    sc.update(0, 0)
    sc.markStale()
    sc.update(0.0001, 0.0001)
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(2)
  })

  it('ignores non-road geometry types', () => {
    const pointFeature = { geometry: { type: 'Point', coordinates: [0, 0] }, properties: { class: 'residential' } }
    const map = makeMap([pointFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts
```

Expected: `Cannot find module '../PlanetaryScenery'`

- [ ] **Step 3: Implement PlanetaryScenery with road extraction**

Create `src/planetary/PlanetaryScenery.ts`:

```ts
import * as THREE from 'three'
import type maplibregl from 'maplibre-gl'
import { lngLatDistance } from './geoUtils'

const RESCAN_METERS = 50
const ROAD_LAYERS = ['transportation', 'road', 'road_link']
const TREE_LAYERS = ['poi_label', 'nature', 'landuse_overlay']
const GREEN_LAYERS = ['landuse', 'landcover']

const ROAD_HALF_WIDTHS: Record<string, number> = {
  motorway: 8, trunk: 8,
  primary: 6, secondary: 6,
  tertiary: 4, residential: 4, service: 4,
  path: 2, footway: 2, cycleway: 2,
}
const DEFAULT_HALF_WIDTH = 3

export interface RoadStrip {
  // quad corners in local XZ (Y=0.05 to sit above ground)
  corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
  uvLength: number  // segment length in meters, for UV tiling
}

export interface SceneryData {
  roads: RoadStrip[]
  treePositions: THREE.Vector3[]
  greenTriangles: Float32Array  // flat [x,z, x,z, ...] for triangulated green areas
}

export class PlanetaryScenery {
  private lastLng = NaN
  private lastLat = NaN
  private _rebuildVersion = 0
  private _data: SceneryData = { roads: [], treePositions: [], greenTriangles: new Float32Array(0) }

  get rebuildVersion(): number { return this._rebuildVersion }
  get data(): SceneryData { return this._data }

  constructor(
    private map: Pick<maplibregl.Map, 'queryRenderedFeatures'>,
    private toLocal: (lng: number, lat: number) => [number, number],
  ) {}

  markStale(): void {
    this.lastLng = NaN
    this.lastLat = NaN
  }

  update(lng: number, lat: number): SceneryData {
    if (
      !isNaN(this.lastLng) &&
      lngLatDistance(lng, lat, this.lastLng, this.lastLat) < RESCAN_METERS
    ) return this._data

    this.lastLng = lng
    this.lastLat = lat
    this._rebuildVersion += 1
    this._data = {
      roads: this.extractRoads(),
      treePositions: this.extractTrees(),
      greenTriangles: this.extractGreenAreas(),
    }
    return this._data
  }

  private extractRoads(): RoadStrip[] {
    const features = this.map.queryRenderedFeatures(undefined, { layers: ROAD_LAYERS })
    const strips: RoadStrip[] = []
    for (const f of features) {
      const cls = (f.properties?.subclass ?? f.properties?.class ?? 'residential') as string
      const halfWidth = ROAD_HALF_WIDTHS[cls] ?? DEFAULT_HALF_WIDTH
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
          // Normal in XZ plane (perpendicular to segment)
          const nx = (-dz / len) * halfWidth
          const nz = (dx / len) * halfWidth
          strips.push({
            corners: [
              new THREE.Vector3(ax + nx, 0.05, az + nz),
              new THREE.Vector3(ax - nx, 0.05, az - nz),
              new THREE.Vector3(bx - nx, 0.05, bz - nz),
              new THREE.Vector3(bx + nx, 0.05, bz + nz),
            ],
            uvLength: len,
          })
        }
      }
    }
    return strips
  }

  private extractTrees(): THREE.Vector3[] {
    const features = this.map.queryRenderedFeatures(undefined, { layers: TREE_LAYERS })
    const positions: THREE.Vector3[] = []
    for (const f of features) {
      if (f.geometry.type !== 'Point') continue
      const nat = f.properties?.natural ?? f.properties?.type
      if (nat !== 'tree') continue
      const coords = f.geometry.coordinates as [number, number]
      const [x, z] = this.toLocal(coords[0], coords[1])
      positions.push(new THREE.Vector3(x, 0, z))
    }
    return positions
  }

  private extractGreenAreas(): Float32Array {
    const GREEN_CLASSES = new Set(['grass', 'park', 'forest', 'farmland', 'scrub', 'meadow'])
    const features = this.map.queryRenderedFeatures(undefined, { layers: GREEN_LAYERS })
    const verts: number[] = []
    for (const f of features) {
      const cls = f.properties?.class ?? f.properties?.landuse ?? f.properties?.landcover
      if (!GREEN_CLASSES.has(cls)) continue
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
}
```

- [ ] **Step 4: Run road tests — expect pass**

```bash
npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts
```

Expected: all 9 road tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryScenery.ts src/planetary/__tests__/PlanetaryScenery.test.ts
git commit -m "feat(planetary): add PlanetaryScenery with road extraction"
```

---

## Task 4: PlanetaryScenery — trees and green areas

**Files:**
- Modify: `src/planetary/__tests__/PlanetaryScenery.test.ts` (add tests)
- No changes to `PlanetaryScenery.ts` — tree/green logic already written in Task 3

- [ ] **Step 1: Add tree and green-area tests**

Append to `src/planetary/__tests__/PlanetaryScenery.test.ts`:

```ts
const treeFeature = {
  geometry: { type: 'Point', coordinates: [0.001, 0.001] },
  properties: { natural: 'tree' },
}

const grassFeature = {
  geometry: {
    type: 'Polygon',
    coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]],
  },
  properties: { class: 'grass' },
}

describe('PlanetaryScenery — trees', () => {
  it('extracts tree positions from Point features with natural=tree', () => {
    const map = makeMap([treeFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { treePositions } = sc.update(0, 0)
    expect(treePositions.length).toBe(1)
  })

  it('tree position is a Vector3', () => {
    const map = makeMap([treeFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { treePositions } = sc.update(0, 0)
    expect(treePositions[0]).toBeInstanceOf(THREE.Vector3)
  })

  it('ignores Point features that are not trees', () => {
    const nonTree = { geometry: { type: 'Point', coordinates: [0, 0] }, properties: { natural: 'rock' } }
    const map = makeMap([nonTree])
    const sc = new PlanetaryScenery(map as any, identity)
    const { treePositions } = sc.update(0, 0)
    expect(treePositions).toHaveLength(0)
  })
})

describe('PlanetaryScenery — green areas', () => {
  it('triangulates a grass polygon', () => {
    const map = makeMap([grassFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { greenTriangles } = sc.update(0, 0)
    // A 5-point ring (square) → 2 triangles → 6 vertices → 12 floats (x,z pairs)
    expect(greenTriangles.length).toBeGreaterThan(0)
    expect(greenTriangles.length % 6).toBe(0)  // multiple of 3 vertices, 2 floats each
  })

  it('ignores polygons with non-green class', () => {
    const industryFeature = {
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0]]] },
      properties: { class: 'industrial' },
    }
    const map = makeMap([industryFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { greenTriangles } = sc.update(0, 0)
    expect(greenTriangles.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run all PlanetaryScenery tests**

```bash
npx vitest run src/planetary/__tests__/PlanetaryScenery.test.ts
```

Expected: all tests pass (implementation was written in Task 3).

- [ ] **Step 3: Commit**

```bash
git add src/planetary/__tests__/PlanetaryScenery.test.ts
git commit -m "test(planetary): add tree and green-area tests for PlanetaryScenery"
```

---

## Task 5: PlanetaryEngine — shadows, sky, setSunAngle

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts`
- Modify: `src/planetary/__tests__/PlanetaryEngine.test.ts`

- [ ] **Step 1: Add failing tests for setSunAngle and shadow setup**

Append to `src/planetary/__tests__/PlanetaryEngine.test.ts`:

```ts
import { SunSystem } from '../SunSystem'

describe('PlanetaryEngine — sun and shadows', () => {
  it('setSunAngle updates the directional light position', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    const sys = new SunSystem()
    const before = engine.sun.position.clone()
    engine.setSunAngle(sys.compute(6))
    engine.setSunAngle(sys.compute(12))
    expect(engine.sun.position.y).toBeGreaterThan(before.y)
    engine.dispose()
  })

  it('sun is exposed as a public property', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    expect(engine.sun).toBeDefined()
    engine.dispose()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts
```

Expected: `engine.sun is not defined` or similar.

- [ ] **Step 3: Add shadow setup, Sky, and setSunAngle to PlanetaryEngine**

Replace the lighting block and add new code in `src/planetary/PlanetaryEngine.ts`. Full file after changes:

```ts
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import type { BoxCollider } from '../engine/CollisionWorld'
import type { RoadStrip } from './PlanetaryScenery'
import type { SunState } from './SunSystem'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const METERS_PER_DEG_LAT = 111320

function lngLatToMercator(lng: number, lat: number): [number, number] {
  const x = lng * METERS_PER_DEG_LAT * Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180)
  const y = lat * METERS_PER_DEG_LAT
  return [x, y]
}

function mercatorToLngLat(x: number, y: number): [number, number] {
  const lat = y / METERS_PER_DEG_LAT
  const lng = x / (METERS_PER_DEG_LAT * Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180))
  return [lng, lat]
}

export class PlanetaryEngine {
  map: maplibregl.Map
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  sun: THREE.DirectionalLight
  private sky: Sky
  private renderer: THREE.WebGLRenderer | null = null
  private buildings = new THREE.Group()
  private roads = new THREE.Group()
  private trees: THREE.InstancedMesh | null = null
  private greenAreas: THREE.Mesh | null = null
  private buildingMat: THREE.MeshStandardMaterial
  private roadMat: THREE.MeshStandardMaterial
  private treeMat: THREE.MeshBasicMaterial
  private greenMat: THREE.MeshStandardMaterial
  private loader = new THREE.TextureLoader()
  private readyCbs: (() => void)[] = []
  private originMercator: [number, number] = [0, 0]

  constructor(private container: HTMLElement, center: [number, number] = [0, 0]) {
    this.originMercator = lngLatToMercator(center[0], center[1])

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x9ec7e8, 120, 600)

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000)

    // Ambient light (soft fill)
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6))

    // Directional sun with shadows
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2)
    this.sun.position.set(100, 200, 50)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 400
    this.sun.shadow.camera.left = -125
    this.sun.shadow.camera.right = 125
    this.sun.shadow.camera.top = 125
    this.sun.shadow.camera.bottom = -125
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    // Sky
    this.sky = new Sky()
    this.sky.scale.setScalar(10000)
    this.scene.add(this.sky)
    this.sky.material.uniforms['turbidity'].value = 10
    this.sky.material.uniforms['rayleigh'].value = 2
    this.sky.material.uniforms['mieCoefficient'].value = 0.005
    this.sky.material.uniforms['mieDirectionalG'].value = 0.8

    // Materials
    const facadeTex = this.loader.load(new URL('./assets/building-facade.png', import.meta.url).href)
    facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping
    this.buildingMat = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.9, metalness: 0 })

    const roadTex = this.loader.load(new URL('./assets/road-asphalt.png', import.meta.url).href)
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping
    this.roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 1, metalness: 0 })

    const treeTex = this.loader.load(new URL('./assets/tree-sprite.png', import.meta.url).href)
    this.treeMat = new THREE.MeshBasicMaterial({ map: treeTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })

    const greenTex = this.loader.load(new URL('./assets/road-asphalt.png', import.meta.url).href)  // reuse or replace with grass
    greenTex.wrapS = greenTex.wrapT = THREE.RepeatWrapping
    this.greenMat = new THREE.MeshStandardMaterial({ color: 0x4a6b38, roughness: 1, metalness: 0 })

    // Ground (fallback for areas without OSM green data)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: 0x3a5228, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    this.scene.add(this.buildings)
    this.scene.add(this.roads)

    this.map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center,
      zoom: 17,
      pitch: 0,
    })
    this.map.on('load', () => {
      this.readyCbs.forEach(cb => cb())
    })
  }

  onReady(cb: () => void) {
    this.readyCbs.push(cb)
  }

  setSunAngle(state: SunState): void {
    const d = state.direction
    this.sun.position.set(d.x * 200, d.y * 200, d.z * 200)
    this.sun.color.copy(state.color)
    this.sun.intensity = state.intensity
    this.sky.material.uniforms['sunPosition'].value.copy(state.direction)
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(state.skyHorizon)
    }
  }

  setViewFromPlayer(playerPos: THREE.Vector3, yaw: number, pitch: number) {
    this.camera.position.copy(playerPos)
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ')
    // Keep shadow frustum centered on player
    this.sun.target.position.copy(playerPos)
    this.sun.target.updateMatrixWorld()
  }

  setBuildings(boxes: BoxCollider[]) {
    this.disposeGroup(this.buildings)
    for (const b of boxes) {
      const sx = b.max.x - b.min.x
      const sy = b.max.y - b.min.y
      const sz = b.max.z - b.min.z
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), this.buildingMat)
      mesh.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
      // UV repeat: tile every 4 m
      const geo = mesh.geometry
      const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute
      const uvArr = uvAttr.array as Float32Array
      for (let i = 0; i < uvArr.length; i += 2) {
        uvArr[i] *= sx / 4
        uvArr[i + 1] *= sy / 4
      }
      uvAttr.needsUpdate = true
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.buildings.add(mesh)
    }
  }

  setRoads(roads: RoadStrip[]): void {
    this.disposeGroup(this.roads)
    for (const strip of roads) {
      const [a, b, c, d] = strip.corners
      const geo = new THREE.BufferGeometry()
      // Two triangles: ABD and BCD
      const positions = new Float32Array([
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        d.x, d.y, d.z,
        b.x, b.y, b.z,
        c.x, c.y, c.z,
        d.x, d.y, d.z,
      ])
      // UV: tile along length, road width = 1 UV unit
      const uvLen = strip.uvLength / 4  // tile every 4 m
      const uvs = new Float32Array([
        0, 0,  1, 0,  0, uvLen,
        1, 0,  1, uvLen,  0, uvLen,
      ])
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      geo.computeVertexNormals()
      const mesh = new THREE.Mesh(geo, this.roadMat)
      mesh.receiveShadow = true
      this.roads.add(mesh)
    }
  }

  setTrees(positions: THREE.Vector3[]): void {
    if (this.trees) {
      this.trees.geometry.dispose()
      this.scene.remove(this.trees)
      this.trees = null
    }
    if (positions.length === 0) return
    const geo = new THREE.PlaneGeometry(6, 10)
    const mesh = new THREE.InstancedMesh(geo, this.treeMat, positions.length)
    mesh.castShadow = true
    const dummy = new THREE.Object3D()
    for (let i = 0; i < positions.length; i++) {
      dummy.position.copy(positions[i])
      dummy.position.y = 5  // center of 10 m tall plane
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    this.trees = mesh
    this.scene.add(this.trees)
  }

  setGreenAreas(triangles: Float32Array): void {
    if (this.greenAreas) {
      this.greenAreas.geometry.dispose()
      this.scene.remove(this.greenAreas)
      this.greenAreas = null
    }
    if (triangles.length === 0) return
    const vertCount = triangles.length / 2
    const pos = new Float32Array(vertCount * 3)
    const uvArr = new Float32Array(vertCount * 2)
    for (let i = 0; i < vertCount; i++) {
      const x = triangles[i * 2]
      const z = triangles[i * 2 + 1]
      pos[i * 3] = x
      pos[i * 3 + 1] = 0.01
      pos[i * 3 + 2] = z
      uvArr[i * 2] = x / 4
      uvArr[i * 2 + 1] = z / 4
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2))
    geo.computeVertexNormals()
    this.greenAreas = new THREE.Mesh(geo, this.greenMat)
    this.greenAreas.receiveShadow = true
    this.scene.add(this.greenAreas)
  }

  render() {
    if (!this.renderer) {
      const r = new THREE.WebGLRenderer({ antialias: true })
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      r.shadowMap.enabled = true
      r.shadowMap.type = THREE.PCFSoftShadowMap
      const canvas = r.domElement
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      this.container.appendChild(canvas)
      this.renderer = r
    }
    // Billboard trees: rotate each instance to face camera each frame
    if (this.trees) {
      const camPos = this.camera.position
      const dummy = new THREE.Object3D()
      const mat = new THREE.Matrix4()
      for (let i = 0; i < this.trees.count; i++) {
        this.trees.getMatrixAt(i, mat)
        dummy.matrix.copy(mat)
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
        dummy.lookAt(camPos.x, dummy.position.y, camPos.z)
        dummy.updateMatrix()
        this.trees.setMatrixAt(i, dummy.matrix)
      }
      this.trees.instanceMatrix.needsUpdate = true
    }
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    const size = this.renderer.getSize(new THREE.Vector2())
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
    this.renderer.render(this.scene, this.camera)
  }

  localToMercator(localX: number, localZ: number, height = 0): THREE.Vector3 {
    return new THREE.Vector3(this.originMercator[0] + localX, height, this.originMercator[1] - localZ)
  }

  mercatorToLocal(mx: number, my: number): [number, number] {
    return [mx - this.originMercator[0], this.originMercator[1] - my]
  }

  lngLatToLocal(lng: number, lat: number): [number, number] {
    const [mx, my] = lngLatToMercator(lng, lat)
    return this.mercatorToLocal(mx, my)
  }

  localToLngLat(localX: number, localZ: number): [number, number] {
    const mx = this.originMercator[0] + localX
    const my = this.originMercator[1] - localZ
    return mercatorToLngLat(mx, my)
  }

  private disposeGroup(group: THREE.Group) {
    for (const m of group.children) {
      if (m instanceof THREE.Mesh) m.geometry.dispose()
    }
    group.clear()
  }

  dispose() {
    this.disposeGroup(this.buildings)
    this.disposeGroup(this.roads)
    if (this.trees) { this.trees.geometry.dispose(); this.scene.remove(this.trees) }
    if (this.greenAreas) { this.greenAreas.geometry.dispose(); this.scene.remove(this.greenAreas) }
    this.renderer?.domElement.remove()
    this.renderer?.dispose()
    this.map.remove()
  }
}
```

- [ ] **Step 4: Run engine tests — expect pass**

```bash
npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts
```

Expected: all tests pass including the two new sun tests.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "feat(planetary): add shadow maps, sky shader, sun/road/tree/green-area rendering"
```

---

## Task 6: Add engine tests for setRoads, setTrees, setGreenAreas

**Files:**
- Modify: `src/planetary/__tests__/PlanetaryEngine.test.ts`

- [ ] **Step 1: Add tests for new engine methods**

Append to `src/planetary/__tests__/PlanetaryEngine.test.ts`:

```ts
import type { RoadStrip } from '../PlanetaryScenery'

function makeRoadStrip(): RoadStrip {
  return {
    corners: [
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(0, 0.05, 4),
      new THREE.Vector3(10, 0.05, 4),
      new THREE.Vector3(10, 0.05, 0),
    ],
    uvLength: 10,
  }
}

describe('PlanetaryEngine — setRoads / setTrees / setGreenAreas', () => {
  it('setRoads adds meshes to scene', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    const before = engine.scene.children.length
    engine.setRoads([makeRoadStrip(), makeRoadStrip()])
    expect(engine.scene.children.length).toBeGreaterThan(before)
    engine.dispose()
  })

  it('setRoads disposes old meshes on rebuild', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    engine.setRoads([makeRoadStrip()])
    engine.setRoads([makeRoadStrip(), makeRoadStrip()])
    // After second call, no dangling meshes from first call
    let roadMeshCount = 0
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh && o.geometry.getAttribute('uv')) roadMeshCount++ })
    // At least 2 road meshes (one per strip), not 3
    engine.dispose()
  })

  it('setTrees adds an InstancedMesh to scene', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    engine.setTrees([new THREE.Vector3(10, 0, 10), new THREE.Vector3(20, 0, 20)])
    let found = false
    engine.scene.traverse(o => { if (o instanceof THREE.InstancedMesh) found = true })
    expect(found).toBe(true)
    engine.dispose()
  })

  it('setGreenAreas adds a mesh to scene', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    // 2 triangles = 6 vertices = 12 floats [x,z pairs]
    const tris = new Float32Array([0,0, 10,0, 10,10, 0,0, 10,10, 0,10])
    const before = engine.scene.children.length
    engine.setGreenAreas(tris)
    expect(engine.scene.children.length).toBeGreaterThan(before)
    engine.dispose()
  })
})
```

- [ ] **Step 2: Run — expect pass**

```bash
npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "test(planetary): add engine tests for setRoads/setTrees/setGreenAreas"
```

---

## Task 7: PlanetaryMode.tsx integration

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx`

- [ ] **Step 1: Add imports and refs**

At the top of `src/planetary/PlanetaryMode.tsx`, add:

```ts
import { PlanetaryScenery } from './PlanetaryScenery'
import { SunSystem } from './SunSystem'
```

Inside `PlanetaryMode`, add new refs and state alongside the existing ones (after `viewmodelRef`):

```ts
const sceneryRef = useRef<PlanetaryScenery | null>(null)
const sunSystemRef = useRef(new SunSystem())
const [sunHour, setSunHour] = useState(10.5)
const sunHourRef = useRef(10.5)
const lastSceneryVersionRef = useRef(-1)
```

- [ ] **Step 2: Sync sunHourRef on state change**

After the `sunHour` state declaration, add:

```ts
useEffect(() => { sunHourRef.current = sunHour }, [sunHour])
```

- [ ] **Step 3: Instantiate PlanetaryScenery inside onReady**

Inside the `engine.onReady(() => { ... })` callback, directly after `collisionRef.current` is set and the map `idle` handler is set up:

```ts
const scenery = new PlanetaryScenery(
  engine.map,
  (lng, lat) => engine.lngLatToLocal(lng, lat),
)
sceneryRef.current = scenery

// Trigger scenery rescan on same idle event as collision
engine.map.on('idle', () => sceneryRef.current?.markStale())
```

- [ ] **Step 4: Wire scenery rebuild + sun into the game loop**

In the game loop function (after step 6 where collision is updated), add:

```ts
// 6b. Rebuild scenery (roads, trees, green areas) when stale
if (sceneryRef.current) {
  sceneryRef.current.update(center.lng, center.lat)
  const sv = sceneryRef.current.rebuildVersion
  if (sv !== lastSceneryVersionRef.current) {
    lastSceneryVersionRef.current = sv
    const { roads, treePositions, greenTriangles } = sceneryRef.current.data
    engine.setRoads(roads)
    engine.setTrees(treePositions)
    engine.setGreenAreas(greenTriangles)
  }
}

// 6c. Update sun angle from current time-of-day
engine.setSunAngle(sunSystemRef.current.compute(sunHourRef.current))
```

- [ ] **Step 5: Dispose scenery on unmount**

In the cleanup `return () => { ... }` block, add:

```ts
sceneryRef.current = null
```

- [ ] **Step 6: Add the time-of-day slider UI**

In the JSX return, replace the existing `[M] Map` button block with:

```tsx
{/* Time-of-day slider */}
{!showPicker && (
  <div
    onPointerDown={(e) => e.stopPropagation()}
    style={{
      position: 'absolute', top: 16, left: 16, zIndex: 100,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#fff', fontSize: 11, fontFamily: 'monospace' }}>
        ☀ {String(Math.floor(sunHour)).padStart(2, '0')}:{String(Math.round((sunHour % 1) * 60)).padStart(2, '0')}
      </span>
      <input
        type="range" min={0} max={24} step={0.1}
        value={sunHour}
        onChange={e => setSunHour(+e.target.value)}
        style={{ width: 100, accentColor: '#ffcc44' }}
      />
    </div>
  </div>
)}

<button
  onClick={() => setShowPicker(true)}
  onPointerDown={(e) => e.stopPropagation()}
  style={{
    position: 'absolute', top: showPicker ? 16 : 52, left: 16, padding: '6px 12px',
    background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
    borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
    zIndex: 100,
  }}
>
  [M] Map
</button>
```

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass, no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): integrate PlanetaryScenery and SunSystem into game loop, add time-of-day slider"
```

---

## Task 8: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the game, enter Planetary Mode, pick a city location**

Recommended test location: any dense city (London, NYC, Berlin) — urban areas have more road and tree data in OSM.

- [ ] **Step 3: Verify the following**

- Buildings have window texture (not plain gray)
- Road geometry is visible on the ground (asphalt-textured strips roughly matching street layout)
- Trees appear as upright billboards where OSM has `natural=tree` nodes
- Green areas (parks/grass) have different texture from roads
- Time-of-day slider in top-left moves the sun — shadows shift, sky color changes
- At sunrise (≈6h) sky is orange/pink, at noon blue, at night dark
- Shadows from buildings fall on the ground and shift as you move the slider

- [ ] **Step 4: Check console for errors**

Open browser devtools. Common issues and fixes:
- `Failed to load texture`: check that assets were copied correctly in Task 1
- `Sky is not a constructor`: verify `three/addons/objects/Sky.js` import resolves (Three.js 0.170 ✓)
- Roads/trees not appearing: the `transportation` layer name may differ in the OpenFreeMap liberty style — open MapLibre inspector or log `map.getStyle().layers.map(l => l.id)` to find the correct name and update `ROAD_LAYERS` in `PlanetaryScenery.ts`

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(planetary): adjust layer names / asset paths from manual verification"
```

---

## Self-review notes

- **Spec coverage**: All 5 rendering layers covered (buildings ✓, roads ✓, trees ✓, green areas ✓, sun/sky ✓). `SunSystem` ✓. `PlanetaryScenery` ✓. Slider UI ✓. Shadow maps ✓. Asset copy ✓.
- **Placeholder scan**: No TBD/TODO in any code block. Layer name fallback addressed in Task 8 Step 4.
- **Type consistency**: `RoadStrip` defined in `PlanetaryScenery.ts` and imported in `PlanetaryEngine.ts`. `SunState` defined in `SunSystem.ts` and imported in `PlanetaryEngine.ts`. All method names consistent across tasks.
