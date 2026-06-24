import type { ZoneDef, ZoneStructure, ZoneBombsite } from './ZoneDef'

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

// ─── Task 4: Structure Generation Helpers ────────────────────────────────────

const WALL_GRID_STEP = 10
const WALL_HEIGHT = 5
const WALL_THICKNESS = 0.5
const WALL_CHANCE = 0.6

const COVER_MATERIALS: ZoneStructure['material'][] = ['crate', 'metal', 'wood']
const COVER_MIN_SIZE = 2
const COVER_MAX_SIZE = 4
const COVER_MIN_RATIO = 0.3
const COVER_MAX_RATIO = 0.5

const SPAWN_COUNT = 4

/**
 * Generate corridor walls along grid lines.
 * Walls are placed on grid lines (step 10) with 60% chance per line segment.
 * Each wall has height 5 and thickness 0.5.
 */
export function generateWalls(
  seed: GenerationSeed,
  constraints: GenerationConstraints
): ZoneStructure[] {
  const walls: ZoneStructure[] = []
  const { arenaSize } = constraints
  const range = Math.floor(arenaSize / WALL_GRID_STEP)

  // Horizontal walls (along X axis, fixed Z grid lines)
  const halfThickness = WALL_THICKNESS / 2
  const zMax = arenaSize - halfThickness
  for (let gz = -range; gz <= range; gz++) {
    const z = gz * WALL_GRID_STEP
    if (Math.abs(z) > zMax) continue // skip grid lines where thickness would exceed arena
    if (seed.next() < WALL_CHANCE) {
      // Place a wall segment along X at this Z
      const segLength = (range * WALL_GRID_STEP) * (0.5 + seed.next() * 0.5)
      const startX = -range * WALL_GRID_STEP + seed.next() * (2 * range * WALL_GRID_STEP - segLength)
      const centerX = startX + segLength / 2
      // Clamp so the wall stays within arena bounds
      const halfLenX = segLength / 2
      const clampedCenterX = Math.max(-arenaSize + halfLenX, Math.min(arenaSize - halfLenX, centerX))
      walls.push({
        center: [clampedCenterX, WALL_HEIGHT / 2, z],
        size: [segLength, WALL_HEIGHT, WALL_THICKNESS],
        material: 'wall',
      })
    }
  }

  // Vertical walls (along Z axis, fixed X grid lines)
  const xMax = arenaSize - halfThickness
  for (let gx = -range; gx <= range; gx++) {
    const x = gx * WALL_GRID_STEP
    if (Math.abs(x) > xMax) continue // skip grid lines where thickness would exceed arena
    if (seed.next() < WALL_CHANCE) {
      const segLength = (range * WALL_GRID_STEP) * (0.5 + seed.next() * 0.5)
      const startZ = -range * WALL_GRID_STEP + seed.next() * (2 * range * WALL_GRID_STEP - segLength)
      const centerZ = startZ + segLength / 2
      // Clamp so the wall stays within arena bounds
      const halfLenZ = segLength / 2
      const clampedCenterZ = Math.max(-arenaSize + halfLenZ, Math.min(arenaSize - halfLenZ, centerZ))
      walls.push({
        center: [x, WALL_HEIGHT / 2, clampedCenterZ],
        size: [WALL_THICKNESS, WALL_HEIGHT, segLength],
        material: 'wall',
      })
    }
  }

  return walls
}

/**
 * Generate cover structures (crates, metal boxes, wood boxes).
 * Count is 30-50% of minStructures. Size ranges from 2 to 4.
 */
