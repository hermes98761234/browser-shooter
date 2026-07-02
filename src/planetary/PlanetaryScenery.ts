import * as THREE from 'three'
import type maplibregl from 'maplibre-gl'
import type { MapGeoJSONFeature } from 'maplibre-gl'
import { lngLatDistance } from './geoUtils'
import type { BuildingSpec } from './BuildingGeometry'

const RESCAN_METERS = 50
// OpenMapTiles vector-tile *source* layer names. Different MapLibre styles
// (liberty, positron, bright, ...) split these into many differently-named
// *render* layers (e.g. road_motorway, road_minor, poi_r7), so we can't
// filter queryRenderedFeatures by style layer id — we query everything
// rendered and filter by the feature's underlying source layer instead.
const ROAD_SOURCE_LAYER = 'transportation'
const TREE_SOURCE_LAYER = 'poi'
const GREEN_SOURCE_LAYERS = new Set(['landuse', 'landcover', 'park'])
const WATER_SOURCE_LAYER = 'water'
const WATERWAY_SOURCE_LAYER = 'waterway'
const BUILDING_SOURCE_LAYER = 'building'

const ROAD_HALF_WIDTHS: Record<string, number> = {
  motorway: 8, trunk: 8,
  primary: 6, secondary: 6,
  tertiary: 4, residential: 4, service: 4, minor: 4,
  path: 2, footway: 2, cycleway: 2,
  track: 1.5, pedestrian: 1.5, steps: 1,
}
const DEFAULT_HALF_WIDTH = 3
const SIDEWALK_HALF_WIDTH = 0.75  // 1.5 m sidewalks, streets-gl look

const PATH_CLASSES = new Set(['pedestrian', 'path', 'footway', 'cycleway', 'steps', 'bridleway', 'track'])
const RAIL_CLASSES = new Set(['rail', 'transit', 'tram', 'subway', 'light_rail', 'narrow_gauge', 'funicular', 'monorail'])
// Water/air transport lines must not paint roads on the ground.
const SKIP_ROAD_CLASSES = new Set(['ferry', 'aerialway', 'cable_car'])

const WATERWAY_HALF_WIDTHS: Record<string, number> = {
  river: 6, canal: 4, stream: 1.5, ditch: 1, drain: 1,
}

// Trees scattered procedurally inside wood/forest polygons (the POI layer only
// carries individually-mapped trees, which leaves forests as bare green fields).
const FOREST_CLASSES = new Set(['wood', 'forest'])
const FOREST_TREE_STEP = 18       // scatter grid spacing (m)
const FOREST_TREE_CAP = 400       // hard cap — tree billboarding is O(n) per frame

const HOUSE_BUILDING_TAGS = new Set(['house', 'detached', 'semidetached_house', 'bungalow', 'cabin', 'farm'])

const LABEL_SOURCE_LAYERS = new Set(['poi', 'place'])
const LABEL_CAP = 40  // nearest named features get floating labels

const LAMP_STEP = 35        // one street lamp per ~35 m of car road
const LAMP_CAP = 200
const BENCH_STEP = 50       // one bench per ~50 m of footpath
const BENCH_CAP = 80

export interface BenchSpec {
  x: number
  z: number
  yaw: number  // rotation.y aligning the bench's long axis with the path
}

export interface RoadStrip {
  // quad corners in local XZ (Y=0.05 to sit above ground)
  corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
  uvLength: number  // segment length in meters, for UV tiling
  kind?: 'road' | 'path' | 'rail' | 'waterway'  // undefined treated as 'road'
}

export interface LabelSpec {
  text: string
  x: number
  z: number
}

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

export class PlanetaryScenery {
  private lastLng = NaN
  private lastLat = NaN
  private _rebuildVersion = 0
  private _data: SceneryData = { roads: [], treePositions: [], greenTriangles: new Float32Array(0), waterTriangles: new Float32Array(0), buildings: [], labels: [], lampPositions: [], benches: [] }

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

