import { describe, it, expect } from 'vitest'
import { RoundManager, RoundState } from '../RoundManager'

describe('RoundManager', () => {
  it('starts in buying state', () => {
    const rm = new RoundManager()
    expect(rm.state).toBe(RoundState.Buying)
    expect(rm.round).toBe(1)
  })

  it('transitions from buying to active after duration', () => {
    const rm = new RoundManager()
    rm.update(16) // 15s buy phase + 1s extra
    expect(rm.state).toBe(RoundState.Active)
    expect(rm.buyPhase).toBe(false)
  })

  it('counts down buy phase timer', () => {
    const rm = new RoundManager()
    rm.update(5)
    expect(rm.buyPhaseTimer).toBe(10) // 15 - 5 = 10
  })

  it('ends round when timer expires', () => {
    const rm = new RoundManager()
    rm.update(16) // enter active
    rm.update(116) // 115s round timer
    expect(rm.state).toBe(RoundState.Over)
  })

  it('counts down round timer', () => {
    const rm = new RoundManager()
    rm.update(16) // enter active
    rm.update(10)
    expect(rm.roundTimer).toBe(105) // 115 - 10 = 105
  })

  it('freezes the round timer while the bomb is planted', () => {
    const rm = new RoundManager()
    rm.update(16) // enter active
    rm.update(50, true) // bomb planted: round timer no longer counts down
    expect(rm.roundTimer).toBe(115)
    expect(rm.state).toBe(RoundState.Active)
  })

  it('does not end the round on the timer while the bomb is planted', () => {
    const rm = new RoundManager()
    rm.update(16) // enter active
    rm.roundTimer = 5
    rm.update(10, true) // would expire if not frozen; bomb planted keeps round live
    expect(rm.state).toBe(RoundState.Active)
  })

  it('advances to next round after over state', () => {
    const rm = new RoundManager()
    rm.update(16) // buying -> active
    rm.update(116) // active -> over
    rm.endRound('ct')
    expect(rm.round).toBe(2)
    expect(rm.state).toBe(RoundState.Buying)
    expect(rm.ctScore).toBe(1)
  })

  it('swaps teams at halftime', () => {
    const rm = new RoundManager()
    rm.setRound(15)
    rm.update(16) // buying -> active
    rm.endRound('ct')
    expect(rm.round).toBe(16)
    expect(rm.isHalftime).toBe(true)
  })

  it('clears isHalftime once the second half is underway', () => {
    const rm = new RoundManager()
    rm.setRound(15)
    rm.endRound('ct') // round 15 -> 16: this is the halftime boundary
    expect(rm.isHalftime).toBe(true)
    rm.endRound('t') // round 16 -> 17: no longer halftime
    expect(rm.isHalftime).toBe(false)
  })

  it('match ends at round 30 or first to 16', () => {
    const rm = new RoundManager()
    rm.setRound(29)
    rm.ctScore = 15
    rm.tScore = 14
    rm.update(16) // active
    rm.endRound('ct')
    expect(rm.matchOver).toBe(true)
    expect(rm.winner).toBe('ct')
  })
})
