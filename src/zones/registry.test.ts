import { describe, it, expect } from 'vitest'
import { ZONES, DEFAULT_ZONE_ID, getZone } from './registry'

describe('zone registry', () => {
  it('provides the six zones in order', () => {
    expect(ZONES.map((z) => z.id)).toEqual(['arid', 'haze', 'ember', 'reactor', 'crossing', 'random'])
  })

  it('defaults to arid', () => {
    expect(DEFAULT_ZONE_ID).toBe('arid')
    expect(getZone().id).toBe('arid')
  })

  it('falls back to the default for unknown or undefined ids', () => {
    expect(getZone('does-not-exist').id).toBe('arid')
    expect(getZone(undefined).id).toBe('arid')
  })

  it('looks up each zone by id', () => {
    for (const z of ZONES) expect(getZone(z.id)).toBe(z)
  })

  describe.each(ZONES)('zone "$id"', (zone) => {
    it('has a name and description', () => {
      expect(zone.name.length).toBeGreaterThan(0)
      expect(zone.description.length).toBeGreaterThan(0)
    })

    it('uses the standard arena size', () => {
      if (zone.id === 'arid' || zone.id === 'random') expect(zone.arenaSize).toBe(50)
      else expect(zone.arenaSize).toBe(30)
    })

    it('has at least one spawn per team', () => {
      expect(zone.ctSpawns.length).toBeGreaterThan(0)
      expect(zone.tSpawns.length).toBeGreaterThan(0)
    })

    it('places CT and T spawns on opposite sides', () => {
      const avg = (pts: [number, number][], axis: 0 | 1) =>
        pts.reduce((s, p) => s + p[axis], 0) / pts.length
      const dx = Math.abs(avg(zone.ctSpawns, 0) - avg(zone.tSpawns, 0))
      const dz = Math.abs(avg(zone.ctSpawns, 1) - avg(zone.tSpawns, 1))
      expect(Math.max(dx, dz)).toBeGreaterThan(10)
    })

    it('defines exactly two bombsites: A and B', () => {
      expect(zone.bombsites.map((b) => b.id).sort()).toEqual(['A', 'B'])
    })

    it('keeps spawns and bombsites inside the arena bounds', () => {
      const within = ([x, z]: [number, number]) =>
        Math.abs(x) < zone.arenaSize && Math.abs(z) < zone.arenaSize
      for (const s of [...zone.ctSpawns, ...zone.tSpawns]) expect(within(s)).toBe(true)
      for (const b of zone.bombsites) expect(within(b.center)).toBe(true)
    })
  })
})
