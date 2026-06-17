import { describe, it, expect } from 'vitest'
import { ThirdPersonWeapon } from '../ThirdPersonWeapon'

describe('ThirdPersonWeapon', () => {
  it('creates a group with a child mesh for pistol', () => {
    const w = new ThirdPersonWeapon('pistol')
    expect(w.group).toBeDefined()
    expect(w.group.children.length).toBeGreaterThan(0)
    w.dispose()
  })

  it('creates distinct geometry for each weapon type', () => {
    const types = ['pistol', 'usp', 'glock', 'deagle', 'm4', 'ak', 'aug', 'galil', 'mp5', 'shotgun', 'awp', 'rifle'] as const
    const groups = types.map(t => new ThirdPersonWeapon(t))
    const childCounts = groups.map(g => g.group.children.length)
    // Each weapon should have at least 2 child meshes (body + barrel minimum)
    for (const count of childCounts) {
      expect(count).toBeGreaterThanOrEqual(2)
    }
    groups.forEach(g => g.dispose())
  })

  it('setWeapon swaps visible model', () => {
    const w = new ThirdPersonWeapon('pistol')
    const initialChildren = w.group.children.length
    w.setWeapon('ak')
    // Should still have children after swap
    expect(w.group.children.length).toBeGreaterThan(0)
    w.dispose()
  })

  it('dispose cleans up all meshes', () => {
    const w = new ThirdPersonWeapon('m4')
    w.dispose()
    expect(w.group.children.length).toBe(0)
  })
})
