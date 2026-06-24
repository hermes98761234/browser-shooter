import type { ZoneStructure } from './ZoneDef'

export { wall as doorway }

const WALL_H = 5
const WALL_THICK = 0.5
const DOOR_W = 2.5

// One wall of a building: a solid box, or two segments around a centered door.
// axis 'x' => wall runs along x (a north/south face); 'z' => runs along z.
// Exported as `doorway` for standalone use (lane walls + double-doors in zones).
export function wall(cx: number, cz: number, len: number, axis: 'x' | 'z', door: boolean): ZoneStructure[] {
  const size = (l: number): [number, number, number] =>
    axis === 'x' ? [l, WALL_H, WALL_THICK] : [WALL_THICK, WALL_H, l]
  if (!door) return [{ center: [cx, WALL_H / 2, cz], size: size(len), material: 'wall' }]

  const seg = (len - DOOR_W) / 2
  const off = (len + DOOR_W) / 4
  return axis === 'x'
    ? [
        { center: [cx - off, WALL_H / 2, cz], size: size(seg), material: 'wall' },
        { center: [cx + off, WALL_H / 2, cz], size: size(seg), material: 'wall' },
      ]
    : [
        { center: [cx, WALL_H / 2, cz - off], size: size(seg), material: 'wall' },
        { center: [cx, WALL_H / 2, cz + off], size: size(seg), material: 'wall' },
      ]
}

export function building(
  x: number, z: number,
  width: number, depth: number,
  doorSide: 'north' | 'south' | 'east' | 'west'
): ZoneStructure[] {
  const halfW = width / 2
  const halfD = depth / 2
  return [
    ...wall(x, z - halfD, width, 'x', doorSide === 'north'),
    ...wall(x, z + halfD, width, 'x', doorSide === 'south'),
    ...wall(x + halfW, z, depth, 'z', doorSide === 'east'),
    ...wall(x - halfW, z, depth, 'z', doorSide === 'west'),
  ]
}

export function buildingWithRooms(
  x: number, z: number,
  width: number, depth: number,
  doorSide: 'north' | 'south' | 'east' | 'west'
): ZoneStructure[] {
  return [
    ...building(x, z, width, depth, doorSide),
    { center: [x, WALL_H / 2, z], size: [WALL_THICK, WALL_H, depth - WALL_THICK * 2], material: 'wall' },
  ]
}

export function stairs(
  x: number, z: number,
  steps: number,
  direction: 'north' | 'south' | 'east' | 'west'
): ZoneStructure[] {
  const stepH = 1, stepD = 1, stepW = 3
  const dx = direction === 'east' ? 1 : direction === 'west' ? -1 : 0
  const dz = direction === 'south' ? 1 : direction === 'north' ? -1 : 0
  const size: [number, number, number] = dx !== 0 ? [stepD, stepH, stepW] : [stepW, stepH, stepD]

  return Array.from({ length: steps }, (_, i) => ({
    center: [x + dx * i * stepD, stepH / 2 + i * stepH, z + dz * i * stepD] as [number, number, number],
    size,
    material: 'concrete' as const,
  }))
}
