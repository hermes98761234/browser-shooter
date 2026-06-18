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

  describe('recordWin', () => {
    it('adds $3250', () => {
      const eco = new Economy(800)
      eco.recordWin()
      expect(eco.money).toBe(4050)
    })

    it('resets consecutive losses', () => {
      const eco = new Economy(800)
      eco.recordLoss()
      eco.recordLoss()
      eco.recordWin()
      eco.recordLoss()
      expect(eco.money).toBe(800 + 1400 + 1900 + 3250 + 1400)
    })
  })

  describe('recordLoss', () => {
    it('first loss adds $1400', () => {
      const eco = new Economy(800)
      eco.recordLoss()
      expect(eco.money).toBe(2200)
    })

    it('second loss adds $1900', () => {
      const eco = new Economy(800)
      eco.recordLoss()
      eco.recordLoss()
      expect(eco.money).toBe(800 + 1400 + 1900)
    })

    it('third loss adds $2400', () => {
      const eco = new Economy(800)
      eco.recordLoss()
      eco.recordLoss()
      eco.recordLoss()
      expect(eco.money).toBe(800 + 1400 + 1900 + 2400)
    })

    it('caps bonus at $3400', () => {
      const eco = new Economy(0)
      for (let i = 0; i < 5; i++) eco.recordLoss()
      const expected = 1400 + 1900 + 2400 + 2900 + 3400
      expect(eco.money).toBe(expected)
    })
  })

  describe('recordKillReward', () => {
    it('awards $300 for pistol', () => {
      const eco = new Economy(0)
      eco.recordKillReward('pistol')
      expect(eco.money).toBe(300)
    })

    it('awards $600 for mp5', () => {
      const eco = new Economy(0)
      eco.recordKillReward('mp5')
      expect(eco.money).toBe(600)
    })

    it('awards $900 for shotgun', () => {
      const eco = new Economy(0)
      eco.recordKillReward('shotgun')
      expect(eco.money).toBe(900)
    })

    it('awards $100 for awp', () => {
      const eco = new Economy(0)
      eco.recordKillReward('awp')
      expect(eco.money).toBe(100)
    })

    it('awards $1500 for knife', () => {
      const eco = new Economy(0)
      eco.recordKillReward('knife')
      expect(eco.money).toBe(1500)
    })

    it('awards $300 for unknown weapon', () => {
      const eco = new Economy(0)
      eco.recordKillReward('unknown')
      expect(eco.money).toBe(300)
    })
  })

  describe('recordBombPlant', () => {
    it('adds $300', () => {
      const eco = new Economy(800)
      eco.recordBombPlant()
      expect(eco.money).toBe(1100)
    })
  })
})