import { Weapon } from './Weapon'
import type { WeaponType } from '../types'

export type Slot = 'primary' | 'secondary'

export class WeaponManager {
  primary: Weapon | null = null
  secondary: Weapon
  currentSlot: Slot = 'secondary'

  constructor() {
    this.secondary = new Weapon('pistol')
  }

  get current(): Weapon {
    if (this.currentSlot === 'primary' && this.primary) return this.primary
    return this.secondary
  }

  equip(type: WeaponType, slot: Slot) {
    const weapon = new Weapon(type)
    if (slot === 'primary') this.primary = weapon
    else this.secondary = weapon
    this.currentSlot = slot
  }

  selectSlot(slot: Slot) {
    if (slot === 'primary' && !this.primary) return
    this.currentSlot = slot
  }

  cycleNext() {
    if (!this.primary) { this.currentSlot = 'secondary'; return }
    this.currentSlot = this.currentSlot === 'primary' ? 'secondary' : 'primary'
  }

  switchTo(type: WeaponType) {
    if (this.primary?.type === type) this.currentSlot = 'primary'
    else if (this.secondary.type === type) this.currentSlot = 'secondary'
  }

  update(dt: number) {
    this.primary?.update(dt)
    this.secondary.update(dt)
  }

  addAmmo(type: WeaponType, amount: number) {
    if (this.primary?.type === type) this.primary.addAmmo(amount)
    else if (this.secondary.type === type) this.secondary.addAmmo(amount)
  }

  reset() {
    this.primary = null
    this.secondary = new Weapon('pistol')
    this.currentSlot = 'secondary'
  }

  /** Refill both held weapons to full mags (CS2-style on respawn) without changing the loadout. */
  refill() {
    this.primary?.refill()
    this.secondary.refill()
  }
}
