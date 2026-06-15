import * as THREE from 'three'

interface Particle {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  life: number
  maxLife: number
}

export class ParticleSystem {
  private particles: Particle[] = []
  private scene: THREE.Scene
  private pool: THREE.Mesh[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  private getParticle(): THREE.Mesh {
    if (this.pool.length > 0) {
      return this.pool.pop()!
    }
    const geo = new THREE.SphereGeometry(0.05, 4, 4)
    return new THREE.Mesh(geo)
  }

  emit(
    position: THREE.Vector3,
    count: number,
    color: number,
    speed: number = 5,
    life: number = 0.5,
    spread: number = 1
  ) {
    for (let i = 0; i < count; i++) {
      const mesh = this.getParticle()
      const mat = new THREE.MeshBasicMaterial({ color })
      mesh.material = mat
      mesh.position.copy(position)
      mesh.scale.setScalar(1)
      this.scene.add(mesh)

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        Math.random() * spread,
        (Math.random() - 0.5) * spread
      ).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5))

      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
      })
    }
  }

  muzzleFlash(position: THREE.Vector3, direction: THREE.Vector3) {
    this.emit(position, 5, 0xffff00, 10, 0.1, 0.3)
    const flash = new THREE.PointLight(0xffff00, 2, 5)
    flash.position.copy(position)
    this.scene.add(flash)
    setTimeout(() => this.scene.remove(flash), 50)
  }

  bulletImpact(position: THREE.Vector3) {
    this.emit(position, 8, 0xffaa00, 3, 0.3, 0.5)
  }

  bloodSplatter(position: THREE.Vector3) {
    this.emit(position, 12, 0xff0000, 4, 0.4, 0.8)
  }

  explosion(position: THREE.Vector3) {
    this.emit(position, 30, 0xff4400, 8, 0.6, 2)
    this.emit(position, 20, 0xffaa00, 6, 0.8, 1.5)
    const flash = new THREE.PointLight(0xff6600, 5, 15)
    flash.position.copy(position)
    this.scene.add(flash)
    setTimeout(() => this.scene.remove(flash), 100)
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      p.velocity.y -= 9.8 * dt
      p.mesh.position.addScaledVector(p.velocity, dt)
      const scale = Math.max(0, p.life / p.maxLife)
      p.mesh.scale.setScalar(scale)

      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        if (p.mesh.material instanceof THREE.Material) {
          p.mesh.material.dispose()
        }
        this.pool.push(p.mesh)
        this.particles.splice(i, 1)
      }
    }
  }

  clear() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh)
      if (p.mesh.material instanceof THREE.Material) {
        p.mesh.material.dispose()
      }
    }
    this.particles = []
  }
}
