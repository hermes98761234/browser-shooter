import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Scoreboard } from '../Scoreboard'
import type { EntityState } from '../../session/protocol'
import type { MatchScores } from '../../session/Scoreboard'

function ent(over: Partial<EntityState>): EntityState {
  return { id: over.id!, kind: 'player', type: 'player', position: { x: 0, y: 0, z: 0 },
    rotationY: 0, health: 100, isDead: false, ...over }
}

const scores: MatchScores = { teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null }

describe('Scoreboard bot rows', () => {
  it('shows BOT instead of a ping for bot rows, and ms for humans', () => {
    const players = [
      ent({ id: 'local', name: 'You', team: 'ct', ping: 25 }),
      ent({ id: 'bot-0', name: 'BOT Wade', team: 't', isBot: true }),
    ]
    render(<Scoreboard players={players} scores={scores} />)
    expect(screen.getByText('BOT Wade')).toBeTruthy()
    expect(screen.getByText('BOT')).toBeTruthy()      // bot ping cell
    expect(screen.getByText('25 ms')).toBeTruthy()    // human ping cell
  })
})
