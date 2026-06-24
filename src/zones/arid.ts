import type { ZoneDef, ZoneStructure } from './ZoneDef'
import { DAYLIGHT } from './ZoneDef'
import { doorway, stairs } from './buildings'

// Arid — desert zone in box-geometry ZoneDef format.
//
// Coordinate orientation (top-down radar view):
//   +x = east  (A Long / A Site)
//   -x = west  (B Tunnels / B Site)
//   +z = south (T spawn)
//   -z = north (CT spawn)
//
// Arena ±50 (100×100 world units).  One unit ≈ 50 Hammer units.
//
// Corridor widths:
//   Long A     x +38 → +50   (12 units, west wall at x=+38)
//   Mid        x  -2 → +8    (10 units, walls at x=-2 and x=+8)
//   B Tunnels  x -38 → -50   (12 units, east wall at x=-38)

type Mat = ZoneStructure['material']

const box = (
  center: [number, number, number],
  size: [number, number, number],
  material: Mat,
): ZoneStructure => ({ center, size, material })

const platform = (cx: number, cz: number, w: number, d: number, h: number, mat: Mat): ZoneStructure =>
  box([cx, h / 2, cz], [w, h, d], mat)

const ceiling = (cx: number, cz: number, w: number, d: number): ZoneStructure =>
  box([cx, 5.25, cz], [w, 0.5, d], 'concrete')

const crateStack = (x: number, z: number): ZoneStructure[] => [
  box([x, 1, z], [2, 2, 2], 'crate'),
  box([x + 2, 1, z], [2, 2, 2], 'crate'),
  box([x + 1, 2.6, z], [2, 1.4, 2], 'crate'),
]

const WH = 5   // wall height (matches buildings.ts WALL_H)
const WT = 0.5 // wall thickness (matches buildings.ts WALL_THICK)

// Solid wall segment helper (axis-aligned box at wall height)
const wallX = (x1: number, x2: number, z: number, mat: Mat = 'wall'): ZoneStructure =>
  box([(x1 + x2) / 2, WH / 2, z], [Math.abs(x2 - x1), WH, WT], mat)
const wallZ = (x: number, z1: number, z2: number, mat: Mat = 'wall'): ZoneStructure =>
  box([x, WH / 2, (z1 + z2) / 2], [WT, WH, Math.abs(z2 - z1)], mat)

