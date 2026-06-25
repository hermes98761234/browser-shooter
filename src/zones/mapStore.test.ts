import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadMaps, saveMap, deleteMap, findByName, newMapId } from './mapStore'
import type { SavedMap } from './mapStore'
import type { ZoneDef } from './ZoneDef'
import { DAYLIGHT } from './ZoneDef'

const STUB_ZONE: ZoneDef = {
  id: 'test', name: 'Test', description: 'stub', arenaSize: 30,
  floorColor: 0x444444, lighting: DAYLIGHT,
  structures: [], ctSpawns: [[0, -20]], tSpawns: [[0, 20]],
  bombsites: [{ id: 'A', center: [10, 0] }, { id: 'B', center: [-10, 0] }],
}

const makeMap = (id: string, name: string): SavedMap =>
  ({ id, name, createdAt: 1000, zone: STUB_ZONE })

beforeEach(() => localStorage.clear())

describe('mapStore', () => {
  it('starts empty', () => expect(loadMaps()).toEqual([]))

  it('saves and loads a map', () => {
    expect(saveMap(makeMap('xyz', 'Test'))).toBe(true)
    saveMap(makeMap('abc', 'My Map'))
    expect(loadMaps()).toHaveLength(2)
    expect(loadMaps()[0].name).toBe('Test')
    expect(loadMaps()[1].name).toBe('My Map')
  })

  it('upserts by id', () => {
    saveMap(makeMap('abc', 'v1'))
    saveMap(makeMap('abc', 'v2'))
    expect(loadMaps()).toHaveLength(1)
    expect(loadMaps()[0].name).toBe('v2')
  })

  it('deletes by id', () => {
    saveMap(makeMap('abc', 'Map'))
    deleteMap('abc')
    expect(loadMaps()).toHaveLength(0)
  })

  it('finds by name', () => {
    saveMap(makeMap('abc', 'Dust'))
    expect(findByName('Dust')?.id).toBe('abc')
    expect(findByName('Nope')).toBeUndefined()
  })

  it('newMapId returns unique strings', () => {
    expect(newMapId()).not.toBe(newMapId())
  })
})
