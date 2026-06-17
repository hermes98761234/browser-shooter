import { describe, it, expect } from 'vitest'
import { HealthSystem } from './HealthSystem'

describe('HealthSystem.revive', () => {
  it('restores full health, clears death, grants brief i-frames', () => {
    const h = new HealthSystem(100)
    h.takeDamage(100)
    expect(h.isDead).toBe(true)
    h.revive()
    expect(h.isDead).toBe(false)
    expect(h.health).toBe(100)
    expect(h.armor).toBe(0)
    expect(h.invincibleTimer).toBeGreaterThan(0)
  })

  it('keeps a raised maxHealth on revive', () => {
    const h = new HealthSystem(100)
    h.addMaxHealth(50) // now 150
    h.takeDamage(150)
    h.revive()
    expect(h.health).toBe(150)
  })
})
