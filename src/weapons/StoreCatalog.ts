import type { WeaponType } from '../types'
import { WEAPON_DEFS } from './WeaponDefs'

export interface StoreItem {
  type: WeaponType
  name: string
  price: number
}

export const STORE_CATALOG: StoreItem[] = [
  { type: 'pistol', name: WEAPON_DEFS.pistol.name, price: 200 },
  { type: 'shotgun', name: WEAPON_DEFS.shotgun.name, price: 1200 },
  { type: 'rifle', name: WEAPON_DEFS.rifle.name, price: 2700 },
]

export function canAfford(money: number, type: WeaponType): boolean {
  const item = STORE_CATALOG.find((i) => i.type === type)
  return !!item && money >= item.price
}
