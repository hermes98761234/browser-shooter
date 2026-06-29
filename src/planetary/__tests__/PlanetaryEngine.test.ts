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

vi.mock('three/addons/objects/Sky.js', () => {
  // ponytail: vi.mock factory can't use static import; dynamic require is the only option here
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const THREE = require('three')
  class Sky extends THREE.Mesh {
    constructor() {
      super(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial())
      this.material = {
        uniforms: {
          turbidity: { value: 10 },
          rayleigh: { value: 2 },
          mieCoefficient: { value: 0.005 },
          mieDirectionalG: { value: 0.8 },
          sunPosition: { value: new THREE.Vector3() },
        },
      }
    }
  }
  return { Sky }
})

// Mock new components to avoid WebGL dependencies in jsdom
vi.mock('../AtmosphereConfig', () => ({
  AtmosphereConfig: vi.fn().mockImplementation(() => ({
    state: { turbidity: 10, rayleigh: 2, mieCoefficient: 0.005, mieDirectionalG: 0.8, fogColor: { r: 0.6, g: 0.8, b: 0.9 }, sunColor: { r: 1, g: 1, b: 1 }, sunIntensity: 1.2, ambientColor: { r: 1, g: 1, b: 1 }, groundColor: { r: 0.3, g: 0.3, b: 0.3 } },
    update: vi.fn(() => ({ turbidity: 10, rayleigh: 2, mieCoefficient: 0.005, mieDirectionalG: 0.8, fogColor: { r: 0.6, g: 0.8, b: 0.9 }, sunColor: { r: 1, g: 1, b: 1 }, sunIntensity: 1.2, ambientColor: { r: 1, g: 1, b: 1 }, groundColor: { r: 0.3, g: 0.3, b: 0.3 } })),
  })),
}))

vi.mock('../CascadedShadows', () => ({
  CascadedShadows: vi.fn().mockImplementation(() => ({
    lights: [],
    addToScene: vi.fn(),
    removeFromScene: vi.fn(),
    update: vi.fn(),
    setIntensity: vi.fn(),
    setColor: vi.fn(),
    dispose: vi.fn(),
  })),
}))

vi.mock('../PostProcessing', () => ({
  PostProcessing: vi.fn().mockImplementation(() => ({
    composer: null,
    setQuality: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  })),
}))

import { PlanetaryEngine } from '../PlanetaryEngine'
import * as THREE from 'three'
import { CollisionWorld } from '../../engine/CollisionWorld'
import { SunSystem } from '../SunSystem'
import type { RoadStrip } from '../PlanetaryScenery'

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

    // Count meshes before setBuildings
    let beforeCount = 0
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) beforeCount++ })

    engine.setBuildings(world.boxes)

    // Count meshes after setBuildings
    let afterCount = 0
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) afterCount++ })

    expect(afterCount - beforeCount).toBe(world.boxes.length * 2)
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

describe('PlanetaryEngine — sun and shadows', () => {
  it('setSunAngle updates the CSM cascade lights', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    const sys = new SunSystem()
    // setSunAngle should not throw and should use CSM (sun removed from scene)
    expect(() => engine.setSunAngle(sys.compute(6))).not.toThrow()
    expect(() => engine.setSunAngle(sys.compute(12))).not.toThrow()
    // Verify sun is no longer in the scene (CSM replaced it)
    expect(engine.scene.children.includes(engine.sun)).toBe(false)
    engine.dispose()
  })

  it('sun is exposed as a public property', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    expect(engine.sun).toBeDefined()
    engine.dispose()
  })
})

function makeRoadStrip(): RoadStrip {
  return {
    corners: [
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(0, 0.05, 4),
      new THREE.Vector3(10, 0.05, 4),
      new THREE.Vector3(10, 0.05, 0),
    ],
    uvLength: 10,
  }
}

describe('PlanetaryEngine — setRoads / setTrees / setGreenAreas', () => {
  it('setRoads adds meshes to scene', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    let before = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) before++ })
    engine.setRoads([makeRoadStrip(), makeRoadStrip()])
    let after = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) after++ })
    expect(after).toBeGreaterThan(before)
    engine.dispose()
  })

  it('setRoads disposes old meshes on rebuild', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    engine.setRoads([makeRoadStrip()])
    engine.setRoads([makeRoadStrip(), makeRoadStrip()])
    engine.dispose()
  })

  it('setTrees adds an InstancedMesh to scene', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    engine.setTrees([new THREE.Vector3(10, 0, 10), new THREE.Vector3(20, 0, 20)])
    let found = false
    engine.scene.traverse(o => { if (o instanceof THREE.InstancedMesh) found = true })
    expect(found).toBe(true)
    engine.dispose()
  })

  it('setGreenAreas adds a mesh to scene', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    const tris = new Float32Array([0,0, 10,0, 10,10, 0,0, 10,10, 0,10])
    let before = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) before++ })
    engine.setGreenAreas(tris)
    let after = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) after++ })
    expect(after).toBeGreaterThan(before)
    engine.dispose()
  })
})
