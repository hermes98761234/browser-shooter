import { describe, it, expect } from 'vitest'
import { GameSession } from '../GameSession'
import { emptyInput } from '../protocol'
import { defaultCompetitiveConfig } from '../MatchConfig'
import { RoundState } from '../RoundManager'

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

describe('competitive mode', () => {
  it('creates with RoundManager when mode is competitive', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    expect(session.roundManager).toBeDefined()
    expect(session.economy).toBeDefined()
    expect(session.roundManager!.state).toBe(RoundState.Buying)
  })

  it('does not create RoundManager when mode is not competitive', () => {
    const session = new GameSession()
    expect(session.roundManager).toBeNull()
    expect(session.economy).toBeNull()
  })

  it('resets weapons on death in competitive mode', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    session.weaponManager.equip('ak', 'primary')
    expect(session.weaponManager.current.type).toBe('ak')
    session.handleDeath('local')
    expect(session.weaponManager.current.type).toBe('pistol')
  })

  it('does not reset weapons on death in non-competitive mode', () => {
    const session = new GameSession()
    session.weaponManager.equip('ak', 'primary')
    expect(session.weaponManager.current.type).toBe('ak')
    session.handleDeath('local')
    expect(session.weaponManager.current.type).toBe('ak')
  })

  it('round advances after buy phase', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    session.step(16) // buy phase -> active
    expect(session.roundManager!.buyPhase).toBe(false)
  })
})
