import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Grenade } from '../Grenade'
import { CollisionWorld } from '../../engine/CollisionWorld'

describe('Grenade', () => {
  it('should create grenade with correct type', () => {
    const grenade = new Grenade('he', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    expect(grenade.type).toBe('he')
    expect(grenade.position.y).toBe(2)
  })

  it('should tick fuse timer', () => {
    const grenade = new Grenade('he', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    expect(grenade.fuseTimer).toBe(2.5)
    grenade.update(0.1)
    expect(grenade.fuseTimer).toBeCloseTo(2.4)
  })

  it('should be expired when fuse reaches zero', () => {
    const grenade = new Grenade('flash', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    grenade.update(2.0)
    expect(grenade.isExpired()).toBe(true)
  })

  it('should apply gravity to velocity', () => {
    const grenade = new Grenade('he', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    const initialVy = grenade.velocity.y
    grenade.update(0.1)
    expect(grenade.velocity.y).toBeLessThan(initialVy)
  })

  it('should bounce off ground', () => {
    const grenade = new Grenade('he', { x: 0, y: 0.5, z: 0 }, { x: 0, y: -5, z: 0 })
    grenade.update(0.2)
    expect(grenade.velocity.y).toBeGreaterThan(0)
    expect(grenade.bounces).toBe(1)
  })

  it('should stop bouncing after max bounces', () => {
    const grenade = new Grenade('he', { x: 0, y: 0.5, z: 0 }, { x: 0, y: -5, z: 0 })
    for (let i = 0; i < 5; i++) {
      grenade.update(0.2)
    }
    expect(grenade.bounces).toBeLessThanOrEqual(3)
  })

  it('reflects horizontal velocity when it hits a wall', () => {
    const world = new CollisionWorld()
    // Thin wall centred at x=1 (spans x 0.5..1.5), tall and deep.
    world.addBox(new THREE.Vector3(1, 2, 0), new THREE.Vector3(1, 4, 10))
    const grenade = new Grenade('he', { x: 0, y: 2, z: 0 }, { x: 10, y: 0, z: 0 })
    grenade.update(0.1, world)
    expect(grenade.velocity.x).toBeLessThan(0)
    expect(grenade.position.x).toBeLessThanOrEqual(0.5)
  })

  it('does not pass through a wall when thrown at it', () => {
    const world = new CollisionWorld()
    // Wall centred at x=3 (spans x 2.5..3.5), tall and deep.
    world.addBox(new THREE.Vector3(3, 2, 0), new THREE.Vector3(1, 4, 10))
    const grenade = new Grenade('he', { x: 0, y: 1, z: 0 }, { x: 12, y: 0, z: 0 })
    for (let i = 0; i < 120; i++) grenade.update(1 / 60, world)
    // Must stay on the near side of the wall instead of tunnelling through.
    expect(grenade.position.x).toBeLessThan(2.5)
  })
})