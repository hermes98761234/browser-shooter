import { describe, it, expect } from 'vitest'
import { Weapon } from '../Weapon'
import { WEAPON_DEFS } from '../WeaponDefs'

describe('Weapon', () => {
  it('initializes with correct stats', () => {
    const weapon = new Weapon('pistol')
    expect(weapon.type).toBe('pistol')
    expect(weapon.def.damage).toBe(25)
    expect(weapon.ammo).toBe(60)
    expect(weapon.isReloading).toBe(false)
  })

  it('can shoot when ammo is available', () => {
    const weapon = new Weapon('pistol')
    expect(weapon.canShoot()).toBe(true)
    const shot = weapon.shoot()
    expect(shot).toBe(true)
    expect(weapon.ammo).toBe(59)
  })

  it('cannot shoot when ammo is empty', () => {
    const weapon = new Weapon('pistol')
    weapon.ammo = 0
    expect(weapon.canShoot()).toBe(false)
    expect(weapon.shoot()).toBe(false)
  })

  it('respects fire rate cooldown', () => {
    const weapon = new Weapon('pistol')
    weapon.shoot()
    expect(weapon.canShoot()).toBe(false)
    weapon.update(0.3)
    expect(weapon.canShoot()).toBe(true)
  })

  it('reloads ammo', () => {
    const weapon = new Weapon('pistol')
    weapon.ammo = 10
    weapon.reload()
    expect(weapon.isReloading).toBe(true)
    weapon.update(1.5)
    expect(weapon.isReloading).toBe(false)
    expect(weapon.ammo).toBe(60)
  })

  it('does not reload when already full', () => {
    const weapon = new Weapon('pistol')
    weapon.reload()
    expect(weapon.isReloading).toBe(false)
  })

  it('adds ammo up to max', () => {
    const weapon = new Weapon('pistol')
    weapon.ammo = 50
    weapon.addAmmo(20)
    expect(weapon.ammo).toBe(60)
  })
})

describe('WeaponManager', () => {
  it('switches weapons by index', async () => {
    const { WeaponManager } = await import('../WeaponManager')
    const manager = new WeaponManager()
    expect(manager.current.type).toBe('pistol')
    manager.switchByIndex(1)
    expect(manager.current.type).toBe('shotgun')
    manager.switchByIndex(2)
    expect(manager.current.type).toBe('rifle')
  })

  it('updates all weapons', async () => {
    const { WeaponManager } = await import('../WeaponManager')
    const manager = new WeaponManager()
    manager.weapons[0].shoot()
    manager.update(0.5)
    expect(manager.weapons[0].fireTimer).toBe(0)
  })
})
