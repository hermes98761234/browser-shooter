import { Weapon } from './Weapon'
import type { WeaponType } from '../types'

export class WeaponManager {
  weapons: Weapon[]
  currentIndex: number = 0

  constructor() {
    this.weapons = [
      new Weapon('pistol'),
      new Weapon('shotgun'),
      new Weapon('rifle'),
    ]
  }

  get current(): Weapon {
    return this.weapons[this.currentIndex]
  }

  switchTo(type: WeaponType) {
    const idx = this.weapons.findIndex(w => w.type === type)
    if (idx !== -1) this.currentIndex = idx
  }

  switchByIndex(index: number) {
    if (index >= 0 && index < this.weapons.length) {
      this.currentIndex = index
    }
  }

  update(dt: number) {
    for (const w of this.weapons) {
      w.update(dt)
    }
  }

  addAmmo(type: WeaponType, amount: number) {
    const weapon = this.weapons.find(w => w.type === type)
    if (weapon) weapon.addAmmo(amount)
  }
}
