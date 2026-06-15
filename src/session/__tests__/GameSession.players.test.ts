import { describe, it, expect } from 'vitest'
import { GameSession } from '../GameSession'
import { emptyInput } from '../protocol'

describe('GameSession players map', () => {
  it('seeds exactly the local player', () => {
    const s = new GameSession()
    expect(s.playerIds()).toEqual([s.localId])
  })

  it('player/weaponManager getters point at the local entity', () => {
    const s = new GameSession()
    expect(s.player).toBe(s.getPlayer(s.localId)!.player)
    expect(s.weaponManager).toBe(s.getPlayer(s.localId)!.weapons)
  })
})

describe('GameSession multi-player movement', () => {
  it('moves a second player independently of the local player', () => {
    const s = new GameSession()
    s.addPlayer('player-2', 'Bob')
    const before = s.getPlayer('player-2')!.player.position.z

    // player-2 holds forward; local player holds nothing.
    s.applyInput('player-2', { ...emptyInput(), forward: true })
    s.step(0.1)

    const after = s.getPlayer('player-2')!.player.position.z
    expect(after).toBeLessThan(before)            // moved along -Z (forward)
    expect(s.player.position.x).toBeCloseTo(0)    // local player did not move on x
  })
})
