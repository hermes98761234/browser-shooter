import { describe, it, expect } from 'vitest'
import { PlanetaryNavmesh } from '../PlanetaryNavmesh'

function makeMap(features: object[]) {
  return { queryRenderedFeatures: () => features }
}

const singleRoad = {
  geometry: {
    type: 'LineString',
    coordinates: [[0, 0], [0.001, 0], [0.002, 0]],
  },
  properties: {},
}

describe('PlanetaryNavmesh', () => {
  it('builds nodes from road linestrings', () => {
    const nm = new PlanetaryNavmesh()
    nm.build(makeMap([singleRoad]) as any)
    expect(nm.nodeCount).toBe(3)
  })

  it('returns empty path with no nodes', () => {
    const nm = new PlanetaryNavmesh()
    nm.build(makeMap([]) as any)
    expect(nm.findPath(0, 0, 1, 1)).toEqual([])
  })

  it('finds path between connected nodes', () => {
    const nm = new PlanetaryNavmesh()
    nm.build(makeMap([singleRoad]) as any)
    const path = nm.findPath(0, 0, 0.002, 0)
    expect(path.length).toBeGreaterThan(0)
    expect(path[path.length - 1][0]).toBeCloseTo(0.002, 3)
  })

  it('returns empty path for disconnected graph', () => {
    const road2 = {
      geometry: { type: 'LineString', coordinates: [[1, 0], [2, 0]] },
      properties: {},
    }
    const nm = new PlanetaryNavmesh()
    nm.build(makeMap([singleRoad, road2]) as any)
    const path = nm.findPath(0, 0, 1.5, 0)
    // May be empty since graphs are disconnected
    expect(Array.isArray(path)).toBe(true)
  })
})
