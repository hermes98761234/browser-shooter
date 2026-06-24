import type { ZoneDef } from './ZoneDef'

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

/** Grid step size for the flood-fill connectivity check. */
const CONNECTIVITY_GRID_STEP = 2

/**
 * Returns true if the given (x, z) point lies inside any structure's AABB
 * on the XZ plane (treating structures as solid obstacles).
 */
function isBlockedByStructure(
  x: number,
  z: number,
  structures: ZoneDef['structures']
): boolean {
  for (const s of structures) {
    const [cx, , cz] = s.center
    const [sw, , sd] = s.size
    const halfW = sw / 2
    const halfD = sd / 2
    if (
      x >= cx - halfW &&
      x <= cx + halfW &&
      z >= cz - halfD &&
      z <= cz + halfD
    ) {
      return true
    }
  }
  return false
}

/**
 * Validates that all CT spawns and bombsites are reachable from at least one
 * T spawn, using a BFS flood-fill that treats structures as solid obstacles.
 *
 * Returns true if every CT spawn and every bombsite is reachable, false otherwise.
 * Returns false if there are no T spawns to start from.
 */
export function validateConnectivity(zone: ZoneDef): boolean {
  const { tSpawns, ctSpawns, bombsites, structures, arenaSize } = zone

  if (tSpawns.length === 0) return false
  if (ctSpawns.length === 0 && bombsites.length === 0) return true

  // Build set of target keys we need to reach
  const targets = new Set<string>()
  for (const [tx, tz] of ctSpawns) {
    targets.add(`${tx},${tz}`)
  }
  for (const b of bombsites) {
    targets.add(`${b.center[0]},${b.center[1]}`)
  }

  // BFS from all T spawns simultaneously
  const visited = new Set<string>()
  const queue: [number, number][] = []

  for (const [sx, sz] of tSpawns) {
    const key = `${sx},${sz}`
    if (!visited.has(key)) {
      visited.add(key)
      queue.push([sx, sz])
    }
  }

  const step = CONNECTIVITY_GRID_STEP
  let reachedCount = 0

  // Check if any spawn is itself a target
  for (const [sx, sz] of tSpawns) {
    const key = `${sx},${sz}`
    if (targets.has(key)) {
      reachedCount++
    }
  }

  while (queue.length > 0) {
    const [cx, cz] = queue.shift()!

    // Explore 4-neighbourhood (cardinal directions on the XZ plane)
    const neighbours: [number, number][] = [
      [cx + step, cz],
      [cx - step, cz],
      [cx, cz + step],
      [cx, cz - step],
    ]

    for (const [nx, nz] of neighbours) {
      // Stay within arena bounds
      if (nx < -arenaSize || nx > arenaSize || nz < -arenaSize || nz > arenaSize) {
        continue
      }

      const key = `${nx},${nz}`
      if (visited.has(key)) continue
      visited.add(key)

      // Skip if blocked by a structure
      if (isBlockedByStructure(nx, nz, structures)) continue

      // Check if this cell is a target
      if (targets.has(key)) {
        reachedCount++
        if (reachedCount >= targets.size) {
          return true
        }
      }

      queue.push([nx, nz])
    }
  }

  return reachedCount >= targets.size
}
