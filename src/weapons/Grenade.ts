import * as THREE from 'three'
import type { GrenadeType, Vec3 } from '../types'
import { GRENADE_DEFS, type GrenadeDef } from './GrenadeDefs'
import { createGrenadeModel } from './GrenadeModel'

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

  update(dt: number): void {
    if (this.settled) {
      this.fuseTimer -= dt
      return
    }

    this.velocity.y -= this.def.gravity * dt

    this.position.x += this.velocity.x * dt
    this.position.y += this.velocity.y * dt
    this.position.z += this.velocity.z * dt

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