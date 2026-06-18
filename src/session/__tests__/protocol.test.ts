import { describe, it, expect } from 'vitest'
import { emptyInput } from '../protocol'

describe('protocol', () => {
  it('emptyInput has all controls cleared', () => {
    const input = emptyInput()
    expect(input.forward).toBe(false)
    expect(input.shoot).toBe(false)
    expect(input.yaw).toBe(0)
    expect(input.pitch).toBe(0)
  })

  it('emptyInput has seq and renderTime set to 0', () => {
    const input = emptyInput()
    expect(input.seq).toBe(0)
    expect(input.renderTime).toBe(0)
  })
})

import { GAME_MODES } from '../protocol'

describe('GameMode', () => {
  it('lists coop, pvp, hybrid, and competitive', () => {
    expect(GAME_MODES).toEqual(['coop', 'pvp', 'hybrid', 'competitive'])
  })
})

import type { EntityState, NetMessage, Snapshot, SessionEvent } from '../protocol'

describe('extended protocol', () => {
  it('EntityState carries optional pitch/weapon/name', () => {
    const s: EntityState = {
      id: 'player-1', kind: 'player', type: 'player',
      position: { x: 0, y: 2, z: 0 }, rotationY: 0,
      rotationX: 0.2, weaponType: 'rifle', name: 'Ann',
      health: 100, isDead: false,
    }
    expect(s.weaponType).toBe('rifle')
    expect(s.name).toBe('Ann')
  })

  it('NetMessage includes join/welcome/playerJoined/playerLeft', () => {
    const msgs: NetMessage[] = [
      { type: 'join', name: 'Ann' },
      { type: 'welcome', playerId: 'player-1', mode: 'coop', config: { mode: 'coop', damagePolicy: 'team', fragLimit: 30 }, players: [] },
      { type: 'playerJoined', playerId: 'player-1', name: 'Ann' },
      { type: 'playerLeft', playerId: 'player-1' },
    ]
    expect(msgs).toHaveLength(4)
  })

  it('NetMessage includes buy and startWave', () => {
    const msgs: NetMessage[] = [
      { type: 'buy', playerId: 'player-1', item: 'ammo' },
      { type: 'startWave', playerId: 'player-1' },
    ]
    expect(msgs).toHaveLength(2)
  })

  it('Snapshot has seq, ack, and events', () => {
    const s: Snapshot = {
      tick: 1,
      seq: 42,
      ack: { 'player-1': 10 },
      players: [],
      enemies: [],
      events: [],
      scores: { teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null },
    }
    expect(s.seq).toBe(42)
    expect(s.ack).toEqual({ 'player-1': 10 })
    expect(s.events).toHaveLength(0)
  })
})

describe('protocol events', () => {
  it('includes roundStart event', () => {
    const event: SessionEvent = { type: 'roundStart', round: 1, money: 800, ctScore: 0, tScore: 0 }
    expect(event.type).toBe('roundStart')
  })

  it('includes roundEnd event', () => {
    const event: SessionEvent = { type: 'roundEnd', winner: 'ct', reason: 'elimination', ctScore: 1, tScore: 0 }
    expect(event.type).toBe('roundEnd')
  })

  it('includes buyPhaseStart event', () => {
    const event: SessionEvent = { type: 'buyPhaseStart', duration: 15 }
    expect(event.type).toBe('buyPhaseStart')
  })

  it('includes buyPhaseEnd event', () => {
    const event: SessionEvent = { type: 'buyPhaseEnd' }
    expect(event.type).toBe('buyPhaseEnd')
  })

  it('includes halftime event', () => {
    const event: SessionEvent = { type: 'halftime', ctScore: 8, tScore: 7 }
    expect(event.type).toBe('halftime')
  })

  it('includes moneyUpdate event', () => {
    const event: SessionEvent = { type: 'moneyUpdate', playerId: 'player-1', amount: 3250 }
    expect(event.type).toBe('moneyUpdate')
  })
})

describe('Snapshot round fields', () => {
  it('has optional round fields', () => {
    const s: Snapshot = {
      tick: 1,
      seq: 42,
      ack: { 'player-1': 10 },
      players: [],
      enemies: [],
      events: [],
      scores: { teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null },
      round: 1,
      roundTimer: 115,
      buyPhase: true,
      buyPhaseTimer: 15,
      ctScore: 0,
      tScore: 0,
    }
    expect(s.round).toBe(1)
    expect(s.roundTimer).toBe(115)
    expect(s.buyPhase).toBe(true)
    expect(s.buyPhaseTimer).toBe(15)
    expect(s.ctScore).toBe(0)
    expect(s.tScore).toBe(0)
  })

  it('round fields are optional', () => {
    const s: Snapshot = {
      tick: 1,
      seq: 42,
      ack: {},
      players: [],
      enemies: [],
      events: [],
      scores: { teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null },
    }
    expect(s.round).toBeUndefined()
    expect(s.roundTimer).toBeUndefined()
    expect(s.buyPhase).toBeUndefined()
    expect(s.buyPhaseTimer).toBeUndefined()
    expect(s.ctScore).toBeUndefined()
    expect(s.tScore).toBeUndefined()
  })
})

describe('bomb events', () => {
  it('bombPlanted includes planterId and timer', () => {
    const event: SessionEvent = { type: 'bombPlanted', site: 'A', planterId: 'player-1', timer: 40 }
    expect(event.type).toBe('bombPlanted')
    expect(event.site).toBe('A')
    expect(event.planterId).toBe('player-1')
    expect(event.timer).toBe(40)
  })

  it('bombDropped includes position and playerId', () => {
    const event: SessionEvent = { type: 'bombDropped', position: { x: 5, y: 0, z: -15 }, playerId: 'player-1' }
    expect(event.type).toBe('bombDropped')
    expect(event.position).toEqual({ x: 5, y: 0, z: -15 })
    expect(event.playerId).toBe('player-1')
  })

  it('bombPickedUp includes playerId', () => {
    const event: SessionEvent = { type: 'bombPickedUp', playerId: 'player-2' }
    expect(event.type).toBe('bombPickedUp')
    expect(event.playerId).toBe('player-2')
  })

  it('bombDefused includes site', () => {
    const event: SessionEvent = { type: 'bombDefused', site: 'B' }
    expect(event.type).toBe('bombDefused')
    expect(event.site).toBe('B')
  })

  it('bombExploded includes site', () => {
    const event: SessionEvent = { type: 'bombExploded', site: 'A' }
    expect(event.type).toBe('bombExploded')
    expect(event.site).toBe('A')
  })
})

describe('Snapshot bomb field', () => {
  it('has optional bomb state', () => {
    const s: Snapshot = {
      tick: 1,
      seq: 42,
      ack: {},
      players: [],
      enemies: [],
      events: [],
      scores: { teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null },
      bomb: {
        state: 'planted',
        carrier: 'player-1',
        site: 'A',
        timer: 35,
        plantProgress: 1.0,
        defuseProgress: 0,
      },
    }
    expect(s.bomb?.state).toBe('planted')
    expect(s.bomb?.carrier).toBe('player-1')
    expect(s.bomb?.site).toBe('A')
    expect(s.bomb?.timer).toBe(35)
  })

  it('bomb field is optional', () => {
    const s: Snapshot = {
      tick: 1,
      seq: 42,
      ack: {},
      players: [],
      enemies: [],
      events: [],
      scores: { teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null },
    }
    expect(s.bomb).toBeUndefined()
  })
})
