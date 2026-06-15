import { describe, it, expect } from 'vitest'
import { STORE_CATALOG, canAfford } from '../StoreCatalog'

describe('StoreCatalog', () => {
  it('lists the three weapons with prices', () => {
    const types = STORE_CATALOG.map((i) => i.type)
    expect(types).toEqual(['pistol', 'shotgun', 'rifle'])
    for (const item of STORE_CATALOG) expect(item.price).toBeGreaterThan(0)
  })

  it('canAfford compares money to price', () => {
    expect(canAfford(800, 'rifle')).toBe(false)
    expect(canAfford(3000, 'rifle')).toBe(true)
  })
})
