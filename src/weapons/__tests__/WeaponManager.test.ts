import { describe, it, expect, beforeEach } from 'vitest'
import { WeaponManager } from '../WeaponManager'

describe('WeaponManager (slots)', () => {
  let m: WeaponManager
  beforeEach(() => { m = new WeaponManager() })

  it('starts with a pistol secondary and no primary, secondary selected', () => {
    expect(m.secondary.type).toBe('pistol')
    expect(m.primary).toBeNull()
    expect(m.currentSlot).toBe('secondary')
    expect(m.current.type).toBe('pistol')
  })

  it('equipping a primary selects it', () => {
    m.equip('ak', 'primary')
    expect(m.primary?.type).toBe('ak')
    expect(m.currentSlot).toBe('primary')
    expect(m.current.type).toBe('ak')
  })

  it('equipping a secondary replaces and selects it', () => {
    m.equip('deagle', 'secondary')
    expect(m.secondary.type).toBe('deagle')
    expect(m.current.type).toBe('deagle')
  })

  it('selectSlot ignores primary when none equipped', () => {
    m.selectSlot('primary')
    expect(m.currentSlot).toBe('secondary')
    m.equip('m4', 'primary')
    m.selectSlot('secondary')
    expect(m.current.type).toBe('pistol')
    m.selectSlot('primary')
    expect(m.current.type).toBe('m4')
  })

  it('switchTo selects the slot holding that weapon type', () => {
    m.equip('ak', 'primary')
    m.switchTo('pistol')
    expect(m.current.type).toBe('pistol')
    m.switchTo('ak')
    expect(m.current.type).toBe('ak')
  })

  it('update advances both equipped weapons', () => {
    m.equip('ak', 'primary')
    m.primary!.shoot()
    m.secondary.shoot()
    m.update(2)
    expect(m.primary!.fireTimer).toBe(0)
    expect(m.secondary.fireTimer).toBe(0)
  })

  it('addAmmo targets the matching equipped weapon', () => {
    m.equip('ak', 'primary')
    m.primary!.ammo = 10
    m.addAmmo('ak', 5)
    expect(m.primary!.ammo).toBe(15)
  })

  it('reset clears primary and restores pistol secondary', () => {
    m.equip('ak', 'primary')
    m.equip('deagle', 'secondary')
    m.reset()
    expect(m.primary).toBeNull()
    expect(m.secondary.type).toBe('pistol')
    expect(m.currentSlot).toBe('secondary')
  })
})
