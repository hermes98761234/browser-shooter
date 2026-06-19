import * as THREE from 'three'

export type PickupType = 'health' | 'ammo'

export class Pickup {
  type: PickupType
  mesh: THREE.Mesh
  value: number
  bobOffset: number

  constructor(type: PickupType, position: THREE.Vector3) {
    this.type = type
    this.value = type === 'health' ? 25 : 30
    this.bobOffset = Math.random() * Math.PI * 2

    const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6)
    const color = type === 'health' ? 0x00ff00 : 0xffff00
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.copy(position)
    this.mesh.position.y = 1
    this.mesh.castShadow = true
  }

  update(dt: number, time: number) {
    this.mesh.position.y = 1 + Math.sin(time * 0.7 + this.bobOffset) * 0.2
    this.mesh.rotation.y += dt * 0.8
  }

  checkCollision(playerPosition: THREE.Vector3, radius: number = 1.5): boolean {
    return this.mesh.position.distanceTo(playerPosition) < radius
  }

  dispose() {
    this.mesh.geometry.dispose()
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose()
    }
  }
}
