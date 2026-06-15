import type { WeaponDef, WeaponType } from '../types'

export const WEAPON_DEFS: Record<WeaponType, WeaponDef> = {
  pistol: {
    name: 'Pistol',
    damage: 25,
    fireRate: 0.3,
    maxAmmo: 60,
    spread: 0.02,
    range: 50,
    reloadTime: 1.5,
  },
  shotgun: {
    name: 'Shotgun',
    damage: 15,
    fireRate: 0.8,
    maxAmmo: 30,
    spread: 0.15,
    range: 20,
    reloadTime: 2.0,
  },
  rifle: {
    name: 'Rifle',
    damage: 20,
    fireRate: 0.1,
    maxAmmo: 90,
    spread: 0.05,
    range: 60,
    reloadTime: 2.5,
  },
}
