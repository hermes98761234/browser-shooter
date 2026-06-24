import * as THREE from 'three'
import { CollisionWorld } from './CollisionWorld'
import type { ZoneDef, StructureMaterial } from '../zones/ZoneDef'
import { getZone } from '../zones/registry'

const WALL_H = 5

/** Name of the group that holds all arena geometry/lights, so it can be swapped. */
export const ARENA_GROUP_NAME = 'cs-arena'

function materialFor(kind: StructureMaterial): THREE.MeshStandardMaterial {
  switch (kind) {
    case 'crate':
      return new THREE.MeshStandardMaterial({ color: 0x9c7a3c, roughness: 0.8, metalness: 0.05 })
    case 'concrete':
      return new THREE.MeshStandardMaterial({ color: 0x707078, roughness: 0.9, metalness: 0.1 })
    case 'metal':
      return new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.6, metalness: 0.4 })
    case 'wood':
      return new THREE.MeshStandardMaterial({ color: 0x8b6b3c, roughness: 0.9, metalness: 0.0 })
    case 'wall':
    default:
      return new THREE.MeshStandardMaterial({ color: 0x8a8577, roughness: 0.85, metalness: 0.1 })
  }
}

/**
 * Builds a map (floor, perimeter walls, cover, bombsite markers, lighting) from
 * a {@link ZoneDef} into a single named group added to `scene`, and returns its
 * CollisionWorld. Defaults to the registry's default zone (Arid).
 */
export function createArena(scene: THREE.Scene, map: ZoneDef = getZone()): CollisionWorld {
  const world = new CollisionWorld()
  const group = new THREE.Group()
  group.name = ARENA_GROUP_NAME
  const half = map.arenaSize

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2, half * 2),
    new THREE.MeshStandardMaterial({ color: map.floorColor, roughness: 0.95, metalness: 0.05 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  group.add(floor)

  // Helper: add a solid box to both the group and the collision world.
  const addSolid = (center: [number, number, number], size: [number, number, number], mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat)
    mesh.position.set(...center)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    world.addBox(new THREE.Vector3(...center), new THREE.Vector3(...size))
  }

  const wallMat = materialFor('wall')
  // Perimeter walls
  addSolid([0, WALL_H / 2, -half], [half * 2, WALL_H, 0.5], wallMat)
  addSolid([0, WALL_H / 2, half], [half * 2, WALL_H, 0.5], wallMat)
  addSolid([-half, WALL_H / 2, 0], [0.5, WALL_H, half * 2], wallMat)
  addSolid([half, WALL_H / 2, 0], [0.5, WALL_H, half * 2], wallMat)

  // Map-specific structures
  for (const s of map.structures) addSolid(s.center, s.size, materialFor(s.material))

  // Sky / fog — outdoor maps supply a skyColor; indoor maps leave the engine default
  if (map.skyColor !== undefined) {
    scene.background = new THREE.Color(map.skyColor)
    scene.fog = new THREE.Fog(map.skyColor, map.fogNear ?? 30, map.fogFar ?? 100)
  }

  // Lighting
  const lit = map.lighting
  group.add(new THREE.AmbientLight(lit.ambientColor, lit.ambientIntensity))

  const sun = new THREE.DirectionalLight(lit.sunColor, lit.sunIntensity)
  sun.position.set(...lit.sunPosition)
  sun.castShadow = true
  sun.shadow.mapSize.width = 2048
  sun.shadow.mapSize.height = 2048
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 120
  sun.shadow.camera.left = -half - 15
  sun.shadow.camera.right = half + 15
  sun.shadow.camera.top = half + 15
  sun.shadow.camera.bottom = -half - 15
  group.add(sun)

  // Bombsite markers (A = red, B = blue)
  for (const site of map.bombsites) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3, 4, 32),
      new THREE.MeshBasicMaterial({
        color: site.id === 'A' ? 0xff3333 : 0x3333ff,
        transparent: true,
        opacity: 0.5,
      })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(site.center[0], 0.01, site.center[1])
    group.add(ring)
  }

  scene.add(group)
  return world
}

/** Disposes geometries/materials under an object so swapped arenas don't leak GPU memory. */
function disposeGroup(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const mat = child.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}

/**
 * Removes any existing arena group from `scene`, then builds `map` fresh.
 * Used when the selected map changes (room creation / match start).
 */
export function rebuildArena(scene: THREE.Scene, map: ZoneDef = getZone()): CollisionWorld {
  const existing = scene.getObjectByName(ARENA_GROUP_NAME)
  if (existing) {
    disposeGroup(existing)
    scene.remove(existing)
  }
  return createArena(scene, map)
}
