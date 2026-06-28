import { describe, it, expect, vi } from 'vitest'

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
import { CollisionWorld } from '../../engine/CollisionWorld'

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

  it('builds building meshes from collision boxes', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(5, 10, 5), new THREE.Vector3(4, 20, 4))
    engine.setBuildings(world.boxes)
    let meshCount = 0
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) meshCount++ })
    expect(meshCount).toBeGreaterThan(0)
    engine.dispose()
  })

  it('places the camera at the player eye position and faces yaw/pitch', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setViewFromPlayer(new THREE.Vector3(3, 2, -7), Math.PI / 2, 0.1)
    expect(engine.camera.position.x).toBeCloseTo(3)
    expect(engine.camera.position.y).toBeCloseTo(2)
    expect(engine.camera.position.z).toBeCloseTo(-7)
    expect(engine.camera.rotation.y).toBeCloseTo(Math.PI / 2)
    expect(engine.camera.rotation.x).toBeCloseTo(0.1)
    engine.dispose()
  })
})