export function generateCover(
  seed: GenerationSeed,
  constraints: GenerationConstraints
): ZoneStructure[] {
  const cover: ZoneStructure[] = []
  const { arenaSize, minStructures } = constraints
  const count = Math.floor(
    minStructures * (COVER_MIN_RATIO + seed.next() * (COVER_MAX_RATIO - COVER_MIN_RATIO))
  )

  for (let i = 0; i < count; i++) {
    const material = COVER_MATERIALS[seed.nextInt(0, COVER_MATERIALS.length - 1)]
    const w = seed.nextInt(COVER_MIN_SIZE, COVER_MAX_SIZE)
    const h = seed.nextInt(COVER_MIN_SIZE, COVER_MAX_SIZE)
    const d = seed.nextInt(COVER_MIN_SIZE, COVER_MAX_SIZE)
    const x = seed.nextInt(-arenaSize + w, arenaSize - w)
    const z = seed.nextInt(-arenaSize + d, arenaSize - d)

    cover.push({
      center: [x, h / 2, z],
      size: [w, h, d],
      material,
    })
  }

  return cover
}

/**
 * Generate spawn points: 4 T spawns in the south (z > 0) and 4 CT spawns in the north (z < 0).
 */
export function generateSpawns(
  seed: GenerationSeed,
  constraints: GenerationConstraints
): { tSpawns: [number, number][]; ctSpawns: [number, number][] } {
  const { arenaSize } = constraints
  const tSpawns: [number, number][] = []
  const ctSpawns: [number, number][] = []

  const southZoneStart = Math.floor(arenaSize * 0.3)
  const southZoneEnd = Math.floor(arenaSize * 0.8)
  const northZoneStart = -southZoneEnd
  const northZoneEnd = -southZoneStart

  for (let i = 0; i < SPAWN_COUNT; i++) {
    const x = seed.nextInt(-arenaSize + 2, arenaSize - 2)
    const z = seed.nextInt(southZoneStart, southZoneEnd)
    tSpawns.push([x, z])
  }

  for (let i = 0; i < SPAWN_COUNT; i++) {
    const x = seed.nextInt(-arenaSize + 2, arenaSize - 2)
    const z = seed.nextInt(northZoneStart, northZoneEnd)
    ctSpawns.push([x, z])
  }

  return { tSpawns, ctSpawns }
}

/**
 * Generate bombsites: A on the east (x > 0) and B on the west (x < 0).
 */
export function generateBombsites(
  seed: GenerationSeed,
  constraints: GenerationConstraints
): ZoneBombsite[] {
  const { arenaSize } = constraints

  const aX = seed.nextInt(Math.floor(arenaSize * 0.3), Math.floor(arenaSize * 0.8))
  const aZ = seed.nextInt(-Math.floor(arenaSize * 0.6), Math.floor(arenaSize * 0.6))

  const bX = seed.nextInt(-Math.floor(arenaSize * 0.8), -Math.floor(arenaSize * 0.3))
  const bZ = seed.nextInt(-Math.floor(arenaSize * 0.6), Math.floor(arenaSize * 0.6))

  return [
    { id: 'A', center: [aX, aZ] },
    { id: 'B', center: [bX, bZ] },
  ]
}

// ─── Task 5: Main Generator Function ─────────────────────────────────────────

/** Preset floor colors for random generation. */
const FLOOR_COLORS: number[] = [
  0xc4a882, // sand
  0x8b8b8b, // grey concrete
  0x6b4e37, // dirt brown
  0x4a5a3a, // moss green
  0x3a3a4a, // dark stone
  0xd4c4a8, // light sandstone
]

/** Preset sky colors for random generation. */
const SKY_COLORS: number[] = [
  0x87ceeb, // sky blue
  0x4a6fa5, // dusk blue
  0xffd4a0, // sunset orange
  0x9ab,    // overcast grey-blue
  0x6c8ebf, // twilight
]

