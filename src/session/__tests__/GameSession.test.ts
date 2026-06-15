import { describe, it, expect } from 'vitest'
import { GameSession } from '../GameSession'
import { emptyInput } from '../protocol'

describe('GameSession skeleton', () => {
  it('starts with one local player and no enemies', () => {
    const s = new GameSession()
    const snap = s.getSnapshot()
    expect(snap.players).toHaveLength(1)
    expect(snap.players[0].id).toBe('local')
    expect(snap.enemies).toHaveLength(0)
    expect(snap.players[0].health).toBe(100)
  })

  it('stores the latest input for a player', () => {
    const s = new GameSession()
    const input = { ...emptyInput(), forward: true, yaw: 1.2 }
    s.applyInput('local', input)
    expect(s.getInput('local').forward).toBe(true)
    expect(s.getInput('local').yaw).toBe(1.2)
  })
})
