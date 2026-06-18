import { describe, it, expect } from 'vitest'
import { DefuseKitModel } from '../DefuseKitModel'

describe('DefuseKitModel', () => {
  it('creates a mesh', () => {
    const model = new DefuseKitModel()
    expect(model.mesh).toBeDefined()
    model.dispose()
  })

  it('disposes cleanly', () => {
    const model = new DefuseKitModel()
    model.dispose()
    expect(model.mesh.parent).toBeNull()
  })
})