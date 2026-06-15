export class HealthSystem {
  health: number
  maxHealth: number
  invincibleTimer: number = 0
  isDead: boolean = false

  constructor(maxHealth: number = 100) {
    this.health = maxHealth
    this.maxHealth = maxHealth
  }

  takeDamage(amount: number): boolean {
    if (this.invincibleTimer > 0 || this.isDead) return false
    this.health = Math.max(0, this.health - amount)
    this.invincibleTimer = 0.5
    if (this.health <= 0) {
      this.isDead = true
    }
    return true
  }

  heal(amount: number) {
    if (this.isDead) return
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  update(dt: number) {
    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt)
  }

  reset() {
    this.health = this.maxHealth
    this.isDead = false
    this.invincibleTimer = 0
  }
}
