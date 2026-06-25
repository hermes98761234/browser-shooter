import { describe, it, expect } from 'vitest'
import { canDamage, defaultMatchConfig, defaultCompetitiveConfig } from './MatchConfig'
import type { MatchConfig } from './MatchConfig'

describe('canDamage', () => {
  it('team policy: only opposite teams', () => {
    expect(canDamage('ct', 't', 'team')).toBe(true)
    expect(canDamage('ct', 'ct', 'team')).toBe(false)
  })
  it('friendly policy: anyone', () => {
    expect(canDamage('ct', 'ct', 'friendly')).toBe(true)
    expect(canDamage('ct', 't', 'friendly')).toBe(true)
  })
  it('ffa policy: anyone', () => {
    expect(canDamage('t', 't', 'ffa')).toBe(true)
    expect(canDamage('t', 'ct', 'ffa')).toBe(true)
  })
})

describe('defaultMatchConfig', () => {
  it('defaults to coop / team / 30', () => {
    expect(defaultMatchConfig()).toEqual({ mode: 'coop', damagePolicy: 'team', fragLimit: 30, joinPolicy: 'lobby', zoneId: 'arid' })
  })
})

describe('competitive mode', () => {
  it('defaultCompetitiveConfig returns correct defaults', () => {
    const config = defaultCompetitiveConfig()
    expect(config.mode).toBe('competitive')
    expect(config.damagePolicy).toBe('team')
    expect(config.fragLimit).toBe(0)
    expect(config.roundsToWin).toBe(16)
    expect(config.buyPhaseDuration).toBe(15)
    expect(config.roundDuration).toBe(115)
  })
})

describe('join policy defaults', () => {
  it('defaultMatchConfig is lobby with no password', () => {
    const c = defaultMatchConfig()
    expect(c.joinPolicy).toBe('lobby')
    expect(c.password).toBeUndefined()
  })

  it('defaultCompetitiveConfig is lobby', () => {
    expect(defaultCompetitiveConfig().joinPolicy).toBe('lobby')
  })
})

import type { ZoneDef } from '../zones/ZoneDef'
import { DAYLIGHT } from '../zones/ZoneDef'

const STUB_ZONE: ZoneDef = {
  id: 'custom-xyz', name: 'My Map', description: 'test', arenaSize: 30,
  floorColor: 0x444444, lighting: DAYLIGHT,
  structures: [], ctSpawns: [[0, -20]], tSpawns: [[0, 20]],
  bombsites: [{ id: 'A', center: [10, 0] }, { id: 'B', center: [-10, 0] }],
}

describe('customZone field', () => {
  it('MatchConfig accepts a customZone', () => {
    const c: MatchConfig = { ...defaultMatchConfig(), zoneId: 'custom', customZone: STUB_ZONE }
    expect(c.customZone?.name).toBe('My Map')
  })
})
