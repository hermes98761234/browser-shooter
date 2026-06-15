import { describe, it, expect } from 'vitest'
import { Weapon } from '../Weapon'
import { Pistol } from '../Pistol'
import { Shotgun } from '../Shotgun'
import { Rifle } from '../Rifle'
import { ProjectileSystem, type Projectile } from '../Projectile'

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

describe('Pistol', () => {
  it('creates a pistol with correct type', () => {
    const p = new Pistol()
    expect(p.type).toBe('pistol')
    expect(p.ammo).toBe(60)
    expect(p.def.damage).toBe(25)
    expect(p.def.spread).toBe(0.02)
  })

  it('has semi-auto flag', () => {
    const p = new Pistol()
    expect(p.isSemiAuto).toBe(true)
  })

  it('has correct muzzle flash scale', () => {
    const p = new Pistol()
    expect(p.getMuzzleFlashScale()).toBe(0.6)
  })

  it('has correct recoil amount', () => {
    const p = new Pistol()
    expect(p.getRecoilAmount()).toBe(0.02)
  })
})

describe('Shotgun', () => {
  it('creates a shotgun with correct type', () => {
    const s = new Shotgun()
    expect(s.type).toBe('shotgun')
    expect(s.ammo).toBe(30)
    expect(s.def.damage).toBe(15)
    expect(s.def.fireRate).toBe(0.8)
    expect(s.def.spread).toBe(0.15)
  })

  it('fires 6 pellets per shot', () => {
    const s = new Shotgun()
    expect(s.getPelletCount()).toBe(6)
  })

  it('has high muzzle flash and recoil', () => {
    const s = new Shotgun()
    expect(s.getMuzzleFlashScale()).toBe(1.2)
    expect(s.getRecoilAmount()).toBe(0.08)
  })
})

describe('Rifle', () => {
  it('creates a rifle with correct type', () => {
    const r = new Rifle()
    expect(r.type).toBe('rifle')
    expect(r.ammo).toBe(90)
    expect(r.def.damage).toBe(20)
    expect(r.def.fireRate).toBe(0.1)
    expect(r.def.spread).toBe(0.05)
  })

  it('has full auto flag', () => {
    const r = new Rifle()
    expect(r.isFullAuto).toBe(true)
  })

  it('has medium muzzle flash and recoil', () => {
    const r = new Rifle()
    expect(r.getMuzzleFlashScale()).toBe(0.8)
    expect(r.getRecoilAmount()).toBe(0.04)
  })

  it('has recoil recovery', () => {
    const r = new Rifle()
    expect(r.getRecoilRecoveryRate()).toBe(5.0)
  })
})

describe('ProjectileSystem', () => {
  it('starts with zero active projectiles', () => {
    const scene = { add: () => {}, remove: () => {} } as any
    const ps = new ProjectileSystem(scene)
    expect(ps.getActiveCount()).toBe(0)
  })

  it('spawns a projectile and tracks count', () => {
    const added: any[] = []
    const scene = { add: (o: any) => added.push(o), remove: () => {} } as any
    const ps = new ProjectileSystem(scene)
    const origin = { clone: () => ({ x: 0, y: 0, z: 0 }), x: 0, y: 0, z: 0 } as any
    const dir = { clone: () => ({ x: 0, y: 0, z: -1, normalize: function() { return this } }), normalize: function() { return this } } as any
    ps.spawn(origin, dir, 50)
    expect(ps.getActiveCount()).toBe(1)
  })

  it('clears all projectiles', () => {
    const scene = { add: () => {}, remove: () => {} } as any
    const ps = new ProjectileSystem(scene)
    const origin = { clone: () => ({ x: 0, y: 0, z: 0 }), x: 0, y: 0, z: 0 } as any
    const dir = { clone: () => ({ x: 0, y: 0, z: -1, normalize: function() { return this } }), normalize: function() { return this } } as any
    ps.spawn(origin, dir, 50)
    ps.spawn(origin, dir, 50)
    expect(ps.getActiveCount()).toBe(2)
    ps.clear()
    expect(ps.getActiveCount()).toBe(0)
  })
})
