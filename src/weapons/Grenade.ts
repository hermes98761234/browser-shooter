import * as THREE from 'three'
import type { GrenadeType, Vec3 } from '../types'
import type { CollisionWorld } from '../engine/CollisionWorld'
import { GRENADE_DEFS, type GrenadeDef } from './GrenadeDefs'
import { createGrenadeModel } from './GrenadeModel'

/** Collision radius of a grenade, treated as a small sphere. */
const GRENADE_RADIUS = 0.15

export class Grenade {
  type: GrenadeType
  def: GrenadeDef
  id: string
  thrownBy: string
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Euler
  fuseTimer: number
  bounces: number = 0
  private mesh: THREE.Group
  private settled: boolean = false

  constructor(type: GrenadeType, position: Vec3, velocity: Vec3, id?: string, thrownBy: string = 'local') {
    this.type = type
    this.def = { ...GRENADE_DEFS[type] }
    this.id = id ?? `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    this.thrownBy = thrownBy
    this.position = new THREE.Vector3(position.x, position.y, position.z)
    this.velocity = new THREE.Vector3(velocity.x, velocity.y, velocity.z)
    this.rotation = new THREE.Euler(0, 0, 0)
    this.fuseTimer = this.def.fuseTimer
    this.mesh = createGrenadeModel(type)
    this.mesh.position.copy(this.position)
  }

  get meshRef(): THREE.Group {
    return this.mesh
  }

  update(dt: number, world?: CollisionWorld): void {
    if (this.settled) {
      this.fuseTimer -= dt
      return
    }

    this.velocity.y -= this.def.gravity * dt

    this.position.x += this.velocity.x * dt
    this.position.y += this.velocity.y * dt
    this.position.z += this.velocity.z * dt

    // Bounce off the walls and cover boxes of the map (not just the floor plane).
    if (world) this.resolveBoxes(world)

    if (this.position.y <= 0.15) {
      this.position.y = 0.15
      if (this.bounces < this.def.maxBounces) {
        this.velocity.y = Math.abs(this.velocity.y) * this.def.restitution
        this.velocity.x *= 0.8
        this.velocity.z *= 0.8
        this.bounces++
      } else {
        this.velocity.set(0, 0, 0)
        this.settled = true
      }
    }

    this.rotation.x += this.velocity.z * dt * 2
    this.rotation.z -= this.velocity.x * dt * 2

    this.mesh.position.copy(this.position)
    this.mesh.rotation.copy(this.rotation)

    this.fuseTimer -= dt
  }

  /**
   * Push the grenade out of any map box it has penetrated and reflect its velocity off
   * the contacted face (restitution along the normal, friction on the tangent). Treats
   * the grenade as a sphere of {@link GRENADE_RADIUS}.
   */
  private resolveBoxes(world: CollisionWorld): void {
    for (const box of world.boxes) {
      const closestX = THREE.MathUtils.clamp(this.position.x, box.min.x, box.max.x)
      const closestY = THREE.MathUtils.clamp(this.position.y, box.min.y, box.max.y)
      const closestZ = THREE.MathUtils.clamp(this.position.z, box.min.z, box.max.z)
      const dx = this.position.x - closestX
      const dy = this.position.y - closestY
      const dz = this.position.z - closestZ
      const distSq = dx * dx + dz * dz + dy * dy

      if (distSq >= GRENADE_RADIUS * GRENADE_RADIUS) continue

      const normal = new THREE.Vector3()
      if (distSq > 1e-8) {
        // Outside the box: normal points from the nearest surface point to the grenade.
        const dist = Math.sqrt(distSq)
        normal.set(dx / dist, dy / dist, dz / dist)
        const push = GRENADE_RADIUS - dist
        this.position.addScaledVector(normal, push)
      } else {
        // Centre inside the box: eject along the axis of least penetration.
        const pen = [
          { n: new THREE.Vector3(-1, 0, 0), d: this.position.x - box.min.x },
          { n: new THREE.Vector3(1, 0, 0), d: box.max.x - this.position.x },
          { n: new THREE.Vector3(0, -1, 0), d: this.position.y - box.min.y },
          { n: new THREE.Vector3(0, 1, 0), d: box.max.y - this.position.y },
          { n: new THREE.Vector3(0, 0, -1), d: this.position.z - box.min.z },
          { n: new THREE.Vector3(0, 0, 1), d: box.max.z - this.position.z },
        ].reduce((a, b) => (b.d < a.d ? b : a))
        normal.copy(pen.n)
        if (normal.x !== 0) this.position.x += normal.x * (pen.d + GRENADE_RADIUS)
        else if (normal.y !== 0) this.position.y += normal.y * (pen.d + GRENADE_RADIUS)
        else this.position.z += normal.z * (pen.d + GRENADE_RADIUS)
      }

      const vn = this.velocity.dot(normal)
      if (vn < 0) {
        // Split into normal/tangent, bounce the normal part, apply friction to the tangent.
        const vNormal = normal.clone().multiplyScalar(vn)
        const vTangent = this.velocity.clone().sub(vNormal)
        this.velocity
          .copy(vTangent.multiplyScalar(0.8))
          .addScaledVector(vNormal, -this.def.restitution)
      }
    }
  }

  isExpired(): boolean {
    return this.fuseTimer <= 0
  }

  detonate(): Vec3 {
    return { x: this.position.x, y: this.position.y, z: this.position.z }
  }

  dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (child.material instanceof THREE.Material) {
          child.material.dispose()
        }
      }
    })
  }
}