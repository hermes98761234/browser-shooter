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

import { PlanetaryEngine } from '../PlanetaryEngine'
import * as THREE from 'three'
import { SunSystem } from '../SunSystem'
import type { RoadStrip } from '../PlanetaryScenery'
import type { BuildingSpec } from '../BuildingGeometry'

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

  it('builds building meshes from footprint specs', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)

    const specs: BuildingSpec[] = [
      { footprint: [[0,0],[8,0],[8,8],[0,8]], height: 12, roofShape: 'flat' },
      { footprint: [[20,0],[28,0],[28,8],[20,8]], height: 12, roofShape: 'flat' },
    ]

    // Count meshes before setBuildings
    let beforeCount = 0
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) beforeCount++ })

    engine.setBuildings(specs)

    // Count meshes after setBuildings — each spec produces one multi-material mesh
    let afterCount = 0
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) afterCount++ })

    expect(afterCount - beforeCount).toBe(specs.length)
    engine.dispose()
  })

  it('culls buildings beyond the fog-far distance', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setViewFromPlayer(new THREE.Vector3(0, 1.7, 0), 0, 0)

    let beforeCount = 0
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) beforeCount++ })

    const specs: BuildingSpec[] = [
      { footprint: [[0,0],[8,0],[8,8],[0,8]], height: 12, roofShape: 'flat' },
      { footprint: [[700,700],[708,700],[708,708],[700,708]], height: 12, roofShape: 'flat' },
    ]
    engine.setBuildings(specs)

    let afterCount = 0
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) afterCount++ })

    expect(afterCount - beforeCount).toBe(1)
    engine.dispose()
  })

  it('uses a distinct wall material for buildingType "house" vs "other"', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)

    const specs: BuildingSpec[] = [
      { footprint: [[0,0],[8,0],[8,8],[0,8]], height: 6, roofShape: 'flat', buildingType: 'house' },
      { footprint: [[20,0],[28,0],[28,8],[20,8]], height: 12, roofShape: 'flat', buildingType: 'other' },
    ]
    engine.setBuildings(specs)

    const buildingMeshes: THREE.Mesh[] = []
    engine.scene.traverse(o => {
      if (o instanceof THREE.Mesh && Array.isArray(o.material) && o.material.length === 2) buildingMeshes.push(o)
    })
    expect(buildingMeshes).toHaveLength(2)

    const houseWall = (buildingMeshes[0].material as THREE.Material[])[0] as THREE.MeshStandardMaterial
    const otherWall = (buildingMeshes[1].material as THREE.Material[])[0] as THREE.MeshStandardMaterial
    expect(houseWall.color.getHex()).toBe(0xe8dcc0)
    expect(otherWall.color.getHex()).not.toBe(0xe8dcc0)

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
  it('setSunAngle updates the directional light position', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    const sys = new SunSystem()
    const before = engine.sun.position.clone()
    engine.setSunAngle(sys.compute(6))
    engine.setSunAngle(sys.compute(12))
    expect(engine.sun.position.y).toBeGreaterThan(before.y)
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

function makeFarRoadStrip(): RoadStrip {
  return {
    corners: [
      new THREE.Vector3(700, 0.05, 700),
      new THREE.Vector3(700, 0.05, 704),
      new THREE.Vector3(710, 0.05, 704),
      new THREE.Vector3(710, 0.05, 700),
    ],
    uvLength: 10,
  }
}

function makePathStrip(): RoadStrip {
  return {
    corners: [
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(0, 0.05, 2),
      new THREE.Vector3(10, 0.05, 2),
      new THREE.Vector3(10, 0.05, 0),
    ],
    uvLength: 10,
    kind: 'path',
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

  it('culls roads beyond the fog-far distance', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    engine.setViewFromPlayer(new THREE.Vector3(0, 1.7, 0), 0, 0)

    let before = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) before++ })
    engine.setRoads([makeRoadStrip(), makeFarRoadStrip()])
    let after = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) after++ })

    // near strip adds a road mesh + a lane-marking mesh; far strip adds none
    expect(after - before).toBe(2)
    engine.dispose()
  })

  it('setRoads skips the centerline mesh for path strips', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    let before = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) before++ })
    engine.setRoads([makePathStrip()])
    let after = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) after++ })
    // path strip adds only the surface mesh, no centerline
    expect(after - before).toBe(1)
    engine.dispose()
  })

  it('setRoads uses pathMat (not roadMat) for the path strip surface mesh', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()

    const before: THREE.Mesh[] = []
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) before.push(o) })
    engine.setRoads([makePathStrip()])
    const after: THREE.Mesh[] = []
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) after.push(o) })

    const pathMeshes = after.filter(m => !before.includes(m))
    expect(pathMeshes).toHaveLength(1)

    const material = pathMeshes[0].material as THREE.MeshStandardMaterial
    expect(material.color.getHex()).toBe(0xb0aca4)

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

  it('culls trees beyond the fog-far distance', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    engine.setViewFromPlayer(new THREE.Vector3(0, 1.7, 0), 0, 0)

    engine.setTrees([new THREE.Vector3(10, 0, 10), new THREE.Vector3(800, 0, 800)])

    let mesh: THREE.InstancedMesh | undefined
    engine.scene.traverse(o => { if (o instanceof THREE.InstancedMesh) mesh = o })
    expect(mesh).toBeDefined()
    expect(mesh!.count).toBe(1)
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

  it('setWaterAreas adds a mesh to scene', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    const tris = new Float32Array([0,0, 10,0, 10,10, 0,0, 10,10, 0,10])
    let before = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) before++ })
    engine.setWaterAreas(tris)
    let after = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) after++ })
    expect(after).toBeGreaterThan(before)
    engine.dispose()
  })
})

describe('PlanetaryEngine — labels', () => {
  it('setLabels survives an environment without 2D canvas and clears previous labels', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    expect(() => engine.setLabels([{ text: 'Кафе Марс', x: 10, z: 10 }])).not.toThrow()
    expect(() => engine.setLabels([])).not.toThrow()
    expect(engine.scene.getObjectByName('labels')).toBeDefined()
    engine.dispose()
  })

  it('setPerfLevel(2) hides the label group', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setPerfLevel(2)
    expect(engine.scene.getObjectByName('labels')!.visible).toBe(false)
    engine.dispose()
  })
})

describe('PlanetaryEngine — street objects', () => {
  it('setStreetObjects adds instanced lamp and bench meshes', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setStreetObjects([new THREE.Vector3(10, 0, 10)], [{ x: 5, z: 5, yaw: 0.5 }])
    const group = engine.scene.getObjectByName('street-objects')!
    // lamp pole + lamp head + bench seat + bench back
    expect(group.children.filter(o => o instanceof THREE.InstancedMesh)).toHaveLength(4)
    engine.dispose()
  })

  it('culls street objects beyond the fog-far distance and rebuilds cleanly', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setViewFromPlayer(new THREE.Vector3(0, 1.7, 0), 0, 0)
    engine.setStreetObjects([new THREE.Vector3(10, 0, 10), new THREE.Vector3(800, 0, 800)], [])
    const group = engine.scene.getObjectByName('street-objects')!
    const poles = group.children[0] as THREE.InstancedMesh
    expect(poles.count).toBe(1)
    engine.setStreetObjects([], [])
    expect(group.children).toHaveLength(0)
    engine.dispose()
  })

  it('setPerfLevel(2) hides street objects', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setPerfLevel(2)
    expect(engine.scene.getObjectByName('street-objects')!.visible).toBe(false)
    engine.dispose()
  })
})
