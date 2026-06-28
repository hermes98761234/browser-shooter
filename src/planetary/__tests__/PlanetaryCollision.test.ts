import { describe, it, expect, vi } from 'vitest'
import { PlanetaryCollision } from '../PlanetaryCollision'

function makeMap(features: object[]) {
  return { queryRenderedFeatures: vi.fn(() => features) }
}

const squareBuilding = {
  geometry: {
    type: 'Polygon',
    coordinates: [[[0, 0], [0.0001, 0], [0.0001, 0.0001], [0, 0.0001], [0, 0]]],
  },
  properties: { height: 20 },
}

describe('PlanetaryCollision', () => {
  it('builds boxes from polygon buildings', () => {
    const map = makeMap([squareBuilding])
    const pc = new PlanetaryCollision(map as any)
    const world = pc.update(0, 0)
    expect(world.boxes.length).toBeGreaterThan(0)
  })

  it('skips re-scan if moved < 50m', () => {
    const map = makeMap([squareBuilding])
    const pc = new PlanetaryCollision(map as any)
    pc.update(0, 0)
    pc.update(0.0001, 0.0001)  // ~15m
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(1)
  })

  it('re-scans after moving > 50m', () => {
    const map = makeMap([squareBuilding])
    const pc = new PlanetaryCollision(map as any)
    pc.update(0, 0)
    pc.update(0, 0.001)  // ~111m
    expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(2)
  })

  it('ignores features with no polygon geometry', () => {
    const map = makeMap([{ geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }])
    const pc = new PlanetaryCollision(map as any)
    const world = pc.update(0, 0)
    expect(world.boxes.length).toBe(0)
  })

  it('bumps rebuildVersion only when it actually re-scans', () => {
    const map = makeMap([squareBuilding])
    const pc = new PlanetaryCollision(map as any)
    pc.update(0, 0)
    const v1 = pc.rebuildVersion
    pc.update(0.0001, 0.0001) // ~15m, no re-scan
    expect(pc.rebuildVersion).toBe(v1)
    pc.update(0, 0.001) // ~111m, re-scan
    expect(pc.rebuildVersion).toBe(v1 + 1)
  })

  it('places boxes in the injected origin frame regardless of scan center', () => {
    const map = makeMap([squareBuilding])
    // Origin-relative converter: meters east/south of lng/lat (0,0).
    const MPD = 111320
    const toLocal = (lng: number, lat: number): [number, number] => [
      lng * MPD * Math.cos(0),
      -lat * MPD,
    ]
    const pc = new PlanetaryCollision(map as any, toLocal)

    pc.update(0, 0)
    const first = pc.collisionWorld.boxes[0]

    // Force a re-scan from a far-away center (> 50 m): same building, same world coords.
    pc.update(0, 0.001)
    const second = pc.collisionWorld.boxes[0]

    expect(second.min.x).toBeCloseTo(first.min.x, 5)
    expect(second.min.z).toBeCloseTo(first.min.z, 5)
    expect(second.max.x).toBeCloseTo(first.max.x, 5)
  })
})
