import * as THREE from 'three'
import type { EnemyDef } from '../types'
import { ENEMY_DEFS } from './EnemyDefs'

export class Enemy {
  type: string
  def: EnemyDef
  health: number
  mesh: THREE.Mesh
  attackTimer: number = 0
  isDead: boolean = false
  deathTimer: number = 0

  constructor(type: string, position: THREE.Vector3) {
    this.type = type
    this.def = ENEMY_DEFS[type]
    this.health = this.def.health

    const geo = new THREE.BoxGeometry(1, 2, 1)
    const mat = new THREE.MeshStandardMaterial({ color: this.def.color })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.copy(position)
    this.mesh.position.y = 1
    this.mesh.castShadow = true
  }

  takeDamage(amount: number) {
    if (this.isDead) return false
    this.health = Math.max(0, this.health - amount)
    if (this.health <= 0) {
      this.isDead = true
      this.deathTimer = 0.5
      return true
    }
    return false
  }

  update(dt: number, playerPosition: THREE.Vector3): { damage: number } | null {
    if (this.isDead) {
      this.deathTimer -= dt
      this.mesh.scale.multiplyScalar(0.9)
      return null
    }

    const dir = new THREE.Vector3()
      .subVectors(playerPosition, this.mesh.position)
      .setY(0)
    const distance = dir.length()

    if (distance > this.def.attackRange) {
      dir.normalize()
      this.mesh.position.addScaledVector(dir, this.def.speed * dt)
      this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z)
    } else {
      this.attackTimer += dt
      if (this.attackTimer >= 1) {
        this.attackTimer = 0
        return { damage: this.def.damage }
      }
    }

    return null
  }

  dispose() {
    this.mesh.geometry.dispose()
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose()
    }
  }
}
