# Dust2 Map Redesign Specification

**Date:** 2026-06-20
**Status:** Draft
**Scope:** Dust2 map only, with patterns reusable for future maps

## Overview

Redesign Dust2 from a flat arena with scattered boxes to a more realistic CS-style map with enterable buildings, alleys, elevated positions, and varied cover. The goal is to make the map feel like a real location while keeping the simple box-based rendering system.

## Key Changes

### 1. Arena Expansion
- **Current:** 60x60 world (arenaSize: 30)
- **New:** 80x80 world (arenaSize: 40)
- Provides room for buildings, alleys, and open plazas

### 2. Structure Types

Keep existing materials, add two new ones:

| Material | Color | Use Case |
|----------|-------|----------|
| `wall` | 0x8a8577 | Building walls, perimeter |
| `crate` | 0x9c7a3c | Cover objects, boxes |
| `concrete` | 0x707078 | Platforms, heavy structures |
| `metal` (new) | 0x6a6a72 | Walkways, railings, industrial |
| `wood` (new) | 0x8b6b3c | Furniture, tables, barrels |

### 3. Building System

Buildings are composed of multiple `MapStructure` walls arranged to form rooms with openings:

```
Building template:
- 4 outer walls (with 2-unit gap for doorway)
- Optional inner walls for multiple rooms
- Optional roof (flat box on top, non-collidable for jump access)
```

Example building structure:
```typescript
// Building at position (10, 0, 10), size 8x8
const building = [
  // Front wall (with doorway gap)
  { center: [8, 2.5, 10], size: [3, 5, 0.5], material: 'wall' },  // left of door
  { center: [13, 2.5, 10], size: [3, 5, 0.5], material: 'wall' }, // right of door
  // Back wall
  { center: [10, 2.5, 14], size: [8, 5, 0.5], material: 'wall' },
  // Left wall
  { center: [6, 2.5, 12], size: [0.5, 5, 4], material: 'wall' },
  // Right wall
  { center: [14, 2.5, 12], size: [0.5, 5, 4], material: 'wall' },
]
```

### 4. Map Layout

```
         NORTH (T Spawn)
    ┌─────────────────────────┐
    │  ┌─────┐    ┌─────┐    │
    │  │ T   │    │ T   │    │
    │  │Bldg1│    │Bldg2│    │
    │  └──┬──┘    └──┬──┘    │
    │     │  Alley   │       │
    │     └────┬─────┘       │
    │          │             │
    │    ┌─────┴─────┐       │
    │    │   MID     │       │
    │    │  Plaza    │       │
    │    └─────┬─────┘       │
    │     Walkway│           │
    │          │             │
    │  ┌───┐  │  ┌───┐      │
    │  │ A │  │  │ B │      │
    │  │Site│  │  │Site│      │
    │  └───┘  │  └───┘      │
    │          │             │
    │  ┌─────┐│ ┌─────┐     │
    │  │ CT  ││ │ CT  │     │
    │  │Bldg1││ │Bldg2│     │
    │  └─────┘│ └─────┘     │
    └─────────────────────────┘
         SOUTH (CT Spawn)
```

### 5. Detailed Structure Placement

#### T Spawn Area (North, z: -30 to -15)
- **Building 1** (center: [-12, 0, -25]): 8x6 building with 2 rooms
  - Front wall with doorway facing south
  - Inner wall dividing into 2 rooms
  - Table and crates inside
- **Building 2** (center: [12, 0, -25]): 6x6 building with single room
  - Doorway facing south
  - Stack of crates inside for cover

#### Mid Area (z: -15 to 15)
- **Mid Plaza** (center: [0, 0, 0]): Open area with scattered cover
  - Central concrete block (like current, but smaller: 4x3x4)
  - 4 sandbag positions around edges
  - 2 crate stacks for cover
- **Elevated Walkway** (center: [0, 3, 0]): Metal walkway connecting east/west
  - 20 units long, 3 units wide, 3 units high
  - Supported by concrete pillars
  - Railings on sides (thin metal walls)

#### Bombsite A (East, x: 20 to 35)
- **Building A** (center: [28, 0, 5]): 10x8 indoor area
  - Multiple doorway entrances
  - Interior walls creating corridors
  - Raised platform (2 units high) for defuse position
  - Crates and barrels for cover inside

