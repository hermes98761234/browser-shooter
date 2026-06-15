import * as THREE from 'three'

export class Player {
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Euler
  health: number = 100
  maxHealth: number = 100
  speed: number = 12
  jumpHeight: number = 8
  isGrounded: boolean = true
  isDead: boolean = false
  invincibleTimer: number = 0
  private yVelocity: number = 0

  constructor() {
    this.position = new THREE.Vector3(0, 2, 0)
    this.velocity = new THREE.Vector3()
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ')
  }

  takeDamage(amount: number) {
    if (this.invincibleTimer > 0 || this.isDead) return
    this.health = Math.max(0, this.health - amount)
    this.invincibleTimer = 0.5
    if (this.health <= 0) {
      this.isDead = true
    }
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  update(dt: number, input: { forward: boolean; backward: boolean; left: boolean; right: boolean; jump: boolean }, arenaSize: number = 28) {
    if (this.isDead) return

    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt)

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

    this.velocity.x = direction.x * this.speed
    this.velocity.z = direction.z * this.speed

    if (input.jump && this.isGrounded) {
      this.yVelocity = this.jumpHeight
      this.isGrounded = false
    }

    this.yVelocity -= 20 * dt

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    this.position.y += this.yVelocity * dt

    if (this.position.y <= 2) {
      this.position.y = 2
      this.yVelocity = 0
      this.isGrounded = true
    }

    this.position.x = THREE.MathUtils.clamp(this.position.x, -arenaSize, arenaSize)
    this.position.z = THREE.MathUtils.clamp(this.position.z, -arenaSize, arenaSize)
  }
}
