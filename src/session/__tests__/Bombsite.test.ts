import { describe, it, expect } from 'vitest'
import { Bombsite } from '../Bombsite'

describe('Bombsite', () => {
  it('creates with id and center', () => {
    const site = new Bombsite('A', { x: 0, y: 0, z: -20 })
    expect(site.id).toBe('A')
    expect(site.center).toEqual({ x: 0, y: 0, z: -20 })
  })

  it('detects point inside zone', () => {
    const site = new Bombsite('A', { x: 0, y: 0, z: -20 })
    expect(site.isInside({ x: 0, y: 0, z: -20 })).toBe(true)
    expect(site.isInside({ x: 1, y: 0, z: -20 })).toBe(true)
    expect(site.isInside({ x: 3, y: 0, z: -20 })).toBe(false)
  })

  it('detects point outside zone', () => {
    const site = new Bombsite('A', { x: 0, y: 0, z: -20 })
    expect(site.isInside({ x: 10, y: 0, z: 10 })).toBe(false)
  })
})
