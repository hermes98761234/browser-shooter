import * as THREE from 'three'
import { HealthSystem } from '../systems/HealthSystem'

/** Camera/eye height above the player's feet. `position.y` is the eye, not the feet. */
export const EYE_HEIGHT = 2

export class Player {
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Euler
  speed: number = 12
  jumpHeight: number = 8
  speedMult: number = 1
  isGrounded: boolean = true
  private yVelocity: number = 0

  private healthSystem: HealthSystem

  constructor() {
    this.position = new THREE.Vector3(0, EYE_HEIGHT, 0)
    this.velocity = new THREE.Vector3()
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ')
    this.healthSystem = new HealthSystem()
  }

  get health(): number {
    return this.healthSystem.health
  }

  set health(value: number) {
    this.healthSystem.health = value
  }

  get maxHealth(): number {
    return this.healthSystem.maxHealth
  }

  get armor(): number {
    return this.healthSystem.armor
  }

  set armor(value: number) {
    this.healthSystem.armor = value
  }

  addArmor(amount: number) {
    this.healthSystem.armor = Math.min(100, this.healthSystem.armor + amount)
  }

  addMaxHealth(amount: number) {
    this.healthSystem.addMaxHealth(amount)
  }

  /** Reset purchased stats (called on death / match restart). */
  resetLoadout() {
    this.speedMult = 1
    this.healthSystem.reset()
  }

  get isDead(): boolean {
    return this.healthSystem.isDead
  }

  get invincibleTimer(): number {
    return this.healthSystem.invincibleTimer
  }

  set invincibleTimer(value: number) {
    this.healthSystem.invincibleTimer = value
  }

  takeDamage(amount: number): boolean {
    return this.healthSystem.takeDamage(amount)
  }

  heal(amount: number) {
    this.healthSystem.heal(amount)
  }

  resetHealth() {
    this.healthSystem.reset()
  }

  revive() {
    this.healthSystem.revive()
  }

  update(dt: number, input: { forward: boolean; backward: boolean; left: boolean; right: boolean; jump: boolean }, arenaSize: number = 28) {
    if (this.isDead) return

    this.healthSystem.update(dt)

    const direction = new THREE.Vector3()
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.rotation.y, 0))
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.rotation.y, 0))

    if (input.forward) direction.add(forward)
    if (input.backward) direction.sub(forward)
    if (input.right) direction.add(right)
    if (input.left) direction.sub(right)

    if (direction.lengthSq() > 0) {
      direction.normalize()
    }

    this.velocity.x = direction.x * this.speed * this.speedMult
    this.velocity.z = direction.z * this.speed * this.speedMult

    if (input.jump && this.isGrounded) {
      this.yVelocity = this.jumpHeight
      this.isGrounded = false
    }

    this.yVelocity -= 20 * dt

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    this.position.y += this.yVelocity * dt

    if (this.position.y <= EYE_HEIGHT) {
      this.position.y = EYE_HEIGHT
      this.yVelocity = 0
      this.isGrounded = true
    }

    this.position.x = THREE.MathUtils.clamp(this.position.x, -arenaSize, arenaSize)
    this.position.z = THREE.MathUtils.clamp(this.position.z, -arenaSize, arenaSize)
  }
}
