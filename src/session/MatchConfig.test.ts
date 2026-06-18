import { describe, it, expect } from 'vitest'
import { canDamage, defaultMatchConfig, defaultCompetitiveConfig } from './MatchConfig'

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
    expect(defaultMatchConfig()).toEqual({ mode: 'coop', damagePolicy: 'team', fragLimit: 30 })
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
