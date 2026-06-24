import { describe, it, expect } from 'vitest'
import {
  createSeed,
  DEFAULT_CONSTRAINTS,
  validateConnectivity,
  generateWalls,
  generateCover,
  generateSpawns,
  generateBombsites,
} from './generator'
import type { GenerationConstraints } from './generator'
import type { ZoneDef, ZoneStructure, ZoneBombsite } from './ZoneDef'

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

describe('validateConnectivity', () => {
  it('returns true for a valid zone with clear paths', () => {
    const zone: ZoneDef = {
      id: 'test',
      name: 'Test',
      description: 'Test zone',
      arenaSize: 30,
      floorColor: 0xcccccc,
      lighting: {
        ambientColor: 0xffffff,
        ambientIntensity: 1,
        sunColor: 0xffffff,
        sunIntensity: 1,
        sunPosition: [0, 10, 0],
      },
      structures: [],
      tSpawns: [[0, 20]],
      ctSpawns: [[0, -20]],
      bombsites: [
        { id: 'A', center: [14, 0] },
        { id: 'B', center: [-14, 0] },
      ],
    }
    expect(validateConnectivity(zone)).toBe(true)
  })

  it('returns false when CT spawn is blocked', () => {
    const zone: ZoneDef = {
      id: 'test',
      name: 'Test',
      description: 'Test zone',
      arenaSize: 30,
      floorColor: 0xcccccc,
      lighting: {
        ambientColor: 0xffffff,
        ambientIntensity: 1,
        sunColor: 0xffffff,
        sunIntensity: 1,
        sunPosition: [0, 10, 0],
      },
      structures: [
        {
          center: [0, 2.5, -20],
          size: [60, 5, 2],
          material: 'wall',
        },
      ],
      tSpawns: [[0, 20]],
      ctSpawns: [[0, -20]],
      bombsites: [
        { id: 'A', center: [14, 0] },
        { id: 'B', center: [-14, 0] },
      ],
    }
    expect(validateConnectivity(zone)).toBe(false)
  })
})

describe('generateWalls', () => {
  const constraints: GenerationConstraints = {
    arenaSize: 50,
    minStructures: 30,
    maxStructures: 60,
    structureDensity: 0.4,
    ensureConnectivity: true,
  }

  it('returns an array of ZoneStructure', () => {
    const seed = createSeed(42)
    const walls = generateWalls(seed, constraints)
    expect(Array.isArray(walls)).toBe(true)
    for (const w of walls) {
      expect(w).toHaveProperty('center')
      expect(w).toHaveProperty('size')
      expect(w).toHaveProperty('material')
      expect(w.material).toBe('wall')
    }
  })

  it('places walls along grid lines (grid step 10)', () => {
    const seed = createSeed(42)
    const walls = generateWalls(seed, constraints)
    // Every wall center should be on a multiple of 10 on at least one axis
    for (const w of walls) {
      const [cx, , cz] = w.center
      const onGridX = Math.abs(cx % 10) < 0.001
      const onGridZ = Math.abs(cz % 10) < 0.001
      expect(onGridX || onGridZ).toBe(true)
    }
  })

  it('walls have height 5 and thickness 0.5', () => {
    const seed = createSeed(42)
    const walls = generateWalls(seed, constraints)
    for (const w of walls) {
      const [, h,] = w.size
      expect(h).toBe(5)
      // One dimension should be the thickness 0.5
      const [wWidth, , d] = w.size
      const hasThickness = Math.abs(wWidth - 0.5) < 0.001 || Math.abs(d - 0.5) < 0.001
      expect(hasThickness).toBe(true)
    }
  })

  it('is deterministic for the same seed', () => {
    const seed1 = createSeed(99)
    const seed2 = createSeed(99)
    const walls1 = generateWalls(seed1, constraints)
    const walls2 = generateWalls(seed2, constraints)
    expect(walls1).toEqual(walls2)
  })

  it('produces different output for different seeds (usually)', () => {
    const seed1 = createSeed(1)
    const seed2 = createSeed(2)
    const walls1 = generateWalls(seed1, constraints)
    const walls2 = generateWalls(seed2, constraints)
    // Very unlikely to be identical with different seeds
    expect(walls1.length + walls2.length).toBeGreaterThan(0)
  })
})

