import * as THREE from 'three'
import type { WeaponDef, WeaponType, WeaponUpgrade } from '../types'
import { WEAPON_DEFS } from './WeaponDefs'

export class Weapon {
  type: WeaponType
  def: WeaponDef
  ammo: number
  fireTimer: number = 0
  isReloading: boolean = false
  reloadTimer: number = 0

  constructor(type: WeaponType) {
    this.type = type
    this.def = { ...WEAPON_DEFS[type] }
    this.ammo = this.def.maxAmmo
  }

  canShoot(): boolean {
    return this.fireTimer <= 0 && this.ammo > 0 && !this.isReloading
  }

  shoot(): boolean {
    if (!this.canShoot()) return false
    this.ammo--
    this.fireTimer = this.def.fireRate
    return true
  }

  reload() {
    if (this.isReloading || this.ammo === this.def.maxAmmo) return
    this.isReloading = true
    this.reloadTimer = this.def.reloadTime
  }

  update(dt: number) {
    this.fireTimer = Math.max(0, this.fireTimer - dt)
    if (this.isReloading) {
      this.reloadTimer -= dt
      if (this.reloadTimer <= 0) {
        this.ammo = this.def.maxAmmo
        this.isReloading = false
      }
    }
  }

  addAmmo(amount: number) {
    this.ammo = Math.max(0, Math.min(this.def.maxAmmo, this.ammo + amount))
  }

  /** Top up to a full magazine and cancel any in-progress reload (used on respawn). */
  refill() {
    this.ammo = this.def.maxAmmo
    this.isReloading = false
    this.reloadTimer = 0
  }

  applyUpgrade(mod: WeaponUpgrade) {
    if (mod.ammoMult != null) {
      this.def.maxAmmo = Math.round(this.def.maxAmmo * mod.ammoMult)
      this.ammo = this.def.maxAmmo
    }
    if (mod.reloadMult != null) this.def.reloadTime *= mod.reloadMult
    if (mod.damageMult != null) this.def.damage = Math.round(this.def.damage * mod.damageMult)
  }

  getSpreadDirection(forward: THREE.Vector3): THREE.Vector3 {
    const dir = forward.clone()
    dir.x += (Math.random() - 0.5) * this.def.spread
    dir.y += (Math.random() - 0.5) * this.def.spread
    dir.z += (Math.random() - 0.5) * this.def.spread
    return dir.normalize()
  }
}
