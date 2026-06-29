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
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(3)
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
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(6)
  })

  it('ignores non-road geometry types', () => {
    const pointFeature = { geometry: { type: 'Point', coordinates: [0, 0] }, properties: { class: 'residential' } }
    const map = makeMap([pointFeature])
    const sc = new PlanetaryScenery(map as any, identity)
    const { roads } = sc.update(0, 0)
    expect(roads).toHaveLength(0)
  })
})

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
