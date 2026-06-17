import { describe, it, expect } from 'vitest'
import { Scoreboard } from './Scoreboard'

describe('Scoreboard', () => {
  it('enemy-team kill credits attacker and team', () => {
    const s = new Scoreboard(0)
    s.recordKill('a', 'ct', 'b', 't', 'team')
    const snap = s.snapshot()
    expect(snap.players.a.kills).toBe(1)
    expect(snap.players.b.deaths).toBe(1)
    expect(snap.teams.ct).toBe(1)
  })

  it('teamkill under friendly penalizes attacker, no team score', () => {
    const s = new Scoreboard(0)
    s.recordKill('a', 'ct', 'b', 'ct', 'friendly')
    const snap = s.snapshot()
    expect(snap.players.a.kills).toBe(-1)
    expect(snap.players.b.deaths).toBe(1)
    expect(snap.teams.ct).toBe(0)
  })

  it('ffa same-team kill scores normally', () => {
    const s = new Scoreboard(0)
    s.recordKill('a', 't', 'b', 't', 'ffa')
    expect(s.snapshot().teams.t).toBe(1)
  })

  it('suicide records a death but no kill credit', () => {
    const s = new Scoreboard(0)
    s.recordKill('a', 'ct', 'a', 'ct', 'team')
    const snap = s.snapshot()
    expect(snap.players.a.deaths).toBe(1)
    expect(snap.players.a.kills ?? 0).toBe(0)
  })

  it('recordDeath increments deaths with no killer', () => {
    const s = new Scoreboard(0)
    s.recordDeath('b')
    expect(s.snapshot().players.b.deaths).toBe(1)
  })

  it('reaching frag limit sets matchOver + winningTeam', () => {
    const s = new Scoreboard(2)
    s.recordKill('a', 'ct', 'b', 't', 'team')
    expect(s.snapshot().matchOver).toBe(false)
    s.recordKill('a', 'ct', 'b', 't', 'team')
    const snap = s.snapshot()
    expect(snap.matchOver).toBe(true)
    expect(snap.winningTeam).toBe('ct')
  })

  it('ignores kills after matchOver', () => {
    const s = new Scoreboard(1)
    s.recordKill('a', 'ct', 'b', 't', 'team')
    s.recordKill('x', 't', 'y', 'ct', 'team')
    expect(s.snapshot().teams.t).toBe(0)
  })
})
