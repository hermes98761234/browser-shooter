import * as THREE from 'three'
import { CollisionWorld } from './CollisionWorld'

const ARENA = 30
const WALL_H = 5

/** Builds the map (floor, perimeter walls, cover) and returns its CollisionWorld. */
export function createArena(scene: THREE.Scene): CollisionWorld {
  const world = new CollisionWorld()

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
    new THREE.MeshStandardMaterial({ color: 0x6b6b63, roughness: 0.95, metalness: 0.05 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a8577, roughness: 0.85, metalness: 0.1 })
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x9c7a3c, roughness: 0.8, metalness: 0.05 })
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x707078, roughness: 0.9, metalness: 0.1 })

  // Helper: add a solid box both to the scene and the collision world.
  const addSolid = (
    center: [number, number, number],
    size: [number, number, number],
    mat: THREE.Material
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat)
    mesh.position.set(...center)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    world.addBox(new THREE.Vector3(...center), new THREE.Vector3(...size))
  }

  // Perimeter walls
  addSolid([0, WALL_H / 2, -ARENA], [ARENA * 2, WALL_H, 0.5], wallMat)
  addSolid([0, WALL_H / 2, ARENA], [ARENA * 2, WALL_H, 0.5], wallMat)
  addSolid([-ARENA, WALL_H / 2, 0], [0.5, WALL_H, ARENA * 2], wallMat)
  addSolid([ARENA, WALL_H / 2, 0], [0.5, WALL_H, ARENA * 2], wallMat)

  // Central hard-cover block
  addSolid([0, 1.5, 0], [6, 3, 6], concreteMat)

  // Two raised structures / long walls for sight-line breaks
  addSolid([-14, 2, -8], [1, 4, 14], concreteMat)
  addSolid([14, 2, 8], [1, 4, 14], concreteMat)

  // Crate stacks (cover you can hide behind)
  const crateGroups: [number, number][] = [
    [-10, 10], [12, -12], [8, 14], [-16, -14], [18, 0], [-6, -18],
  ]
  for (const [x, z] of crateGroups) {
    addSolid([x, 1, z], [2, 2, 2], crateMat)
    addSolid([x + 2, 1, z], [2, 2, 2], crateMat)
    addSolid([x + 1, 2.6, z], [2, 1.4, 2], crateMat) // stacked on top
  }

  // Low sandbag-style walls (waist-high cover)
  addSolid([6, 0.6, -6], [6, 1.2, 0.8], concreteMat)
  addSolid([-8, 0.6, 6], [6, 1.2, 0.8], concreteMat)

  // Lighting (daylight-ish)
  scene.add(new THREE.AmbientLight(0xb0b8c0, 0.7))

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1)
  sun.position.set(20, 30, 10)
  sun.castShadow = true
  sun.shadow.mapSize.width = 2048
  sun.shadow.mapSize.height = 2048
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 120
  sun.shadow.camera.left = -45
  sun.shadow.camera.right = 45
  sun.shadow.camera.top = 45
  sun.shadow.camera.bottom = -45
  scene.add(sun)

  return world
}
