import { describe, it, expect } from 'vitest'
import { building, buildingWithRooms, stairs } from './buildings'

describe('building helper', () => {
  it('creates a rectangular building with doorway', () => {
    const structures = building(0, 0, 8, 6, 'south')
    expect(structures.length).toBe(5)

    const northWall = structures.find(s => s.center[2] === -3)
    expect(northWall).toBeDefined()
    expect(northWall!.material).toBe('wall')

    const southWalls = structures.filter(s => s.center[2] === 3)
    expect(southWalls.length).toBe(2)
  })

  it('creates building with internal rooms', () => {
    const structures = buildingWithRooms(0, 0, 10, 8, 'south')
    expect(structures.length).toBe(6)

    const innerWall = structures.find(s =>
      s.material === 'wall' &&
      s.center[0] === 0 &&
      s.center[2] === 0
    )
    expect(innerWall).toBeDefined()
    expect(innerWall!.size[2]).toBe(8 - 0.5 * 2)
  })
})

describe('stairs helper', () => {
  it('creates staircase with specified steps', () => {
    const structures = stairs(0, 0, 3, 'north')
    expect(structures.length).toBe(3)

    expect(structures[0].center[1]).toBeLessThan(structures[1].center[1])
    expect(structures[1].center[1]).toBeLessThan(structures[2].center[1])
  })
})
