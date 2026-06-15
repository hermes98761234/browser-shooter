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
})
