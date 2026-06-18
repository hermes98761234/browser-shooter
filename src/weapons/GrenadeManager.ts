import type { GrenadeType } from '../types'
import { GRENADE_DEFS } from './GrenadeDefs'

export class GrenadeManager {
  private inventory: Map<GrenadeType, number> = new Map()
  selected: GrenadeType | null = null
  private lastWeaponType: string | null = null

  has(type: GrenadeType): boolean {
    return (this.inventory.get(type) ?? 0) > 0
  }

  getCount(type: GrenadeType): number {
    return this.inventory.get(type) ?? 0
  }

  add(type: GrenadeType): boolean {
    const count = this.getCount(type)
    if (count >= GRENADE_DEFS[type].carryLimit) return false
    this.inventory.set(type, count + 1)
    return true
  }

  remove(type: GrenadeType): boolean {
    const count = this.getCount(type)
    if (count <= 0) return false
    this.inventory.set(type, count - 1)
    if (this.selected === type && !this.has(type)) {
      this.selected = null
    }
    return true
  }

  select(type: GrenadeType): boolean {
    if (!this.has(type)) return false
    this.selected = type
    return true
  }

  cycle(): GrenadeType | null {
    const types: GrenadeType[] = ['he', 'flash', 'smoke']
    const currentIdx = this.selected ? types.indexOf(this.selected) : -1
    for (let i = 1; i <= types.length; i++) {
      const nextIdx = (currentIdx + i) % types.length
      if (this.has(types[nextIdx])) {
        this.selected = types[nextIdx]
        return this.selected
      }
    }
    return null
  }

  saveLastWeapon(type: string): void {
    this.lastWeaponType = type
  }

  getLastWeapon(): string | null {
    return this.lastWeaponType
  }

  clear(): void {
    this.inventory.clear()
    this.selected = null
  }
}