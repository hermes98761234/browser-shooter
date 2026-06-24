export interface GenerationSeed {
  value: number
  next(): number
  nextInt(min: number, max: number): number
}

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createSeed(value?: number): GenerationSeed {
  const seedValue = value ?? Date.now()
  const rng = mulberry32(seedValue)

  return {
    value: seedValue,
    next: () => rng(),
    nextInt: (min: number, max: number) => {
      return Math.floor(rng() * (max - min + 1)) + min
    },
  }
}

/**
 * Constraints that bound the random map generation.
 */
export interface GenerationConstraints {
  /** Fixed arena half-extent (world units). Default: 50 */
  arenaSize: number
  /** Minimum number of structures to place. Default: 30 */
  minStructures: number
  /** Maximum number of structures to place. Default: 60 */
  maxStructures: number
  /** Structure fill density (0-1). Default: 0.4 */
  structureDensity: number
  /** Ensure connectivity between spawns. Default: true */
  ensureConnectivity: boolean
}

/**
 * Default generation constraints used when none are provided.
 */
export const DEFAULT_CONSTRAINTS: GenerationConstraints = {
  arenaSize: 50,
  minStructures: 30,
  maxStructures: 60,
  structureDensity: 0.4,
  ensureConnectivity: true,
}
