import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GameSession } from '../GameSession'
import { Enemy } from '../../enemies/Enemy'
import { Pickup } from '../../systems/Pickup'
import { emptyInput } from '../protocol'

describe('GameSession.step', () => {
  it('moves the player forward when input.forward is set', () => {
    const s = new GameSession()
    s.applyInput('local', { ...emptyInput(), forward: true })
    const z0 = s.player.position.z
    s.step(0.1)
    expect(s.player.position.z).toBeLessThan(z0) // -Z is forward
  })

  it('increments the tick each step', () => {
    const s = new GameSession()
    s.step(0.016)
    s.step(0.016)
    expect(s.tick).toBe(2)
  })

  it('is deterministic for identical inputs', () => {
    const run = () => {
      const s = new GameSession()
      s.applyInput('local', { ...emptyInput(), forward: true, right: true })
      for (let i = 0; i < 10; i++) s.step(0.016)
      return s.player.position.clone()
    }
    const a = run(); const b = run()
    expect(a.x).toBeCloseTo(b.x, 10)
    expect(a.z).toBeCloseTo(b.z, 10)
  })

  it('tags an enemyMelee event with the victim player id (local in single-player)', () => {
    const s = new GameSession()
    const enemy = new Enemy('grunt', new THREE.Vector3(1, 0, 0)) // within melee range of the local player
    s.enemies.push(enemy)
    // MELEE_RATE is 1s; one large step pushes attackTimer past the threshold and triggers the strike.
    const events = s.step(1)
    const melee = events.find((e) => e.type === 'enemyMelee')
    expect(melee).toBeDefined()
    expect(melee).toMatchObject({ victimId: s.localId })
  })

  it('allows all players to collect pickups, not just local', () => {
    const s = new GameSession()
    s.addPlayer('p2', 'Bob')
    const p2 = s.getPlayer('p2')!
    const pickupPos = new THREE.Vector3(0, 1, 0)
    const pickup = new Pickup('health', pickupPos)
    pickup.mesh.position.copy(p2.player.position)
    pickup.mesh.position.y = 1
    s.pickups.push(pickup)

    const events = s.step(0.016)
    const pickupEv = events.find(e => e.type === 'pickup')
    expect(pickupEv).toBeDefined()
    expect(pickupEv).toMatchObject({ playerId: 'p2' })
    expect(s.pickups.length).toBe(0)
  })

  it('fires playerDied for any player, not just local', () => {
    const s = new GameSession()
    s.addPlayer('p2', 'Bob')
    const p2 = s.getPlayer('p2')!
    p2.player.health = 1
    const enemy = new Enemy('grunt', p2.player.position.clone())
    s.enemies.push(enemy)
    s.step(1)
    expect(p2.player.isDead || s.enemies.length > 0).toBe(true)
  })
})
