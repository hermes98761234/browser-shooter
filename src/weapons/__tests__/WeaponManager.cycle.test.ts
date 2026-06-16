import { describe, it, expect, beforeEach } from 'vitest'
import { WeaponManager } from '../WeaponManager'

describe('WeaponManager.cycleNext', () => {
  let m: WeaponManager
  beforeEach(() => { m = new WeaponManager() })

  it('stays on secondary when no primary is equipped', () => {
    m.cycleNext()
    expect(m.current.type).toBe('pistol')
  })

  it('toggles between primary and secondary when both exist', () => {
    m.equip('m4', 'primary') // selects primary
    expect(m.current.type).toBe('m4')
    m.cycleNext()
    expect(m.current.type).toBe('pistol')
    m.cycleNext()
    expect(m.current.type).toBe('m4')
  })
})
