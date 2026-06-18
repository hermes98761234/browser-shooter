import { describe, it, expect } from 'vitest'
import { STORE_CATALOG, catalogForTeam, findItem, canAffordItem } from '../StoreCatalog'

describe('StoreCatalog', () => {
  it('every item has a unique id and non-negative price', () => {
    const ids = STORE_CATALOG.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const i of STORE_CATALOG) expect(i.price).toBeGreaterThanOrEqual(0)
  })

  it('catalogForTeam keeps shared + own-team items, drops other team', () => {
    const ct = catalogForTeam('ct')
    expect(ct.some((i) => i.id === 'm4')).toBe(true)      // CT weapon
    expect(ct.some((i) => i.id === 'ak')).toBe(false)     // T weapon excluded
    expect(ct.some((i) => i.id === 'kevlar')).toBe(true)  // shared gear
    const t = catalogForTeam('t')
    expect(t.some((i) => i.id === 'ak')).toBe(true)
    expect(t.some((i) => i.id === 'm4')).toBe(false)
  })

  it('findItem returns the item by id', () => {
    expect(findItem('m4')?.weaponType).toBe('m4')
    expect(findItem('nope')).toBeUndefined()
  })

  it('canAffordItem compares money to price', () => {
    expect(canAffordItem(100, 'm4')).toBe(false)
    expect(canAffordItem(3000, 'm4')).toBe(true)
    expect(canAffordItem(0, 'nope')).toBe(false)
  })
})

describe('new items', () => {
  it('includes bomb item', () => {
    const bomb = findItem('bomb')
    expect(bomb).toBeDefined()
    expect(bomb!.price).toBe(0)
    expect(bomb!.team).toBe('t')
    expect(bomb!.kind).toBe('objective')
  })

  it('includes defuse kit item', () => {
    const kit = findItem('defuse_kit')
    expect(kit).toBeDefined()
    expect(kit!.price).toBe(400)
    expect(kit!.team).toBe('ct')
    expect(kit!.kind).toBe('gear')
  })

  it('includes heavy armor item', () => {
    const armor = findItem('heavy_armor')
    expect(armor).toBeDefined()
    expect(armor!.price).toBe(1000)
    expect(armor!.kind).toBe('armor')
  })

  it('bomb is free for T team', () => {
    const items = catalogForTeam('t')
    const bomb = items.find(i => i.id === 'bomb')
    expect(bomb).toBeDefined()
    expect(bomb!.price).toBe(0)
  })
})
