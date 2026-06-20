# Dust2 Map Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Dust2 map with enterable buildings, alleys, elevated walkways, varied cover, and expanded 80x80 arena

**Architecture:** Extend the existing MapStructure system with new materials (metal, wood) and use wall arrangements to create buildings with doorways. The map file will contain helper functions for building construction and detailed structure placement.

**Tech Stack:** TypeScript, Three.js, existing MapDef/MapStructure interfaces

## Global Constraints

- Arena size: 80x80 (arenaSize: 40)
- All structures must be AABB boxes (existing CollisionWorld system)
- Buildings are composed of wall segments with gaps for doorways
- Keep existing materials: wall (0x8a8577), crate (0x9c7a3c), concrete (0x707078)
- New materials: metal (0x6a6a72), wood (0x8b6b3c)
- Spawn points must not be inside buildings
- Bombsite A: [30, 10] (indoor), Bombsite B: [-28, 0] (courtyard)

---

### Task 1: Add New Material Types

**Files:**
- Modify: `src/maps/MapDef.ts:1-2`
- Modify: `src/engine/Arena.ts:11-21`

**Interfaces:**
- Consumes: None
- Produces: Extended `StructureMaterial` type with 'metal' and 'wood'

- [ ] **Step 1: Update StructureMaterial type**

```typescript
// src/maps/MapDef.ts
export type StructureMaterial = 'wall' | 'crate' | 'concrete' | 'metal' | 'wood'
```

- [ ] **Step 2: Add material definitions to Arena.ts**

```typescript
// src/engine/Arena.ts - add to materialFor() function
case 'metal':
  return new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.6, metalness: 0.4 })
case 'wood':
  return new THREE.MeshStandardMaterial({ color: 0x8b6b3c, roughness: 0.9, metalness: 0.0 })
```

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/maps/MapDef.ts src/engine/Arena.ts
git commit -m "feat: add metal and wood material types for map structures"
```

---

### Task 2: Create Building Helper Functions

**Files:**
- Create: `src/maps/buildings.ts`
- Test: `src/maps/buildings.test.ts`

**Interfaces:**
- Consumes: `MapStructure` type from MapDef.ts
- Produces: `building()`, `buildingWithRooms()`, `stairs()` helper functions

- [ ] **Step 1: Write failing tests for building helpers**

```typescript
// src/maps/buildings.test.ts
import { building, buildingWithRooms, stairs } from './buildings'
import type { MapStructure } from './MapDef'

describe('building helper', () => {
  it('creates a rectangular building with doorway', () => {
    const structures = building(0, 0, 8, 6, 'south')
    expect(structures.length).toBe(4) // 4 walls (north, east, west split for door)
    
    // Check north wall exists
    const northWall = structures.find(s => s.center[2] === -3)
    expect(northWall).toBeDefined()
    expect(northWall!.material).toBe('wall')
    
    // Check south wall has gap (two segments)
    const southWalls = structures.filter(s => s.center[2] === 3)
    expect(southWalls.length).toBe(2)
  })

  it('creates building with internal rooms', () => {
    const structures = buildingWithRooms(0, 0, 10, 8, 'south', 1)
    expect(structures.length).toBe(5) // 4 outer walls + 1 inner wall
  })
})

