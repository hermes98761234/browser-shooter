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
  it('lists coop and pvp', () => {
    expect(GAME_MODES).toEqual(['coop', 'pvp'])
  })
})

import type { EntityState, NetMessage, Snapshot } from '../protocol'

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
      { type: 'welcome', playerId: 'player-1', mode: 'coop' },
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
    }
    expect(s.seq).toBe(42)
    expect(s.ack).toEqual({ 'player-1': 10 })
    expect(s.events).toHaveLength(0)
  })
})
