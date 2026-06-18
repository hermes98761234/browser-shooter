import * as THREE from 'three'

export class DefuseKitModel {
  mesh: THREE.Group

  constructor() {
    this.mesh = new THREE.Group()

    // Placeholder: Wirecutters (two cylinders for handles)
    const handle1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    )
    handle1.position.set(-0.03, 0, 0)
    handle1.rotation.z = 0.3
    this.mesh.add(handle1)

    const handle2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    )
    handle2.position.set(0.03, 0, 0)
    handle2.rotation.z = -0.3
    this.mesh.add(handle2)

    // Cutting head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.02, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x666666 })
    )
    head.position.set(0, 0.1, 0)
    this.mesh.add(head)
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