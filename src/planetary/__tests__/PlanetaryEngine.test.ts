import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock maplibre-gl before importing PlanetaryEngine
vi.mock('maplibre-gl', () => {
  const listeners: Record<string, (() => void)[]> = {}
  const MockMap = vi.fn().mockImplementation(() => ({
    on: vi.fn((event: string, cb: () => void) => {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
    }),
    addLayer: vi.fn(),
    getCanvas: vi.fn(() => document.createElement('canvas')),
    remove: vi.fn(),
    _triggerLoad: () => listeners['load']?.forEach(cb => cb()),
  }))
  return { default: { Map: MockMap } }
})

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import { PlanetaryEngine } from '../PlanetaryEngine'
import * as THREE from 'three'

describe('PlanetaryEngine', () => {
  it('creates scene and camera', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    expect(engine.scene).toBeInstanceOf(THREE.Scene)
    expect(engine.camera).toBeInstanceOf(THREE.Camera)
    engine.dispose()
  })

  it('calls onReady after map load', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    const cb = vi.fn()
    engine.onReady(cb)
    ;(engine.map as any)._triggerLoad()
    expect(cb).toHaveBeenCalled()
    engine.dispose()
  })
})
