import * as THREE from 'three'

export interface Projectile {
  mesh: THREE.Mesh
  direction: THREE.Vector3
  speed: number
  range: number
  distanceTraveled: number
  origin: THREE.Vector3
  color: THREE.Color
}

export class ProjectileSystem {
  private scene: THREE.Scene
  private projectiles: Projectile[] = []
  private geometry: THREE.SphereGeometry
  private tracerMaterial: THREE.MeshBasicMaterial

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.geometry = new THREE.SphereGeometry(0.05, 4, 4)
    this.tracerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 })
  }

  spawn(origin: THREE.Vector3, direction: THREE.Vector3, range: number, color?: THREE.Color): Projectile {
    const material = this.tracerMaterial.clone()
    if (color) {
      material.color.copy(color)
    }
    const mesh = new THREE.Mesh(this.geometry, material)
    mesh.position.copy(origin)
    this.scene.add(mesh)

    const projectile: Projectile = {
      mesh,
      direction: direction.clone().normalize(),
      speed: 200,
      range,
      distanceTraveled: 0,
      origin: origin.clone(),
      color: color ? color.clone() : new THREE.Color(0xffff00),
    }

    this.projectiles.push(projectile)
    return projectile
  }

  spawnBurst(origin: THREE.Vector3, directions: THREE.Vector3[], range: number, color?: THREE.Color): Projectile[] {
    const results: Projectile[] = []
    for (const dir of directions) {
      results.push(this.spawn(origin, dir, range, color))
    }
    return results
  }

  update(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      const step = p.speed * dt
      p.mesh.position.addScaledVector(p.direction, step)
      p.distanceTraveled += step

      if (p.distanceTraveled >= p.range) {
        this.remove(i)
      }
    }
  }

  private remove(index: number): void {
    const p = this.projectiles[index]
    this.scene.remove(p.mesh)
    p.mesh.geometry = this.geometry // shared, don't dispose
    ;(p.mesh.material as THREE.Material).dispose()
    this.projectiles.splice(index, 1)
  }

  clear(): void {
    while (this.projectiles.length > 0) {
      this.remove(0)
    }
  }

  getActiveCount(): number {
    return this.projectiles.length
  }

  dispose(): void {
    this.clear()
    this.geometry.dispose()
    this.tracerMaterial.dispose()
  }
}
