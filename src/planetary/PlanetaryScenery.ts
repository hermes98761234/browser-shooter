import * as THREE from 'three'
import type maplibregl from 'maplibre-gl'
import { lngLatDistance } from './geoUtils'
import type { BuildingSpec } from './BuildingGeometry'

const RESCAN_METERS = 50
const ROAD_LAYERS = ['transportation']
const TREE_LAYERS = ['poi']
const GREEN_LAYERS = ['landuse', 'landcover', 'park']
const BUILDING_LAYERS = ['building']

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
  buildings: BuildingSpec[]
}

export class PlanetaryScenery {
  private lastLng = NaN
  private lastLat = NaN
  private _rebuildVersion = 0
  private _data: SceneryData = { roads: [], treePositions: [], greenTriangles: new Float32Array(0), buildings: [] }

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
      buildings: this.extractBuildings(),
    }
    return this._data
  }

  private extractRoads(): RoadStrip[] {
    const strips: RoadStrip[] = []
    const features = this.map.queryRenderedFeatures(undefined, { layers: ROAD_LAYERS })
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
    const positions: THREE.Vector3[] = []
    const features = this.map.queryRenderedFeatures(undefined, { layers: TREE_LAYERS })
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

  private extractGreenAreas(): Float32Array {
    const GREEN_CLASSES = new Set(['grass', 'park', 'wood', 'forest', 'farmland', 'scrub', 'meadow', 'vegetation'])
    const verts: number[] = []
    const features = this.map.queryRenderedFeatures(undefined, { layers: GREEN_LAYERS })
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

  private extractBuildings(): BuildingSpec[] {
    const specs: BuildingSpec[] = []
    const features = this.map.queryRenderedFeatures(undefined, { layers: BUILDING_LAYERS })
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
      for (const ring of rings) {
        if (ring.length < 3) continue
        const footprint: [number, number][] = ring.map(([lng, lat]) => this.toLocal(lng, lat))
        specs.push({ footprint, height, minHeight, roofShape })
      }
    }
    return specs
  }
}
