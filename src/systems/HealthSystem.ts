export class HealthSystem {
  health: number
  maxHealth: number
  armor: number = 0
  invincibleTimer: number = 0
  isDead: boolean = false
  private baseMaxHealth: number

  constructor(maxHealth: number = 100) {
    this.health = maxHealth
    this.maxHealth = maxHealth
    this.baseMaxHealth = maxHealth
  }

  takeDamage(amount: number): boolean {
    if (this.invincibleTimer > 0 || this.isDead) return false
    let toHealth = amount
    if (this.armor > 0) {
      const toArmor = Math.min(this.armor, amount * 0.5)
      this.armor -= toArmor
      toHealth = amount - toArmor
    }
    this.health = Math.max(0, this.health - toHealth)
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

  /** Raise the max-health cap and top the player up to it. */
  addMaxHealth(amount: number) {
    this.maxHealth += amount
    this.health = this.maxHealth
  }

  update(dt: number) {
    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt)
  }

  reset() {
    this.maxHealth = this.baseMaxHealth
    this.health = this.maxHealth
    this.armor = 0
    this.isDead = false
    this.invincibleTimer = 0
  }

  /** Respawn: full health, clear death, brief spawn protection. Keeps maxHealth. */
  revive() {
    this.health = this.maxHealth
    this.armor = 0
    this.isDead = false
    this.invincibleTimer = 1
  }
}
