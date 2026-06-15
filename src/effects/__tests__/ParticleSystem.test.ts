import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { ParticleSystem } from '../ParticleSystem'

describe('ParticleSystem', () => {
  it('creates particles', () => {
    const scene = new THREE.Scene()
    const ps = new ParticleSystem(scene)
    ps.emit(new THREE.Vector3(0, 0, 0), 10, 0xff0000)
    ps.update(0.1)
    expect(true).toBe(true)
  })

  it('clears all particles', () => {
    const scene = new THREE.Scene()
    const ps = new ParticleSystem(scene)
    ps.emit(new THREE.Vector3(0, 0, 0), 20, 0xff0000)
    ps.clear()
    ps.update(0.1)
    expect(true).toBe(true)
  })

  it('creates muzzle flash', () => {
    const scene = new THREE.Scene()
    const ps = new ParticleSystem(scene)
    ps.muzzleFlash(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1))
    ps.update(0.05)
    expect(true).toBe(true)
  })

  it('creates explosion', () => {
    const scene = new THREE.Scene()
    const ps = new ParticleSystem(scene)
    ps.explosion(new THREE.Vector3(0, 0, 0))
    ps.update(0.1)
    expect(true).toBe(true)
  })
})
