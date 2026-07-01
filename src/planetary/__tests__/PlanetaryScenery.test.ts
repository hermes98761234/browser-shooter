import { describe, it, expect, vi } from 'vitest'
import { PlanetaryScenery } from '../PlanetaryScenery'
import * as THREE from 'three'

const identity = (lng: number, lat: number): [number, number] => [lng * 111320, -lat * 111320]

function makeMap(features: object[]) {
  return { queryRenderedFeatures: vi.fn(() => features) }
}

const roadFeature = {
  sourceLayer: 'transportation',
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
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(5)
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
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(10)
  })

  it('ignores non-road geometry types', () => {
    const pointFeature = { sourceLayer: 'transportation', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { class: 'residential' } }
    const map = makeMap([pointFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads).toHaveLength(0)
  })

  it('ignores features from unrelated source layers (e.g. building, poi)', () => {
    // Regression: extraction must filter by feature.sourceLayer, not by a
    // style-specific render-layer id passed to queryRenderedFeatures —
    // different MapLibre styles name their render layers differently.
    const unrelated = { sourceLayer: 'building', geometry: { type: 'LineString', coordinates: [[0, 0], [0.001, 0]] }, properties: {} }
    const map = makeMap([unrelated])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads).toHaveLength(0)
  })

  it('dedupes a feature rendered by multiple style layers sharing one source layer (casing + fill)', () => {
    // A single road feature is typically drawn by both a "casing" and a
    // "fill" style layer; queryRenderedFeatures returns it once per match.
    const casing = { id: 'road-1', sourceLayer: 'transportation', geometry: { type: 'LineString', coordinates: [[0, 0], [0.001, 0]] }, properties: { class: 'residential' } }
    const fill = { id: 'road-1', sourceLayer: 'transportation', geometry: { type: 'LineString', coordinates: [[0, 0], [0.001, 0]] }, properties: { class: 'residential' } }
    const map = makeMap([casing, fill])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads).toHaveLength(1)
  })
})

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

const treeFeature = {
  sourceLayer: 'poi',
  geometry: { type: 'Point', coordinates: [0.001, 0.001] },
  properties: { natural: 'tree' },
}

const grassFeature = {
  sourceLayer: 'landuse',
  geometry: {
    type: 'Polygon',
    coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]],
  },
  properties: { class: 'grass' },
}

const waterFeature = {
  sourceLayer: 'water',
  geometry: {
    type: 'Polygon',
    coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]],
  },
  properties: { class: 'lake' },
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
    const nonTree = { sourceLayer: 'poi', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { natural: 'rock' } }
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
      sourceLayer: 'landuse',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0]]] },
      properties: { class: 'industrial' },
    }
    const map = makeMap([industryFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { greenTriangles } = sc.update(0, 0)
    expect(greenTriangles.length).toBe(0)
  })
})

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

const buildingPolygon = {
  sourceLayer: 'building',
  geometry: {
    type: 'Polygon',
    coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]]],
  },
  properties: { render_height: 12 },
}

const makeLayeredMap = makeMap

describe('PlanetaryScenery — buildings', () => {
  it('extracts one BuildingSpec from a Polygon building feature with render_height', () => {
    const map = makeLayeredMap([buildingPolygon])
    const sc = new PlanetaryScenery(map as any, identity)
    const { buildings } = sc.update(0, 0)
    expect(buildings).toHaveLength(1)
    expect(buildings[0].height).toBe(12)
    expect(buildings[0].footprint.length).toBeGreaterThanOrEqual(3)
  })

  it('building footprint coordinates are local XZ numbers', () => {
    const map = makeLayeredMap([buildingPolygon])
    const sc = new PlanetaryScenery(map as any, identity)
    const { buildings } = sc.update(0, 0)
    for (const [x, z] of buildings[0].footprint) {
      expect(typeof x).toBe('number')
      expect(typeof z).toBe('number')
    }
  })

  it('falls back to height 6 when no height tags present', () => {
    const noHeight = {
      sourceLayer: 'building',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]]],
      },
      properties: {},
    }
    const map = makeLayeredMap([noHeight])
    const sc = new PlanetaryScenery(map as any, identity)
    const { buildings } = sc.update(0, 0)
    expect(buildings).toHaveLength(1)
    expect(buildings[0].height).toBe(6)
  })

  it('uses building:levels * 3 when render_height and height are absent', () => {
    const levelsFeature = {
      sourceLayer: 'building',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]]],
      },
      properties: { 'building:levels': 4 },
    }
    const map = makeLayeredMap([levelsFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { buildings } = sc.update(0, 0)
    expect(buildings[0].height).toBe(12)
  })

  it('skips rings with fewer than 3 points', () => {
    const tinyRing = {
      sourceLayer: 'building',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [0.001, 0]]],
      },
      properties: { render_height: 10 },
    }
    const map = makeLayeredMap([tinyRing])
    const sc = new PlanetaryScenery(map as any, identity)
    const { buildings } = sc.update(0, 0)
    expect(buildings).toHaveLength(0)
  })

  it('extracts roofShape from roof:shape tag, defaulting to flat', () => {
    const map = makeLayeredMap([buildingPolygon])
    const sc = new PlanetaryScenery(map as any, identity)
    const { buildings } = sc.update(0, 0)
    expect(buildings[0].roofShape).toBe('flat')
  })

  it('initial _data has empty buildings array', () => {
    const map = makeLayeredMap([])
    const sc = new PlanetaryScenery(map as any, identity)
    expect(sc.data.buildings).toEqual([])
  })

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
})