export const ARID: ZoneDef = {
  id: 'arid',
  name: 'Arid',
  description: 'Four-lane desert zone: Mid, A Long, A Short, and B Tunnels.',
  arenaSize: 50,
  skyColor: 0x8ab4d8,  // warm blue sky
  fogNear: 40,
  fogFar: 120,
  floorColor: 0xc2a470,
  lighting: {
    ...DAYLIGHT,
    ambientColor: 0xc8b890,
    ambientIntensity: 0.8,
    sunColor: 0xfff0c8,
    sunIntensity: 1.2,
    sunPosition: [20, 40, 15],
  },
  structures: [

    // ══════════════════════════════════════════════════
    // T SPAWN  (south courtyard, z +33 → +50)
    // Three exits: B Tunnels (x -14..-8), Mid (x -2..+8), Long approach (x +22..+38)
    // ══════════════════════════════════════════════════

    // North wall of T spawn — three segments with three gaps
    wallX(-22, -14, 33),          // far-left segment
    wallX(-8,   -2, 33),          // between B and Mid openings
    wallX( +8, +22, 33),          // between Mid and Long openings
    // (east of x=+22 is open — Long approach starts here)

    // West boundary of T spawn (T side)
    wallZ(-22, 33, 50),

    // T-spawn cover
    box([ 14, 1, 42], [2, 2, 2], 'crate'),   // Long-side cover
    box([-14, 1, 42], [2, 2, 2], 'crate'),   // B-side cover
    box([  2, 1, 38], [3, 2, 2], 'wood'),    // central mid cover

    // ══════════════════════════════════════════════════
    // MID  (x -2 → +8, north-south spine)
    // ══════════════════════════════════════════════════

    // West wall of Mid: z from +33 (T spawn) to -24 (CT area)
    wallZ(-2, -24, 33),

    // East wall of Mid: z from +33 down to where A Short catwalk begins (z ~+8)
    wallZ(+8, +8, 33),
    // (gap from z +8 to z -5 is the catwalk / short approach connection)

    // Mid Doors at z=-5 — iconic double-door chokepoint
    ...doorway(3, -5, 10, 'x', true),    // x -2 → +8, door gap in the centre

    // Xbox — the legendary crate just south of Mid Doors
    box([5, 1, -2], [2, 2, 2], 'crate'),

    // Top-mid wall on CT side (closes the sightline north of doors)
    wallZ(+8, -5, -10),

    // ══════════════════════════════════════════════════
    // A SHORT / CATWALK  (elevated path Mid → A Site)
    // ══════════════════════════════════════════════════

    // Stairs up from Mid floor to catwalk
    ...stairs(8, 10, 2, 'east'),
    // Catwalk platform (elev ~2.2) — runs east from mid to A short
    platform(16,  8, 14, 5, 2.2, 'metal'),
    // Short corner / ledge overlooking CT
    platform(24, -6,  5, 8, 2.2, 'concrete'),
    // Railing / guard wall on catwalk south edge
    wallX( 8, 24, 11, 'concrete'),

    // ══════════════════════════════════════════════════
    // LONG A APPROACH  (T-side open area leading to Long)
    // ══════════════════════════════════════════════════

    // Divider wall between Long approach and the open mid area
    // Runs from T spawn north wall (z=+33) to Long Doors (z≈+18)
    wallZ(+38, 18, 33),

    // Long Doors — two sequential bottlenecks squeezing into Long
    ...doorway(44, 26, 12, 'x', true),  // outer doors (z=+26)
    ...doorway(44, 21, 12, 'x', true),  // inner doors (z=+21)

    // A Car — burnt sedan on the Long approach ramp side
    box([34, 1.2, 8], [4, 2.4, 7], 'metal'),

    // ══════════════════════════════════════════════════
    // LONG A CORRIDOR  (x +38 → +50, narrow east lane)
    // ══════════════════════════════════════════════════

    // West wall of Long A corridor: z from +18 (after Long Doors) north to Pit
    wallZ(+38, -12, 18),

    // The Pit — sniper nook at the north (CT) end of Long A
    box([49, 0.7, -5], [WT, 1.4, 10], 'concrete'),   // east wall of Pit
    box([44, 0.7,  1], [10, 1.4, WT], 'concrete'),   // south wall of Pit
    box([44, 0.7, -9], [10, 1.4, WT], 'concrete'),   // north wall of Pit

    // ══════════════════════════════════════════════════
    // A SITE  (north-east, x +20 → +48, z -12 → -32)
    // ══════════════════════════════════════════════════

    // Ramp from Long A up to A site
    ...stairs(36, -12, 3, 'north'),

    // A site platform (default plant spot)
    platform(32, -22, 14, 8, 2, 'concrete'),

    // Back wall of A site (north)
    wallX(20, 48, -30, 'wall'),

    // Goose — recessed alcove in the back-right corner
    wallZ(43, -22, -30, 'wall'),
    wallZ(47, -22, -30, 'wall'),

    // A Short wall connecting Short to A site (west side of A)
    wallZ(+20, -12, -30, 'wall'),

    // Site crates
    ...crateStack(26, -20),
    box([40, 1, -16], [2, 2, 3], 'crate'),

    // ══════════════════════════════════════════════════
    // B TUNNELS  (x -38 → -50, enclosed corridors)
    // Upper Tunnel: z +38 → +10  |  Lower Tunnel / approach: z +10 → -10
    // ══════════════════════════════════════════════════

    // East wall of B Tunnels corridor (inner tunnel wall)
    wallZ(-38, -10, 38),

    // Tunnel ceilings — makes it feel like actual enclosed tunnels
    ceiling(-44, +24, 12, 28),   // upper-tunnel ceiling  (z +10 → +38)
    ceiling(-44,  0, 12, 20),   // lower-tunnel ceiling  (z -10 → +10)

    // Upper tunnel mouth (entry from T spawn / B approach)
    ...doorway(-44, 38, 12, 'x', true),

    // Lower Tunnel stairs (branch going east toward B site)
    ...stairs(-22, 8, 3, 'east'),

    // ══════════════════════════════════════════════════
    // B SITE  (north-west, x -22 → -48, z -8 → -30)
    // ══════════════════════════════════════════════════

    // North wall of B site
    wallX(-22, -48, -28, 'wall'),
    // West wall of B site
    wallZ(-44, -8, -28, 'wall'),

    // B Doors — the main entry from Mid/CT into B
    ...doorway(-30, -10, 14, 'x', true),

    // The Window — gap in the east wall (low sill + high lintel)
    wallZ(-24, -10, -20, 'wall'),   // sill (low)  — stands 0→WH, gap punched in above
    box([-24, 1, -15], [WT, 2, 10], 'wall'),    // low sill block
    box([-24, 4.5, -15], [WT, 1, 10], 'wall'),  // lintel block
    // (middle is the open window)

    // Humvee / car parked inside B site
    box([-30, 1.5, -17], [4, 2.5, 7], 'metal'),

    // B site crates
    ...crateStack(-40, -22),
    box([-28, 1, -22], [2, 2, 2], 'crate'),

    // ══════════════════════════════════════════════════
    // CT SPAWN  (north-centre, z -34 → -46)
    // ══════════════════════════════════════════════════

    // Back wall of CT spawn
    ...doorway(-2, -38, 20, 'x', false),   // x -12 → +8

    // CT spawn cover
    box([-10, 1, -33], [3, 2, 3], 'concrete'),
    box([  6, 1, -35], [3, 2, 3], 'concrete'),

  ],

  // Spawn clusters inside their respective courtyards, clear of geometry.
  tSpawns:  [[-2, 44], [6, 44], [-8, 43], [4, 46]],
  ctSpawns: [[-4, -36], [4, -37], [-10, -36], [8, -35]],

  bombsites: [
    { id: 'A', center: [32, -22] },
    { id: 'B', center: [-34, -20] },
  ],
}
