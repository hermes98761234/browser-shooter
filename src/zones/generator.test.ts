import { describe, it, expect } from 'vitest'
import { createSeed, DEFAULT_CONSTRAINTS } from './generator'
import type { GenerationConstraints } from './generator'

describe('createSeed', () => {
  it('creates a seed with deterministic output', () => {
    const seed1 = createSeed(12345)
    const seed2 = createSeed(12345)
    expect(seed1.next()).toBe(seed2.next())
    expect(seed1.nextInt(0, 100)).toBe(seed2.nextInt(0, 100))
  })

  it('produces different output for different seeds', () => {
    const seed1 = createSeed(11111)
    const seed2 = createSeed(99999)
    const results1 = Array.from({ length: 10 }, () => seed1.next())
    const seed1b = createSeed(11111)
    const results1b = Array.from({ length: 10 }, () => seed1b.next())
    const results2 = Array.from({ length: 10 }, () => seed2.next())
    expect(results1).toEqual(results1b)
    expect(results1).not.toEqual(results2)
  })

  it('next() returns values between 0 and 1', () => {
    const seed = createSeed(Date.now())
    for (let i = 0; i < 100; i++) {
      const val = seed.next()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it('nextInt() returns integers within range', () => {
    const seed = createSeed(Date.now())
    for (let i = 0; i < 100; i++) {
      const val = seed.nextInt(5, 15)
      expect(val).toBeGreaterThanOrEqual(5)
      expect(val).toBeLessThanOrEqual(15)
      expect(Number.isInteger(val)).toBe(true)
    }
  })
})

describe('GenerationConstraints', () => {
  it('is a type that accepts all constraint fields', () => {
    const c: GenerationConstraints = {
      arenaSize: 50,
      minStructures: 5,
      maxStructures: 20,
      structureDensity: 0.4,
      ensureConnectivity: true,
    }
    expect(c.arenaSize).toBe(50)
    expect(c.minStructures).toBe(5)
    expect(c.maxStructures).toBe(20)
    expect(c.structureDensity).toBe(0.4)
    expect(c.ensureConnectivity).toBe(true)
  })
})

describe('DEFAULT_CONSTRAINTS', () => {
  it('provides sensible default values', () => {
    expect(DEFAULT_CONSTRAINTS.arenaSize).toBeTypeOf('number')
    expect(DEFAULT_CONSTRAINTS.minStructures).toBeTypeOf('number')
    expect(DEFAULT_CONSTRAINTS.maxStructures).toBeTypeOf('number')
    expect(DEFAULT_CONSTRAINTS.structureDensity).toBeTypeOf('number')
    expect(DEFAULT_CONSTRAINTS.ensureConnectivity).toBeTypeOf('boolean')
  })

  it('has the correct default values per spec', () => {
    expect(DEFAULT_CONSTRAINTS.arenaSize).toBe(50)
    expect(DEFAULT_CONSTRAINTS.minStructures).toBe(30)
    expect(DEFAULT_CONSTRAINTS.maxStructures).toBe(60)
    expect(DEFAULT_CONSTRAINTS.structureDensity).toBe(0.4)
    expect(DEFAULT_CONSTRAINTS.ensureConnectivity).toBe(true)
  })

  it('has min <= max for structure fields', () => {
    expect(DEFAULT_CONSTRAINTS.minStructures).toBeLessThanOrEqual(DEFAULT_CONSTRAINTS.maxStructures)
  })

  it('structureDensity is between 0 and 1', () => {
    expect(DEFAULT_CONSTRAINTS.structureDensity).toBeGreaterThanOrEqual(0)
    expect(DEFAULT_CONSTRAINTS.structureDensity).toBeLessThanOrEqual(1)
  })

  it('matches the GenerationConstraints type', () => {
    const c: GenerationConstraints = DEFAULT_CONSTRAINTS
    expect(c).toBeDefined()
  })
})
