import * as THREE from 'three'
import { createMuzzleFlash } from './MuzzleFlash'
import { createSparkBurst, createBloodSplatter, updateParticleHandle } from './BulletImpact'
import { createExplosion, updateExplosion, disposeExplosion, getExplosionScale, type ExplosionHandle } from './Explosion'
import type { ParticleHandle } from './BulletImpact'

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
  private impacts: ParticleHandle[] = []
  private explosions: ExplosionHandle[] = []
  private tracers: { line: THREE.Line; mat: THREE.LineBasicMaterial; life: number; maxLife: number }[] = []

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

  private returnParticle(mesh: THREE.Mesh) {
    this.scene.remove(mesh)
    if (mesh.material instanceof THREE.Material) {
      mesh.material.dispose()
    }
    this.pool.push(mesh)
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

  muzzleFlash(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    color: number = 0xffff00,
    intensity: number = 2,
    distance: number = 5
  ) {
    void direction
    this.emit(position, 5, color, 10, 0.1, 0.3)
    createMuzzleFlash(this.scene, position, color, intensity, distance, 60)
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color: number = 0xffdd66, life: number = 0.12) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()])
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 })
    const line = new THREE.Line(geo, mat)
    this.scene.add(line)
    this.tracers.push({ line, mat, life, maxLife: life })
  }

  bulletImpact(position: THREE.Vector3) {
    this.emit(position, 8, 0xffaa00, 3, 0.3, 0.5)
    const handle = createSparkBurst(this.scene, position)
    this.impacts.push(handle)
  }

  bloodSplatter(position: THREE.Vector3) {
    this.emit(position, 12, 0xff0000, 4, 0.4, 0.8)
    const handle = createBloodSplatter(this.scene, position)
    this.impacts.push(handle)
  }

  explosion(position: THREE.Vector3, enemyType: string = 'grunt') {
    const scale = getExplosionScale(enemyType)
    this.emit(position, Math.floor(30 * scale), 0xff4400, 8 * scale, 0.6, 2)
    this.emit(position, Math.floor(20 * scale), 0xffaa00, 6 * scale, 0.8, 1.5)

    const handle = createExplosion(this.scene, { position, scale })
    this.explosions.push(handle)
  }

  update(dt: number) {
    // Update core particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      p.velocity.y -= 9.8 * dt
      p.mesh.position.addScaledVector(p.velocity, dt)
      const scale = Math.max(0, p.life / p.maxLife)
      p.mesh.scale.setScalar(scale)

      if (p.life <= 0) {
        this.returnParticle(p.mesh)
        this.particles.splice(i, 1)
      }
    }

    // Update bullet impacts
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      if (!updateParticleHandle(this.impacts[i], dt)) {
        this.impacts.splice(i, 1)
      }
    }

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      if (!updateExplosion(this.explosions[i], dt)) {
        disposeExplosion(this.explosions[i])
        this.explosions.splice(i, 1)
      }
    }

    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]
      t.life -= dt
      t.mat.opacity = Math.max(0, t.life / t.maxLife) * 0.9
      if (t.life <= 0) {
        this.scene.remove(t.line)
        t.line.geometry.dispose()
        t.mat.dispose()
        this.tracers.splice(i, 1)
      }
    }
  }

  clear() {
    for (const p of this.particles) {
      this.returnParticle(p.mesh)
    }
    this.particles = []

    for (const handle of this.impacts) {
      for (const mesh of handle.particles) {
        this.scene.remove(mesh)
        mesh.geometry.dispose()
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose()
        }
      }
    }
    this.impacts = []

    for (const handle of this.explosions) {
      disposeExplosion(handle)
    }
    this.explosions = []

    for (const t of this.tracers) {
      this.scene.remove(t.line)
      t.line.geometry.dispose()
      t.mat.dispose()
    }
    this.tracers = []
  }
}
