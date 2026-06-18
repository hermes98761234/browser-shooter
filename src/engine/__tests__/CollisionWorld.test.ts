import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { CollisionWorld } from '../CollisionWorld'

describe('CollisionWorld', () => {
  it('pushes an overlapping point outside the box', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2))
    const pos = new THREE.Vector3(0.5, 0, 0) // inside the box on XZ
    world.resolve(pos, 0.5)
    const insideX = pos.x > -1 && pos.x < 1
    const insideZ = pos.z > -1 && pos.z < 1
    expect(insideX && insideZ).toBe(false)
  })

  it('leaves a point outside the box unchanged', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2))
    const pos = new THREE.Vector3(5, 0, 5)
    world.resolve(pos, 0.5)
    expect(pos.x).toBeCloseTo(5)
    expect(pos.z).toBeCloseTo(5)
  })

  it('pushes an externally-overlapping circle off the box face', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2))
    const pos = new THREE.Vector3(1.4, 0, 0) // outside the box, but circle overlaps the face
    world.resolve(pos, 0.5)
    expect(pos.x).toBeCloseTo(1.5)
    expect(pos.z).toBeCloseTo(0)
  })

  it('reports a blocking distance when a box is between two points', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(5, 1, 0), new THREE.Vector3(2, 4, 4))
    const from = new THREE.Vector3(0, 1.5, 0)
    const to = new THREE.Vector3(10, 1.5, 0)
    const d = world.segmentBlocked(from, to)
    expect(d).not.toBeNull()
    expect(d!).toBeGreaterThan(0)
    expect(d!).toBeLessThan(10)
  })

  it('returns null when the path is clear', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(5, 1, 20), new THREE.Vector3(2, 4, 4)) // off to the side
    const from = new THREE.Vector3(0, 1.5, 0)
    const to = new THREE.Vector3(10, 1.5, 0)
    expect(world.segmentBlocked(from, to)).toBeNull()
  })

  describe('height-aware resolve', () => {
    it('still blocks when the player body intersects the box', () => {
      const world = new CollisionWorld()
      world.addBox(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(2, 1.2, 2)) // top at 1.2
      const pos = new THREE.Vector3(0.5, 0, 0)
      world.resolve(pos, 0.5, 0) // feet on the floor -> body intersects the wall
      const stillInside = pos.x > -1 && pos.x < 1 && pos.z > -1 && pos.z < 1
      expect(stillInside).toBe(false)
    })

    it('does not push out a player standing on top of the box', () => {
      const world = new CollisionWorld()
      world.addBox(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(2, 1.2, 2)) // top at 1.2
      const pos = new THREE.Vector3(0.5, 0, 0)
      world.resolve(pos, 0.5, 1.2) // feet at the box top
      expect(pos.x).toBeCloseTo(0.5)
      expect(pos.z).toBeCloseTo(0)
    })
  })

  describe('supportHeight', () => {
    it('returns the box top when the player is over it', () => {
      const world = new CollisionWorld()
      world.addBox(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(2, 1.2, 2)) // top at 1.2
      // Falling onto the box: feet just above the top are caught.
      expect(world.supportHeight(new THREE.Vector3(0, 0, 0), 0.5, 1.3)).toBeCloseTo(1.2)
    })

    it('returns the floor when the player is off to the side', () => {
      const world = new CollisionWorld()
      world.addBox(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(2, 1.2, 2))
      expect(world.supportHeight(new THREE.Vector3(5, 0, 5), 0.5, 5)).toBe(0)
    })

    it('does not snap the player up a tall wall far above their feet', () => {
      const world = new CollisionWorld()
      world.addBox(new THREE.Vector3(0, 2.5, 0), new THREE.Vector3(2, 5, 2)) // top at 5
      expect(world.supportHeight(new THREE.Vector3(0, 0, 0), 0.5, 0)).toBe(0)
    })
  })
})