describe('stairs helper', () => {
  it('creates staircase with specified steps', () => {
    const structures = stairs(0, 0, 3, 'north')
    expect(structures.length).toBe(3)
    
    // Each step should be higher than previous
    expect(structures[0].center[1]).toBeLessThan(structures[1].center[1])
    expect(structures[1].center[1]).toBeLessThan(structures[2].center[1])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=buildings.test`
Expected: FAIL with "Cannot find module './buildings'"

- [ ] **Step 3: Implement building helpers**

```typescript
// src/maps/buildings.ts
import type { MapStructure } from './MapDef'

const WALL_H = 5
const WALL_THICK = 0.5
const DOOR_W = 2.5

/**
 * Creates a rectangular building with a doorway on the specified side.
 */
export function building(
  x: number, z: number,
  width: number, depth: number,
  doorSide: 'north' | 'south' | 'east' | 'west',
  doorOffset: number = 0
): MapStructure[] {
  const walls: MapStructure[] = []
  const halfW = width / 2
  const halfD = depth / 2
  
  // North wall (z - depth/2)
  if (doorSide === 'north') {
    const segW = (width - DOOR_W) / 2
    walls.push(
      { center: [x - halfW + segW/2, WALL_H/2, z - halfD], size: [segW, WALL_H, WALL_THICK], material: 'wall' },
      { center: [x + halfW - segW/2, WALL_H/2, z - halfD], size: [segW, WALL_H, WALL_THICK], material: 'wall' }
    )
  } else {
    walls.push({ center: [x, WALL_H/2, z - halfD], size: [width, WALL_H, WALL_THICK], material: 'wall' })
  }
  
  // South wall (z + depth/2)
  if (doorSide === 'south') {
    const segW = (width - DOOR_W) / 2
    walls.push(
      { center: [x - halfW + segW/2, WALL_H/2, z + halfD], size: [segW, WALL_H, WALL_THICK], material: 'wall' },
      { center: [x + halfW - segW/2, WALL_H/2, z + halfD], size: [segW, WALL_H, WALL_THICK], material: 'wall' }
    )
  } else {
    walls.push({ center: [x, WALL_H/2, z + halfD], size: [width, WALL_H, WALL_THICK], material: 'wall' })
  }
  
  // East wall (x + width/2)
  if (doorSide === 'east') {
    const segD = (depth - DOOR_W) / 2
    walls.push(
      { center: [x + halfW, WALL_H/2, z - halfD + segD/2], size: [WALL_THICK, WALL_H, segD], material: 'wall' },
      { center: [x + halfW, WALL_H/2, z + halfD - segD/2], size: [WALL_THICK, WALL_H, segD], material: 'wall' }
    )
  } else {
    walls.push({ center: [x + halfW, WALL_H/2, z], size: [WALL_THICK, WALL_H, depth], material: 'wall' })
  }
  
  // West wall (x - width/2)
  if (doorSide === 'west') {
    const segD = (depth - DOOR_W) / 2
    walls.push(
      { center: [x - halfW, WALL_H/2, z - halfD + segD/2], size: [WALL_THICK, WALL_H, segD], material: 'wall' },
      { center: [x - halfW, WALL_H/2, z + halfD - segD/2], size: [WALL_THICK, WALL_H, segD], material: 'wall' }
    )
  } else {
    walls.push({ center: [x - halfW, WALL_H/2, z], size: [WALL_THICK, WALL_H, depth], material: 'wall' })
  }
  
  return walls
}

/**
 * Creates a building with an internal dividing wall.
 */
export function buildingWithRooms(
  x: number, z: number,
  width: number, depth: number,
  doorSide: 'north' | 'south' | 'east' | 'west',
  rooms: number = 2
): MapStructure[] {
  const walls = building(x, z, width, depth, doorSide)
  
  // Add internal walls (simple division along depth)
  if (rooms > 1) {
    const roomWidth = width / rooms
    for (let i = 1; i < rooms; i++) {
      const wallX = x - width/2 + roomWidth * i
      walls.push({
        center: [wallX, WALL_H/2, z],
        size: [WALL_THICK, WALL_H, depth - WALL_THICK * 2],
        material: 'wall'
      })
    }
  }
  
  return walls
}

/**
 * Creates a staircase (series of ascending boxes).
 */
export function stairs(
  x: number, z: number,
  steps: number,
  direction: 'north' | 'south' | 'east' | 'west'
): MapStructure[] {
  const result: MapStructure[] = []
  const stepH = 1
  const stepD = 1
  const stepW = 3
  
  for (let i = 0; i < steps; i++) {
    const offset = i * stepD
    let center: [number, number, number]
    let size: [number, number, number]
    
    switch (direction) {
      case 'north':
        center = [x, stepH/2 + i * stepH, z - offset]
        size = [stepW, stepH, stepD]
        break
      case 'south':
        center = [x, stepH/2 + i * stepH, z + offset]
        size = [stepW, stepH, stepD]
        break
      case 'east':
        center = [x + offset, stepH/2 + i * stepH, z]
        size = [stepD, stepH, stepW]
        break
      case 'west':
        center = [x - offset, stepH/2 + i * stepH, z]
        size = [stepD, stepH, stepW]
        break
    }
    
    result.push({ center, size, material: 'concrete' })
  }
  
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=buildings.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/maps/buildings.ts src/maps/buildings.test.ts
git commit -m "feat: add building helper functions for map construction"
```

---

### Task 3: Redesign Dust2 Map Layout

**Files:**
- Rewrite: `src/maps/dust2.ts`
- Test: `src/maps/registry.test.ts` (existing, should still pass)

**Interfaces:**
- Consumes: `building()`, `buildingWithRooms()`, `stairs()` from buildings.ts
- Produces: Updated `DUST2` MapDef with new layout

- [ ] **Step 1: Write the new Dust2 map definition**

```typescript
// src/maps/dust2.ts
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
    { center: [x - 1, 0.75, z + 2], size: [1.5, 1.5, 1.5], material: 'wood' },  // barrel
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
    ...buildingWithRooms(-15, -30, 10, 8, 'south', 2),
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
    ...buildingWithRooms(28, 8, 12, 10, 'west', 2),
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
    ...buildingWithRooms(15, 30, 10, 8, 'north', 2),
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
```

- [ ] **Step 2: Run registry tests to verify map loads correctly**

Run: `npm test -- --testPathPattern=registry.test`
Expected: PASS (map loads, has correct structure)

- [ ] **Step 3: Run all tests to verify no regressions**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/maps/dust2.ts
git commit -m "feat: redesign Dust2 with buildings, alleys, and elevated walkway"
```

---

### Task 4: Update Minimap for Larger Arena

**Files:**
- Modify: `src/ui/Minimap.tsx`

**Interfaces:**
- Consumes: `map.arenaSize` (now 40 instead of 30)
- Produces: Minimap scales correctly for 80x80 arena

- [ ] **Step 1: Check if minimap needs updates**

The minimap uses `map.arenaSize` to calculate the scale. Since we're changing arenaSize from 30 to 40, the minimap should automatically adjust. Let's verify.

Read `src/ui/Minimap.tsx` to check how it uses arenaSize.

- [ ] **Step 2: Test minimap rendering**

Run the game and verify the minimap shows the full arena. If it doesn't scale correctly, update the scale calculation.

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add src/ui/Minimap.tsx
git commit -m "fix: update minimap scaling for 80x80 arena"
```

---

### Task 5: Verify Collision and Gameplay

**Files:**
- Test: `src/engine/__tests__/Arena.test.ts` (existing)
- Manual testing

**Interfaces:**
- Consumes: Updated Dust2 map, new materials
- Produces: Verified collision detection, gameplay feel

- [ ] **Step 1: Run arena tests**

Run: `npm test -- --testPathPattern=Arena.test`
Expected: PASS (arena creates correctly with new map)

- [ ] **Step 2: Manual gameplay test**

Start the game and verify:
- [ ] Can enter buildings through doorways
- [ ] Collision works correctly with new walls
- [ ] Can climb stairs to elevated walkway
- [ ] Walkway collision works (can stand on it)
- [ ] Spawn points are not inside buildings
- [ ] Bombsite A is inside Building A
- [ ] Bombsite B is in Courtyard B
- [ ] Minimap shows full arena

- [ ] **Step 3: Fix any issues found**

If gameplay issues are found, adjust structure positions or sizes.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Dust2 redesign with buildings and elevated positions"
```

---

## Summary

**Files Created:**
- `src/maps/buildings.ts` - Building helper functions
- `src/maps/buildings.test.ts` - Tests for building helpers

**Files Modified:**
- `src/maps/MapDef.ts` - Added metal and wood materials
- `src/engine/Arena.ts` - Added material definitions
- `src/maps/dust2.ts` - Complete redesign with new layout

**Files Potentially Modified:**
- `src/ui/Minimap.tsx` - May need scale adjustment

**New Features:**
- Enterable buildings with doorways
- Elevated walkway in mid
- Alleys connecting areas
- Varied cover (crates, barrels, sandbags, furniture)
- Indoor bombsite A
- Courtyard bombsite B
- Stairs to elevated positions

**Testing:**
- Unit tests for building helpers
- Integration tests for arena creation
- Manual gameplay verification