#### Bombsite B (West, x: -35 to -20)
- **Courtyard B** (center: [-28, 0, -5]): Open courtyard surrounded by walls
  - 3 sides walled, one side open (entrance from mid)
  - Benches and trash cans around edges
  - Central planter box (low concrete wall)

#### CT Spawn Area (South, z: 15 to 30)
- **Building 3** (center: [-12, 0, 25]): 8x6 building mirroring T Building 1
  - Doorway facing north
  - Table and crates inside
- **Building 4** (center: [12, 0, 25]): 6x6 building mirroring T Building 2
  - Doorway facing north
  - Stack of crates inside

### 6. Cover Objects

Scattered throughout the map:

**Crates:**
- Standard 2x2x2 crates
- Crate stacks (2-3 high)
- Single crates for low cover

**Furniture:**
- Tables (4x1x2, wood material)
- Barrels (1.5x2x1.5, metal material)
- Benches (3x0.8x1, concrete material)

**Barriers:**
- Sandbags (4x1x1, concrete material)
- Concrete barriers (2x1.5x1, concrete material)
- Metal barriers (3x1x0.5, metal material)

### 7. Vertical Elements

**Platforms:**
- Building rooftops accessible via stairs/ladders
- Elevated walkway in mid
- Raised bombsite A platform

**Stairs:**
- Simple box arrangements (3-4 steps) leading to elevated positions
- Each step: 1 unit high, 1 unit deep

### 8. Spawn Points

Adjust for larger arena:

**CT Spawns:**
- [-25, 25], [-30, 20], [-20, 30], [-25, 15]

**T Spawns:**
- [25, -25], [30, -20], [20, -30], [25, -15]

### 9. Bombsite Positions

- **A:** [30, 10] (inside Building A)
- **B:** [-28, 0] (center of Courtyard B)

### 10. Lighting

Keep DAYLIGHT preset, adjust for larger arena:
- Sun position may need adjustment for shadow coverage
- Consider adding point lights inside buildings for interior illumination

## Implementation Notes

### Building Construction Pattern

Use a helper function to create buildings consistently:

```typescript
function building(
  x: number, z: number,
  width: number, depth: number,
  doorSide: 'north' | 'south' | 'east' | 'west',
  doorOffset: number = 0
): MapStructure[] {
  const walls: MapStructure[] = []
  const wallH = 5
  const doorW = 2.5
  const wallThick = 0.5
  
  // Calculate the 4 walls with a door gap on the specified side
  // North wall (z - depth/2)
  if (doorSide === 'north') {
    // Split into two segments with gap
    const segW = (width - doorW) / 2
    walls.push({ center: [x - width/4 - doorOffset/2, wallH/2, z - depth/2], size: [segW, wallH, wallThick], material: 'wall' })
    walls.push({ center: [x + width/4 + doorOffset/2, wallH/2, z - depth/2], size: [segW, wallH, wallThick], material: 'wall' })
  } else {
    walls.push({ center: [x, wallH/2, z - depth/2], size: [width, wallH, wallThick], material: 'wall' })
  }
  // South wall (z + depth/2) - similar pattern
  // East wall (x + width/2)
  // West wall (x - width/2)
  return walls
}
```

### Material Updates

Add to `MapDef.ts`:
```typescript
type StructureMaterial = 'wall' | 'crate' | 'concrete' | 'metal' | 'wood'
```

Add to `Arena.ts` `materialFor()`:
```typescript
case 'metal':
  return new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.6, metalness: 0.4 })
case 'wood':
  return new THREE.MeshStandardMaterial({ color: 0x8b6b3c, roughness: 0.9, metalness: 0.0 })
```

### Collision Considerations

- All building walls are solid collision boxes
- Doorways are gaps (no collision box)
- Elevated walkways have collision boxes underneath for standing on
- Rooftops are only accessible via stairs (no collision box on roof edge)

## Testing

- Verify all buildings are enterable through doorways
- Check collision detection works correctly with new geometry
- Ensure spawn points are not inside buildings
- Verify bombsite positions are accessible
- Test minimap rendering with new layout

## Future Maps

This design establishes patterns for future maps:
- Building templates can be reused
- Cover object placement guidelines
- Material palette expansion
- Vertical element patterns