  // A source feature can be drawn by several style render-layers (e.g. a
  // road's casing + fill), so an unfiltered query returns it once per
  // matching render layer. Dedupe by feature id, falling back to its first
  // coordinate when the tile doesn't carry one.
  private queryBySourceLayer(sourceLayers: Set<string> | string): MapGeoJSONFeature[] {
    const matches = typeof sourceLayers === 'string'
      ? (sl: string | undefined) => sl === sourceLayers
      : (sl: string | undefined) => !!sl && sourceLayers.has(sl)
    const seen = new Set<string | number>()
    const out: MapGeoJSONFeature[] = []
    for (const f of this.map.queryRenderedFeatures(undefined)) {
      if (!matches(f.sourceLayer)) continue
      const coords = (f.geometry as { coordinates?: unknown[] }).coordinates
      const key = f.id ?? `${f.sourceLayer}:${JSON.stringify(coords?.[0] ?? coords)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(f)
    }
    return out
  }

  update(lng: number, lat: number): SceneryData {
    if (
      !isNaN(this.lastLng) &&
      lngLatDistance(lng, lat, this.lastLng, this.lastLat) < RESCAN_METERS
    ) return this._data

    this.lastLng = lng
    this.lastLat = lat
    this._rebuildVersion += 1
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
    return this._data
  }

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

  private extractWaterways(): RoadStrip[] {
    const strips: RoadStrip[] = []
    for (const f of this.queryBySourceLayer(WATERWAY_SOURCE_LAYER)) {
      if (f.properties?.brunnel === 'tunnel') continue
      const cls = (f.properties?.class ?? 'stream') as string
      // Slightly below roads so bridges/crossings resolve in the road's favour.
      this.stripsFromFeature(f, WATERWAY_HALF_WIDTHS[cls] ?? 1.5, 'waterway', 0.04, strips)
    }
    return strips
  }

  private extractTrees(): THREE.Vector3[] {
    const positions: THREE.Vector3[] = []
    const features = this.queryBySourceLayer(TREE_SOURCE_LAYER)
    for (const f of features) {
      if (f.geometry.type !== 'Point') continue
      const nat = f.properties?.natural ?? f.properties?.subclass ?? f.properties?.type
      if (nat !== 'tree') continue
      const coords = f.geometry.coordinates as [number, number]
      const [x, z] = this.toLocal(coords[0], coords[1])
      positions.push(new THREE.Vector3(x, 0, z))
    }
    return positions
  }

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

  private extractGreenAreas(): { triangles: Float32Array; forestTrees: THREE.Vector3[] } {
    const GREEN_CLASSES = new Set(['grass', 'park', 'wood', 'forest', 'farmland', 'scrub', 'meadow', 'vegetation'])
    const verts: number[] = []
    const forestTrees: THREE.Vector3[] = []
    const features = this.queryBySourceLayer(GREEN_SOURCE_LAYERS)
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
        if (FOREST_CLASSES.has(cls)) this.scatterForestTrees(local, forestTrees)
      }
    }
    return { triangles: new Float32Array(verts), forestTrees }
  }

  /** Deterministic grid scatter of tree positions inside a forest polygon. */
  private scatterForestTrees(poly: [number, number][], out: THREE.Vector3[]): void {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const [x, z] of poly) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
    for (let gx = Math.ceil(minX / FOREST_TREE_STEP); gx * FOREST_TREE_STEP < maxX; gx++) {
      for (let gz = Math.ceil(minZ / FOREST_TREE_STEP); gz * FOREST_TREE_STEP < maxZ; gz++) {
        if (out.length >= FOREST_TREE_CAP) return
        // Hash-based jitter keyed on the grid cell so rebuilds don't reshuffle trees.
        const h = Math.sin(gx * 127.1 + gz * 311.7) * 43758.5453
        const j1 = h - Math.floor(h)
        const j2 = (h * 1.618) - Math.floor(h * 1.618)
        const x = gx * FOREST_TREE_STEP + (j1 - 0.5) * FOREST_TREE_STEP * 0.8
        const z = gz * FOREST_TREE_STEP + (j2 - 0.5) * FOREST_TREE_STEP * 0.8
        if (this.pointInPolygon(x, z, poly)) out.push(new THREE.Vector3(x, 0, z))
      }
    }
  }

  private pointInPolygon(x: number, z: number, poly: [number, number][]): boolean {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i]
      const [xj, zj] = poly[j]
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
    }
    return inside
  }

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

  private extractBuildings(): BuildingSpec[] {
    const specs: BuildingSpec[] = []
    const features = this.queryBySourceLayer(BUILDING_SOURCE_LAYER)
    for (const f of features) {
      const rings: [number, number][][] =
        f.geometry.type === 'Polygon'
          ? [f.geometry.coordinates[0] as [number, number][]]
          : f.geometry.type === 'MultiPolygon'
          ? (f.geometry.coordinates as [number, number][][][]).map(p => p[0])
          : []
      const props = f.properties ?? {}
      const rawHeight =
        props.render_height != null ? Number(props.render_height)
        : props.height != null ? Number(props.height)
        : props['building:levels'] != null ? Number(props['building:levels']) * 3
        : NaN
      const height = (isFinite(rawHeight) && rawHeight > 0) ? rawHeight : 6
      const rawMin = Number(props.render_min_height ?? 0) || 0
      // Guard malformed data: a min_height at/above the top would give negative
      // wall height (inverted walls). Treat as ground-level.
      const minHeight = rawMin < height ? rawMin : 0
      const roofShape = String(props['roof:shape'] ?? 'flat')
      const buildingType: 'house' | 'other' = HOUSE_BUILDING_TAGS.has(String(props.building ?? '')) ? 'house' : 'other'
      for (const ring of rings) {
        if (ring.length < 3) continue
        const footprint: [number, number][] = ring.map(([lng, lat]) => this.toLocal(lng, lat))
        specs.push({ footprint, height, minHeight, roofShape, buildingType })
      }
    }
    return specs
  }
}
