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
})
