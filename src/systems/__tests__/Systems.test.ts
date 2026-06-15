import { describe, it, expect } from 'vitest'
import { HealthSystem } from '../HealthSystem'
import { ScoreSystem } from '../ScoreSystem'

describe('HealthSystem', () => {
  it('initializes with max health', () => {
    const health = new HealthSystem()
    expect(health.health).toBe(100)
    expect(health.isDead).toBe(false)
  })

  it('takes damage', () => {
    const health = new HealthSystem()
    const hit = health.takeDamage(30)
    expect(hit).toBe(true)
    expect(health.health).toBe(70)
  })

  it('dies at 0 health', () => {
    const health = new HealthSystem()
    health.takeDamage(100)
    expect(health.isDead).toBe(true)
  })

  it('is invincible after hit', () => {
    const health = new HealthSystem()
    health.takeDamage(10)
    health.takeDamage(10)
    expect(health.health).toBe(90)
  })

  it('heals', () => {
    const health = new HealthSystem()
    health.takeDamage(50)
    health.heal(30)
    expect(health.health).toBe(80)
  })

  it('resets to full health', () => {
    const health = new HealthSystem()
    health.takeDamage(50)
    health.reset()
    expect(health.health).toBe(100)
    expect(health.isDead).toBe(false)
  })
})

describe('ScoreSystem', () => {
  it('starts at 0', () => {
    const score = new ScoreSystem()
    expect(score.score).toBe(0)
    expect(score.wave).toBe(0)
  })

  it('adds kill points', () => {
    const score = new ScoreSystem()
    score.addKill(100)
    expect(score.score).toBe(100)
  })

  it('completes wave and adds bonus', () => {
    const score = new ScoreSystem()
    score.completeWave()
    expect(score.wave).toBe(1)
    expect(score.score).toBe(500)
  })

  it('saves high score to localStorage', () => {
    const score = new ScoreSystem()
    score.addKill(1000)
    score.saveHighScore()
    expect(score.highScore).toBe(1000)
  })

  it('resets score', () => {
    const score = new ScoreSystem()
    score.addKill(500)
    score.completeWave()
    score.reset()
    expect(score.score).toBe(0)
    expect(score.wave).toBe(0)
  })
})
