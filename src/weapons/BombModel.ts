import * as THREE from 'three'

export class BombModel {
  mesh: THREE.Group

  constructor() {
    this.mesh = new THREE.Group()

    // Placeholder: C4 device (box with timer display)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.15, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    )
    this.mesh.add(body)

    // Timer display
    const display = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.08, 0.01),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    )
    display.position.set(0, 0.08, 0.1)
    this.mesh.add(display)

    // Wires
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    )
    wire.position.set(0.1, 0.08, 0)
    wire.rotation.z = Math.PI / 2
    this.mesh.add(wire)
  }

  dispose(): void {
    this.mesh.parent?.remove(this.mesh)
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }
}