import { describe, it, expect } from 'vitest'
import { GameSession } from './GameSession'
import { RESPAWN_DELAY } from './GameSession'

/**
 * Detonate the session's first active grenade exactly on `target` this tick.
 * We override the grenade's position/velocity/fuse so the detonation point is
 * deterministic instead of relying on the projectile's flight.
 */
function detonateOn(s: GameSession, target: { x: number; y: number; z: number }) {
  const g = s.activeGrenades[0]
  g.position.set(target.x, target.y, target.z)
  g.velocity.set(0, 0, 0)
  g.fuseTimer = 0.001
  s.step(1 / 30)
}

describe('GameSession HE grenade kills', () => {
  function setup(damagePolicy: 'team' | 'friendly' | 'ffa', bTeam: 'ct' | 't') {
    const s = new GameSession({ mode: 'pvp', damagePolicy, fragLimit: 0 })
    const a = s.getPlayer(s.localId)!
    a.team = 'ct'
    a.player.position.set(0, 2, 0)
    const b = s.addPlayer('b', 'Bob', bTeam)
    b.player.position.set(0, 2, -8) // 8 units from A: A survives the blast (~20 dmg)
    s.throwGrenade(a.id, 'he', 'long')
    return { s, a, b }
  }

  it('respawns a player killed by an HE grenade after the respawn delay', () => {
    const { s, b } = setup('team', 't')
    detonateOn(s, b.player.position)
    expect(b.player.isDead).toBe(true)

    // Advance past the respawn delay.
    const ticks = Math.ceil((RESPAWN_DELAY + 1) * 30)
    for (let i = 0; i < ticks; i++) s.step(1 / 30)
    expect(b.player.isDead).toBe(false)
    expect(b.player.health).toBe(100)
  })

  it('records the death and credits the thrower with a kill', () => {
    const { s, a, b } = setup('team', 't')
    detonateOn(s, b.player.position)

    const scores = s.scoreboard.snapshot()
    expect(scores.players['b'].deaths).toBe(1)
    expect(scores.players[a.id].kills).toBe(1)
    expect(scores.teams.ct).toBe(1)
  })

  it('does not damage a teammate under team damage policy', () => {
    const { s, b } = setup('team', 'ct') // B is on A's team
    detonateOn(s, b.player.position)
    expect(b.player.health).toBe(100)
    expect(b.player.isDead).toBe(false)
  })

  it('damages a teammate under friendly-fire policy', () => {
    const { s, b } = setup('friendly', 'ct')
    detonateOn(s, b.player.position)
    expect(b.player.isDead).toBe(true)
  })
})

describe('GameSession grenade snapshot', () => {
  it('reports the real thrower id, not a hardcoded local id', () => {
    const s = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    const b = s.addPlayer('b', 'Bob', 't')
    b.player.position.set(0, 2, -8)
    s.throwGrenade('b', 'he', 'long')
    const snap = s.getSnapshot()
    expect(snap.grenades[0].thrownBy).toBe('b')
  })
})
