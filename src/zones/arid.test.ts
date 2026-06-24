import { describe, it, expect } from 'vitest'
import { ARID } from './arid'
import type { ZoneStructure } from './ZoneDef'

function obstructs(s: ZoneStructure, x: number, z: number): boolean {
  const [cx, cy, cz] = s.center
  const [w, h, d] = s.size
  const yMin = cy - h / 2
  const yMax = cy + h / 2
  const tall = yMin < 2 && yMax > 2.5
  const insideXZ = Math.abs(x - cx) < w / 2 && Math.abs(z - cz) < d / 2
  return tall && insideXZ
}

describe('ARID zone', () => {
  const size = ARID.arenaSize

  it('keeps every structure inside the arena bounds', () => {
    for (const s of ARID.structures) {
      for (const axis of [0, 2] as const) {
        const max = Math.abs(s.center[axis]) + s.size[axis] / 2
        expect(max, `structure at ${s.center} exceeds bounds`).toBeLessThanOrEqual(size)
      }
    }
  })

  it('has exactly bombsites A and B inside bounds and clear of walls', () => {
    expect(ARID.bombsites.map((b) => b.id).sort()).toEqual(['A', 'B'])
    for (const b of ARID.bombsites) {
      const [x, z] = b.center
      expect(Math.abs(x)).toBeLessThanOrEqual(size)
      expect(Math.abs(z)).toBeLessThanOrEqual(size)
      const blocker = ARID.structures.find((s) => obstructs(s, x, z))
      expect(blocker, `bombsite ${b.id} is embedded in ${blocker?.material} at ${blocker?.center}`).toBeUndefined()
    }
  })

  it('places all spawns inside bounds and clear of walls', () => {
    const spawns = [...ARID.ctSpawns, ...ARID.tSpawns]
    expect(ARID.ctSpawns.length).toBeGreaterThan(0)
    expect(ARID.tSpawns.length).toBeGreaterThan(0)
    for (const [x, z] of spawns) {
      expect(Math.abs(x)).toBeLessThanOrEqual(size)
      expect(Math.abs(z)).toBeLessThanOrEqual(size)
      const blocker = ARID.structures.find((s) => obstructs(s, x, z))
      expect(blocker, `spawn ${[x, z]} is embedded in ${blocker?.material} at ${blocker?.center}`).toBeUndefined()
    }
  })

  it('separates T spawn (south) from CT spawn (north)', () => {
    const avg = (pts: [number, number][]) => pts.reduce((a, p) => a + p[1], 0) / pts.length
    expect(avg(ARID.tSpawns)).toBeGreaterThan(avg(ARID.ctSpawns))
  })
})
