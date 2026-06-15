import { describe, it, expect } from 'vitest'
import { WeaponManager } from '../WeaponManager'

describe('WeaponManager.cycleNext', () => {
  it('advances to the next weapon and wraps around', () => {
    const m = new WeaponManager()
    expect(m.current.type).toBe('pistol')
    m.cycleNext(); expect(m.current.type).toBe('shotgun')
    m.cycleNext(); expect(m.current.type).toBe('rifle')
    m.cycleNext(); expect(m.current.type).toBe('pistol')
  })
})
