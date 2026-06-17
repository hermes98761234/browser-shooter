// src/session/GameSession.pvp.test.ts
import { describe, it, expect } from 'vitest'
import { GameSession } from './GameSession'

describe('GameSession team + scores in snapshot', () => {
  it('defaults to coop config and tags the local player with a team', () => {
    const s = new GameSession()
    const snap = s.getSnapshot()
    expect(snap.players[0].team).toBe('ct')
    expect(snap.scores).toEqual({ teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null })
  })

  it('addPlayer stores the chosen team', () => {
    const s = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    s.addPlayer('p2', 'Bob', 't')
    const snap = s.getSnapshot()
    expect(snap.players.find(p => p.id === 'p2')!.team).toBe('t')
  })
})
