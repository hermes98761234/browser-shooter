import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { raycastPlayerCapsule, zoneForHeight } from './PlayerHit'

describe('zoneForHeight', () => {
  it('maps height to zone', () => {
    expect(zoneForHeight(1.9)).toBe('head')
    expect(zoneForHeight(1.2)).toBe('body')
    expect(zoneForHeight(0.4)).toBe('legs')
  })
})

describe('raycastPlayerCapsule', () => {
  const eye = new THREE.Vector3(0, 2, -10) // target standing at x0,z-10

  it('hits a target dead ahead and reports body zone', () => {
    const origin = new THREE.Vector3(0, 1.2, 0)
    const dir = new THREE.Vector3(0, 0, -1)
    const hit = raycastPlayerCapsule(origin, dir, 50, eye)
    expect(hit).not.toBeNull()
    expect(hit!.zone).toBe('body')
    expect(hit!.distance).toBeGreaterThan(9)
    expect(hit!.distance).toBeLessThan(11)
  })

  it('misses when aimed wide', () => {
    const origin = new THREE.Vector3(0, 1.2, 0)
    const dir = new THREE.Vector3(1, 0, 0) // perpendicular, away from target
    expect(raycastPlayerCapsule(origin, dir, 50, eye)).toBeNull()
  })

  it('misses when the target is beyond range', () => {
    const origin = new THREE.Vector3(0, 1.2, 0)
    const dir = new THREE.Vector3(0, 0, -1)
    expect(raycastPlayerCapsule(origin, dir, 5, eye)).toBeNull()
  })
})
