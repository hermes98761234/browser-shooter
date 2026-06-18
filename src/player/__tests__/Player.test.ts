import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player, EYE_HEIGHT } from '../Player'
import { CollisionWorld } from '../../engine/CollisionWorld'

const NO_INPUT = { forward: false, backward: false, left: false, right: false, jump: false }

describe('Player', () => {
  it('initializes with default values', () => {
    const player = new Player()
    expect(player.health).toBe(100)
    expect(player.maxHealth).toBe(100)
    expect(player.isDead).toBe(false)
    expect(player.speed).toBe(12)
  })

  it('takes damage and reduces health', () => {
    const player = new Player()
    player.takeDamage(30)
    expect(player.health).toBe(70)
    expect(player.isDead).toBe(false)
  })

  it('dies when health reaches 0', () => {
    const player = new Player()
    player.takeDamage(100)
    expect(player.health).toBe(0)
    expect(player.isDead).toBe(true)
  })

  it('is invincible after taking damage', () => {
    const player = new Player()
    player.takeDamage(10)
    expect(player.invincibleTimer).toBeGreaterThan(0)
    player.takeDamage(10)
    expect(player.health).toBe(90)
  })

  it('heals up to max health', () => {
    const player = new Player()
    player.takeDamage(50)
    player.heal(30)
    expect(player.health).toBe(80)
  })

  it('does not heal above max health', () => {
    const player = new Player()
    player.heal(50)
    expect(player.health).toBe(100)
  })

  it('cannot take damage when dead', () => {
    const player = new Player()
    player.takeDamage(100)
    player.takeDamage(50)
    expect(player.health).toBe(0)
  })

  it('updates position based on input', () => {
    const player = new Player()
    const initialZ = player.position.z
    player.update(0.1, { forward: true, backward: false, left: false, right: false, jump: false })
    expect(player.position.z).toBeLessThan(initialZ)
  })

  it('clamps position within arena bounds', () => {
    const player = new Player()
    player.position.x = 50
    player.update(0.1, { forward: false, backward: false, left: false, right: false, jump: false })
    expect(player.position.x).toBeLessThanOrEqual(28)
  })

  it('exposes armor through the health system', () => {
    const p = new Player()
    expect(p.armor).toBe(0)
    p.addArmor(50)
    expect(p.armor).toBe(50)
    p.addArmor(80) // caps at 100
    expect(p.armor).toBe(100)
  })

  it('lands on top of a box instead of falling through it', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(2, 1.2, 2)) // top at 1.2
    const player = new Player()
    player.position.set(0, 1.2 + EYE_HEIGHT + 1, 0) // hovering above the box top
    player.isGrounded = false
    // Let gravity pull the player down onto the box over several frames.
    for (let i = 0; i < 60; i++) player.update(1 / 60, NO_INPUT, 28, world)
    expect(player.position.y).toBeCloseTo(1.2 + EYE_HEIGHT, 1)
    expect(player.isGrounded).toBe(true)
  })

  it('can jump again after landing on a box', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(2, 1.2, 2))
    const player = new Player()
    player.position.set(0, 1.2 + EYE_HEIGHT, 0)
    player.isGrounded = true
    player.update(1 / 60, { ...NO_INPUT, jump: true }, 28, world)
    // Jumping from the box top moves the player above the rest height.
    expect(player.position.y).toBeGreaterThan(1.2 + EYE_HEIGHT)
    expect(player.isGrounded).toBe(false)
  })

  it('defaults speedMult to 1 and resets loadout', () => {
    const p = new Player()
    expect(p.speedMult).toBe(1)
    p.speedMult = 1.15
    p.addArmor(50)
    p.addMaxHealth(25)
    p.resetLoadout()
    expect(p.speedMult).toBe(1)
    expect(p.armor).toBe(0)
    expect(p.maxHealth).toBe(100)
  })
})