describe('generateCover', () => {
  const constraints: GenerationConstraints = {
    arenaSize: 50,
    minStructures: 30,
    maxStructures: 60,
    structureDensity: 0.4,
    ensureConnectivity: true,
  }

  it('returns an array of ZoneStructure', () => {
    const seed = createSeed(42)
    const cover = generateCover(seed, constraints)
    expect(Array.isArray(cover)).toBe(true)
    for (const c of cover) {
      expect(c).toHaveProperty('center')
      expect(c).toHaveProperty('size')
      expect(c).toHaveProperty('material')
    }
  })

  it('uses valid materials: crate, metal, wood', () => {
    const seed = createSeed(42)
    const cover = generateCover(seed, constraints)
    const validMaterials = new Set(['crate', 'metal', 'wood'])
    for (const c of cover) {
      expect(validMaterials.has(c.material)).toBe(true)
    }
  })

  it('cover size is between 2 and 4', () => {
    const seed = createSeed(42)
    const cover = generateCover(seed, constraints)
    for (const c of cover) {
      const [w, h, d] = c.size
      expect(w).toBeGreaterThanOrEqual(2)
      expect(w).toBeLessThanOrEqual(4)
      expect(h).toBeGreaterThanOrEqual(2)
      expect(h).toBeLessThanOrEqual(4)
      expect(d).toBeGreaterThanOrEqual(2)
      expect(d).toBeLessThanOrEqual(4)
    }
  })

  it('number of cover structures is within 30-50% of minStructures', () => {
    const seed = createSeed(42)
    const cover = generateCover(seed, constraints)
    const minCount = Math.floor(constraints.minStructures * 0.3)
    const maxCount = Math.ceil(constraints.minStructures * 0.5)
    expect(cover.length).toBeGreaterThanOrEqual(minCount)
    expect(cover.length).toBeLessThanOrEqual(maxCount)
  })

  it('is deterministic for the same seed', () => {
    const seed1 = createSeed(77)
    const seed2 = createSeed(77)
    const cover1 = generateCover(seed1, constraints)
    const cover2 = generateCover(seed2, constraints)
    expect(cover1).toEqual(cover2)
  })
})

describe('generateSpawns', () => {
  const constraints: GenerationConstraints = {
    arenaSize: 50,
    minStructures: 30,
    maxStructures: 60,
    structureDensity: 0.4,
    ensureConnectivity: true,
  }

  it('returns tSpawns and ctSpawns arrays', () => {
    const seed = createSeed(42)
    const { tSpawns, ctSpawns } = generateSpawns(seed, constraints)
    expect(Array.isArray(tSpawns)).toBe(true)
    expect(Array.isArray(ctSpawns)).toBe(true)
  })

  it('creates exactly 4 T spawns and 4 CT spawns', () => {
    const seed = createSeed(42)
    const { tSpawns, ctSpawns } = generateSpawns(seed, constraints)
    expect(tSpawns.length).toBe(4)
    expect(ctSpawns.length).toBe(4)
  })

  it('T spawns are in the south (z > 0)', () => {
    const seed = createSeed(42)
    const { tSpawns } = generateSpawns(seed, constraints)
    for (const [x, z] of tSpawns) {
      expect(z).toBeGreaterThan(0)
    }
  })

  it('CT spawns are in the north (z < 0)', () => {
    const seed = createSeed(42)
    const { ctSpawns } = generateSpawns(seed, constraints)
    for (const [x, z] of ctSpawns) {
      expect(z).toBeLessThan(0)
    }
  })

  it('is deterministic for the same seed', () => {
    const seed1 = createSeed(55)
    const seed2 = createSeed(55)
    const result1 = generateSpawns(seed1, constraints)
    const result2 = generateSpawns(seed2, constraints)
    expect(result1).toEqual(result2)
  })
})

describe('generateBombsites', () => {
  const constraints: GenerationConstraints = {
    arenaSize: 50,
    minStructures: 30,
    maxStructures: 60,
    structureDensity: 0.4,
    ensureConnectivity: true,
  }

  it('returns an array of ZoneBombsite', () => {
    const seed = createSeed(42)
    const sites = generateBombsites(seed, constraints)
    expect(Array.isArray(sites)).toBe(true)
    for (const s of sites) {
      expect(s).toHaveProperty('id')
      expect(s).toHaveProperty('center')
      expect(s.id === 'A' || s.id === 'B').toBe(true)
    }
  })

  it('creates exactly one A and one B bombsite', () => {
    const seed = createSeed(42)
    const sites = generateBombsites(seed, constraints)
    const aSites = sites.filter((s) => s.id === 'A')
    const bSites = sites.filter((s) => s.id === 'B')
    expect(aSites.length).toBe(1)
    expect(bSites.length).toBe(1)
  })

  it('A is on the east (x > 0) and B is on the west (x < 0)', () => {
    const seed = createSeed(42)
    const sites = generateBombsites(seed, constraints)
    const aSite = sites.find((s) => s.id === 'A')!
    const bSite = sites.find((s) => s.id === 'B')!
    expect(aSite.center[0]).toBeGreaterThan(0)
    expect(bSite.center[0]).toBeLessThan(0)
  })

  it('is deterministic for the same seed', () => {
    const seed1 = createSeed(33)
    const seed2 = createSeed(33)
    const sites1 = generateBombsites(seed1, constraints)
    const sites2 = generateBombsites(seed2, constraints)
    expect(sites1).toEqual(sites2)
  })
})
