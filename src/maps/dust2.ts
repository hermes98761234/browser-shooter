import type { MapDef, MapStructure } from './MapDef'
import { DAYLIGHT } from './MapDef'
import { building, buildingWithRooms, stairs } from './buildings'

// Helper: create a crate stack (2 side-by-side + 1 on top)
function crateStack(x: number, z: number): MapStructure[] {
  return [
    { center: [x, 1, z], size: [2, 2, 2], material: 'crate' },
    { center: [x + 2, 1, z], size: [2, 2, 2], material: 'crate' },
    { center: [x + 1, 2.6, z], size: [2, 1.4, 2], material: 'crate' },
  ]
}

// Helper: create scattered cover objects
function coverCluster(x: number, z: number): MapStructure[] {
  return [
    { center: [x, 0.6, z], size: [4, 1.2, 1], material: 'concrete' },  // sandbag
    { center: [x + 3, 1, z + 1], size: [2, 2, 2], material: 'crate' },
    { center: [x - 1, 1, z + 2], size: [1.5, 2, 1.5], material: 'metal' },  // barrel
  ]
}

/**
 * Dust2 — redesigned with enterable buildings, alleys, elevated walkways,
 * and varied cover. Arena expanded to 80x80.
 */
export const DUST2: MapDef = {
  id: 'dust2',
  name: 'Dust II',
  description: 'Urban combat with buildings, alleys, and elevated positions.',
  arenaSize: 40,
  floorColor: 0xc2a878,
  lighting: DAYLIGHT,
  structures: [
    // === T SPAWN AREA (North) ===
    // Building T1: Large building with 2 rooms
    ...buildingWithRooms(-15, -30, 10, 8, 'south'),
    // Table and crates inside T1
    { center: [-17, 0.5, -30], size: [4, 1, 2], material: 'wood' },
    ...crateStack(-13, -32),
    
    // Building T2: Small guard post
    ...building(15, -28, 6, 6, 'south'),
    ...crateStack(14, -28),
    
    // === MID AREA ===
    // Central mid structure (smaller than before)
    { center: [0, 1.5, 0], size: [4, 3, 4], material: 'concrete' },
    
    // Elevated walkway (metal)
    { center: [0, 3, 0], size: [20, 0.3, 3], material: 'metal' },
    // Walkway supports
    { center: [-8, 1.5, 0], size: [1, 3, 1], material: 'concrete' },
    { center: [8, 1.5, 0], size: [1, 3, 1], material: 'concrete' },
    // Walkway railings
    { center: [0, 3.8, -1.5], size: [20, 0.8, 0.2], material: 'metal' },
    { center: [0, 3.8, 1.5], size: [20, 0.8, 0.2], material: 'metal' },
    
    // Stairs to walkway (east side)
    ...stairs(12, 0, 3, 'west'),
    // Stairs to walkway (west side)
    ...stairs(-12, 0, 3, 'east'),
    
    // Mid cover
    ...coverCluster(-6, -6),
    ...coverCluster(6, 6),
    ...crateStack(-4, 8),
    ...crateStack(4, -8),
    
    // === ALLEYS ===
    // North alley (T to mid)
    { center: [-8, 2, -18], size: [0.5, 4, 12], material: 'wall' },
    { center: [-4, 2, -18], size: [0.5, 4, 12], material: 'wall' },
    
    // South alley (mid to CT)
    { center: [8, 2, 18], size: [0.5, 4, 12], material: 'wall' },
    { center: [12, 2, 18], size: [0.5, 4, 12], material: 'wall' },
    
    // === BOMBSITE A (East - Indoor) ===
    // Building A: Large building with bombsite inside
    ...buildingWithRooms(28, 8, 12, 10, 'west'),
    // Raised platform inside
    { center: [30, 1, 8], size: [6, 2, 6], material: 'concrete' },
    // Cover inside
    ...crateStack(26, 6),
    { center: [32, 0.75, 10], size: [1.5, 1.5, 1.5], material: 'wood' },
    
    // === BOMBSITE B (West - Courtyard) ===
    // Courtyard walls (3 sides)
    { center: [-28, 2, -8], size: [12, 4, 0.5], material: 'wall' },  // north wall
    { center: [-28, 2, 8], size: [12, 4, 0.5], material: 'wall' },   // south wall
    { center: [-34, 2, 0], size: [0.5, 4, 16], material: 'wall' },   // west wall
    // East side open (entrance from mid)
    
    // Courtyard furniture
    { center: [-28, 0.4, -4], size: [3, 0.8, 1], material: 'concrete' },  // bench
    { center: [-28, 0.4, 4], size: [3, 0.8, 1], material: 'concrete' },   // bench
    { center: [-30, 1, 0], size: [2, 2, 2], material: 'wood' },           // planter
    
    // === CT SPAWN AREA (South) ===
    // Building CT1: Large building with 2 rooms (mirrors T1)
    ...buildingWithRooms(15, 30, 10, 8, 'north'),
    // Table and crates inside CT1
    { center: [17, 0.5, 30], size: [4, 1, 2], material: 'wood' },
    ...crateStack(13, 32),
    
    // Building CT2: Small guard post (mirrors T2)
    ...building(-15, 28, 6, 6, 'north'),
    ...crateStack(-14, 28),
    
    // === PERIMETER COVER ===
    // scattered cover around edges
    ...coverCluster(-20, -20),
    ...coverCluster(20, 20),
    ...coverCluster(-20, 20),
    ...coverCluster(20, -20),
  ],
  
  // Spawn points adjusted for 80x80 arena
  ctSpawns: [[-25, 25], [-30, 20], [-20, 30], [-25, 15]],
  tSpawns: [[25, -25], [30, -20], [20, -30], [25, -15]],
  
  // Bombsite positions
  bombsites: [
    { id: 'A', center: [30, 10] },  // Inside Building A
    { id: 'B', center: [-28, 0] },  // Center of Courtyard B
  ],
}
