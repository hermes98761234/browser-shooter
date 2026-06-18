import { describe, it, expect } from 'vitest'
import { Economy } from '../Economy'

describe('Economy', () => {
  it('starts with given amount', () => {
    const eco = new Economy(800)
    expect(eco.money).toBe(800)
  })

  it('adds money', () => {
    const eco = new Economy(800)
    eco.addMoney(3250)
    expect(eco.money).toBe(4050)
  })

  it('spends money', () => {
    const eco = new Economy(800)
    eco.spendMoney(200)
    expect(eco.money).toBe(600)
  })

  it('cannot spend more than available', () => {
    const eco = new Economy(800)
    eco.spendMoney(1000)
    expect(eco.money).toBe(800)
  })

  it('can afford returns true when enough money', () => {
    const eco = new Economy(800)
    expect(eco.canAfford(800)).toBe(true)
    expect(eco.canAfford(801)).toBe(false)
  })

  it('cannot go below zero', () => {
    const eco = new Economy(800)
    eco.spendMoney(900)
    expect(eco.money).toBe(800)
  })

  it('resets to given amount', () => {
    const eco = new Economy(800)
    eco.addMoney(5000)
    eco.reset(800)
    expect(eco.money).toBe(800)
  })
})