/** Preset lighting configurations. */
const LIGHTING_PRESETS: ZoneDef['lighting'][] = [
  // DAYLIGHT preset
  {
    ambientColor: 0xb0b8c0,
    ambientIntensity: 0.7,
    sunColor: 0xfff4e0,
    sunIntensity: 1.1,
    sunPosition: [20, 30, 10],
  },
  // SUNSET preset
  {
    ambientColor: 0xd4a076,
    ambientIntensity: 0.5,
    sunColor: 0xff8c42,
    sunIntensity: 1.3,
    sunPosition: [30, 10, 5],
  },
  // OVERCAST preset
  {
    ambientColor: 0x9090a0,
    ambientIntensity: 0.9,
    sunColor: 0xccccdd,
    sunIntensity: 0.6,
    sunPosition: [10, 40, 20],
  },
  // NIGHT preset
  {
    ambientColor: 0x202040,
    ambientIntensity: 0.3,
    sunColor: 0x8090b0,
    sunIntensity: 0.4,
    sunPosition: [-10, 20, 30],
  },
  // BRIGHT preset
  {
    ambientColor: 0xd0d8e0,
    ambientIntensity: 0.8,
    sunColor: 0xffffff,
    sunIntensity: 1.4,
    sunPosition: [15, 35, 15],
  },
]

/** Zone name prefixes for random name generation. */
const ZONE_NAME_PREFIXES = [
  'Desert', 'Urban', 'Industrial', 'Arctic', 'Tropical', 'Underground',
  'Rooftop', 'Warehouse', 'Plaza', 'Bunker', 'Outpost', 'Compound',
]

/** Zone name suffixes. */
const ZONE_NAME_SUFFIXES = [
  'Arena', 'Zone', 'District', 'Sector', 'Grounds', 'Yard',
  'Complex', 'Station', 'Alley', 'Fortress', 'Ruins', 'Crossing',
]

/** Zone description templates. */
const ZONE_DESCRIPTIONS = [
  'A contested area with strategic cover positions.',
  'Close-quarters combat with multiple flanking routes.',
  'Open sightlines balanced with hard cover.',
  'Abandoned facilities provide tactical advantages.',
  'Dense urban environment with vertical gameplay.',
  'Wide open spaces with scattered fortifications.',
  'Tight corridors connect open engagement areas.',
  'Multi-level terrain creates dynamic encounters.',
]

/**
 * Generate a complete random zone definition.
 *
 * @param seed - Optional seed value. If omitted, uses Date.now().
 * @param constraints - Optional generation constraints. Defaults to DEFAULT_CONSTRAINTS.
 * @returns A valid ZoneDef with id='random'.
 */
export function generateRandomZone(
  seed?: number,
  constraints?: GenerationConstraints
): ZoneDef {
  const effectiveConstraints = constraints ?? DEFAULT_CONSTRAINTS
  const s = createSeed(seed)

  // Generate structures (walls + cover)
  const walls = generateWalls(s, effectiveConstraints)
  const cover = generateCover(s, effectiveConstraints)
  const structures = [...walls, ...cover]

  // Generate spawns and bombsites
  const { tSpawns, ctSpawns } = generateSpawns(s, effectiveConstraints)
  const bombsites = generateBombsites(s, effectiveConstraints)

  // Pick random presets
  const floorColor = FLOOR_COLORS[s.nextInt(0, FLOOR_COLORS.length - 1)]
  const lighting = LIGHTING_PRESETS[s.nextInt(0, LIGHTING_PRESETS.length - 1)]
  const skyColor = SKY_COLORS[s.nextInt(0, SKY_COLORS.length - 1)]

  // Generate name and description
  const name = ZONE_NAME_PREFIXES[s.nextInt(0, ZONE_NAME_PREFIXES.length - 1)] +
    ' ' +
    ZONE_NAME_SUFFIXES[s.nextInt(0, ZONE_NAME_SUFFIXES.length - 1)]
  const description = ZONE_DESCRIPTIONS[s.nextInt(0, ZONE_DESCRIPTIONS.length - 1)]

  return {
    id: 'random',
    name,
    description,
    arenaSize: effectiveConstraints.arenaSize,
    floorColor,
    skyColor,
    lighting,
    structures,
    ctSpawns,
    tSpawns,
    bombsites,
  }
}
