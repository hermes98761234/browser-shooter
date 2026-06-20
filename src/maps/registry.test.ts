import { describe, it, expect } from 'vitest'
import { MAPS, DEFAULT_MAP_ID, getMap } from './registry'

describe('map registry', () => {
  it('provides the five CS maps in order', () => {
    expect(MAPS.map((m) => m.id)).toEqual(['dust2', 'mirage', 'inferno', 'nuke', 'overpass'])
  })

  it('defaults to dust2', () => {
    expect(DEFAULT_MAP_ID).toBe('dust2')
    expect(getMap().id).toBe('dust2')
  })

  it('falls back to the default for unknown or undefined ids', () => {
    expect(getMap('does-not-exist').id).toBe('dust2')
    expect(getMap(undefined).id).toBe('dust2')
  })

  it('looks up each map by id', () => {
    for (const m of MAPS) expect(getMap(m.id)).toBe(m)
  })

  describe.each(MAPS)('map "$id"', (map) => {
    it('has a name and description', () => {
      expect(map.name.length).toBeGreaterThan(0)
      expect(map.description.length).toBeGreaterThan(0)
    })

    it('uses the standard arena size', () => {
      if (map.id === 'dust2') expect(map.arenaSize).toBe(40)
      else expect(map.arenaSize).toBe(30)
    })

    it('has at least one spawn per team', () => {
      expect(map.ctSpawns.length).toBeGreaterThan(0)
      expect(map.tSpawns.length).toBeGreaterThan(0)
    })

    it('places CT and T spawns on opposite sides', () => {
      const avg = (pts: [number, number][], axis: 0 | 1) =>
        pts.reduce((s, p) => s + p[axis], 0) / pts.length
      // Spawns should be separated along at least one axis.
      const dx = Math.abs(avg(map.ctSpawns, 0) - avg(map.tSpawns, 0))
      const dz = Math.abs(avg(map.ctSpawns, 1) - avg(map.tSpawns, 1))
      expect(Math.max(dx, dz)).toBeGreaterThan(10)
    })

    it('defines exactly two bombsites: A and B', () => {
      expect(map.bombsites.map((b) => b.id).sort()).toEqual(['A', 'B'])
    })

    it('keeps spawns and bombsites inside the arena bounds', () => {
      const within = ([x, z]: [number, number]) =>
        Math.abs(x) < map.arenaSize && Math.abs(z) < map.arenaSize
      for (const s of [...map.ctSpawns, ...map.tSpawns]) expect(within(s)).toBe(true)
      for (const b of map.bombsites) expect(within(b.center)).toBe(true)
    })
  })
})
