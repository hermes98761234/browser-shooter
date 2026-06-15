import { describe, it, expect } from 'vitest'
import { Physics } from '../Physics'
import * as THREE from 'three'

describe('Physics', () => {
  it('detects no collision when inside arena', () => {
    const physics = new Physics(28)
    const pos = new THREE.Vector3(0, 2, 0)
    const result = physics.checkWallCollision(pos)
    expect(result.collided).toBe(false)
  })

  it('detects collision with positive X wall', () => {
    const physics = new Physics(28)
    const pos = new THREE.Vector3(30, 2, 0)
    const result = physics.checkWallCollision(pos)
    expect(result.collided).toBe(true)
    expect(result.normal.x).toBeLessThan(0)
  })

  it('detects collision with negative X wall', () => {
    const physics = new Physics(28)
    const pos = new THREE.Vector3(-30, 2, 0)
    const result = physics.checkWallCollision(pos)
    expect(result.collided).toBe(true)
    expect(result.normal.x).toBeGreaterThan(0)
  })

  it('detects collision with positive Z wall', () => {
    const physics = new Physics(28)
    const pos = new THREE.Vector3(0, 2, 30)
    const result = physics.checkWallCollision(pos)
    expect(result.collided).toBe(true)
    expect(result.normal.z).toBeLessThan(0)
  })

  it('detects collision with negative Z wall', () => {
    const physics = new Physics(28)
    const pos = new THREE.Vector3(0, 2, -30)
    const result = physics.checkWallCollision(pos)
    expect(result.collided).toBe(true)
    expect(result.normal.z).toBeGreaterThan(0)
  })

  it('resolves collision by pushing position back', () => {
    const physics = new Physics(28)
    const pos = new THREE.Vector3(30, 2, 0)
    const resolved = physics.resolveCollision(pos)
    expect(resolved).toBe(true)
    expect(pos.x).toBeLessThanOrEqual(28 - physics.playerRadius)
  })

  it('clampToArena keeps position within bounds', () => {
    const physics = new Physics(28)
    const pos = new THREE.Vector3(50, 2, 50)
    physics.clampToArena(pos)
    expect(pos.x).toBeLessThanOrEqual(28)
    expect(pos.z).toBeLessThanOrEqual(28)
    expect(pos.x).toBeGreaterThanOrEqual(-28)
    expect(pos.z).toBeGreaterThanOrEqual(-28)
  })

  it('raycastWalls returns distance to wall', () => {
    const physics = new Physics(28)
    const origin = new THREE.Vector3(0, 2, 0)
    const dir = new THREE.Vector3(1, 0, 0)
    const dist = physics.raycastWalls(origin, dir)
    expect(dist).toBeCloseTo(28)
  })

  it('raycastWalls returns -1 for parallel ray', () => {
    const physics = new Physics(28)
    const origin = new THREE.Vector3(0, 2, 0)
    const dir = new THREE.Vector3(0, 0, 1)
    const dist = physics.raycastWalls(origin, dir, 100)
    expect(dist).toBeCloseTo(28)
  })

  it('raycastWalls returns -1 when ray points away from wall', () => {
    const physics = new Physics(28)
    const origin = new THREE.Vector3(0, 2, 0)
    const dir = new THREE.Vector3(-1, 0, 0)
    const dist = physics.raycastWalls(origin, dir, 5)
    // Should hit the negative X wall at distance 28, but maxDist is 5
    expect(dist).toBe(-1)
  })
})
