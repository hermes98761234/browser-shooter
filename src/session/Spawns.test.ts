import { describe, it, expect } from 'vitest'
import { pickSpawn } from './Spawns'
import { getZone } from '../zones/registry'

const arid = getZone('arid')

describe('pickSpawn', () => {
  it('returns distinct spawn regions per team at eye height', () => {
    const ct = pickSpawn('ct', arid, 0)
    const t = pickSpawn('t', arid, 0)
    expect(ct.y).toBe(2)
    expect(t.y).toBe(2)
    // teams spawn on opposite sides (Dust2 separates T south / CT north along z)
    expect(Math.sign(ct.z)).not.toBe(Math.sign(t.z))
  })

  it('cycles through a team\'s spawn list by index', () => {
    const a = pickSpawn('ct', arid, 0)
    const b = pickSpawn('ct', arid, 1)
    expect(a.equals(b)).toBe(false)
  })

  it('picks a random spawn when no index is provided', () => {
    const spawns = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const pos = pickSpawn('ct', arid)
      spawns.add(`${pos.x},${pos.z}`)
    }
    // With 4 spawn points and 20 tries, we should get at least 2 distinct positions
    expect(spawns.size).toBeGreaterThanOrEqual(2)
  })

  it('defaults to the default zone when none is given', () => {
    const pos = pickSpawn('ct', undefined, 0)
    expect(pos.y).toBe(2)
  })

  it('honors each zone\'s own spawn points', () => {
    const haze = getZone('haze')
    const pos = pickSpawn('ct', haze, 0)
    expect([pos.x, pos.z]).toEqual([haze.ctSpawns[0][0], haze.ctSpawns[0][1]])
  })
})
