import * as THREE from 'three'
import type { EnemyDef, EnemyAction } from '../types'
import { ENEMY_DEFS } from './EnemyDefs'
import { buildSoldier } from './EnemyModel'
import type { CollisionWorld } from '../engine/CollisionWorld'

const RADIUS = 0.6
const EYE_HEIGHT = 1.5

export class Enemy {
  type: string
  def: EnemyDef
  health: number
  mesh: THREE.Group
  attackTimer: number = 0 // melee cooldown counts up; ranged fire-cooldown counts down
  telegraphTimer: number = 0
  isAiming: boolean = false
  telegraphCue: boolean = false // set true for one frame when aiming begins
  isDead: boolean = false
  deathTimer: number = 0

  constructor(type: string, position: THREE.Vector3) {
    this.type = type
    this.def = ENEMY_DEFS[type]
    this.health = this.def.health
    this.mesh = buildSoldier(type)
    this.mesh.position.copy(position)
    this.mesh.position.y = 0
  }

  takeDamage(amount: number): boolean {
    if (this.isDead) return false
    this.health = Math.max(0, this.health - amount)
    if (this.health <= 0) {
      this.isDead = true
      this.deathTimer = 0.5
      return true
    }
    return false
  }

  update(dt: number, playerPosition: THREE.Vector3, world?: CollisionWorld): EnemyAction | null {
    if (this.isDead) {
      this.deathTimer -= dt
      this.mesh.scale.multiplyScalar(0.9)
      return null
    }
    return this.def.attackType === 'ranged'
      ? this.updateRanged(dt, playerPosition, world)
      : this.updateMelee(dt, playerPosition, world)
  }

  private updateMelee(dt: number, playerPosition: THREE.Vector3, world?: CollisionWorld): EnemyAction | null {
    const dir = new THREE.Vector3().subVectors(playerPosition, this.mesh.position).setY(0)
    const distance = dir.length()

    if (distance > this.def.attackRange) {
      dir.normalize()
      this.mesh.position.addScaledVector(dir, this.def.speed * dt)
      if (world) world.resolve(this.mesh.position, RADIUS)
      this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z)
      this.attackTimer = 0
    } else {
      this.attackTimer += dt
      if (this.attackTimer >= 1) {
        this.attackTimer = 0
        return { type: 'melee', damage: this.def.damage }
      }
    }
    return null
  }

  private updateRanged(dt: number, playerPosition: THREE.Vector3, world?: CollisionWorld): EnemyAction | null {
    this.attackTimer = Math.max(0, this.attackTimer - dt)
    this.telegraphCue = false

    const flatDir = new THREE.Vector3().subVectors(playerPosition, this.mesh.position).setY(0)
    const distance = flatDir.length()
    if (distance > 1e-4) flatDir.normalize()

    this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z)

    const eye = this.mesh.position.clone().setY(EYE_HEIGHT)
    const hasLOS = !world || world.segmentBlocked(eye, playerPosition) === null

    if (!hasLOS || distance > this.def.fireRange) {
      // Advance to gain line of sight / get into range.
      this.isAiming = false
      this.telegraphTimer = 0
      this.mesh.position.addScaledVector(flatDir, this.def.speed * dt)
      if (world) world.resolve(this.mesh.position, RADIUS)
      return null
    }

    // Keep distance if too close.
    if (distance < this.def.standoff) {
      this.mesh.position.addScaledVector(flatDir, -this.def.speed * dt)
      if (world) world.resolve(this.mesh.position, RADIUS)
    }

    if (!this.isAiming) {
      this.isAiming = true
      this.telegraphTimer = 0
      this.telegraphCue = true
    }
    this.telegraphTimer += dt

    if (this.telegraphTimer >= this.def.telegraphTime && this.attackTimer <= 0) {
      this.telegraphTimer = 0
      this.attackTimer = this.def.fireRate
      const hit = Math.random() < this.def.accuracy
      const muzzle = this.mesh.position.clone().setY(1.4).addScaledVector(flatDir, 0.6)
      return { type: 'shoot', damage: this.def.damage, from: muzzle, to: playerPosition.clone(), hit }
    }
    return null
  }

  dispose() {
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (obj.material instanceof THREE.Material) obj.material.dispose()
      }
    })
  }
}
