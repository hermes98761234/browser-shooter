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
  doorSide: 'north' | 'south' | 'east' | 'west'
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
