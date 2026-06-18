import { describe, it, expect } from 'vitest'
import { BombModel } from '../BombModel'
import * as THREE from 'three'

describe('BombModel', () => {
  it('creates a mesh', () => {
    const model = new BombModel()
    expect(model.mesh).toBeDefined()
    model.dispose()
  })

  it('has correct dimensions', () => {
    const model = new BombModel()
    const box = new THREE.Box3().setFromObject(model.mesh)
    expect(box.getSize(new THREE.Vector3()).x).toBeGreaterThan(0)
    model.dispose()
  })

  it('disposes cleanly', () => {
    const model = new BombModel()
    model.dispose()
    expect(model.mesh.parent).toBeNull()
  })
})