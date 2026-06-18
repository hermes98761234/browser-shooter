import type { StoreItem, Team } from '../types'

export const STORE_CATALOG: StoreItem[] = [
  // --- secondary (pistols) ---
  { id: 'pistol', name: 'Pistol', price: 0,   kind: 'weapon', slot: 'secondary', weaponType: 'pistol', icon: 'pistol' },
  { id: 'usp',    name: 'USP',    price: 200, kind: 'weapon', slot: 'secondary', weaponType: 'usp',   team: 'ct', icon: 'usp' },
  { id: 'glock',  name: 'Glock',  price: 200, kind: 'weapon', slot: 'secondary', weaponType: 'glock', team: 't', icon: 'glock' },
  { id: 'deagle', name: 'Deagle', price: 700, kind: 'weapon', slot: 'secondary', weaponType: 'deagle', icon: 'deagle' },

  // --- primary ---
  { id: 'm4',      name: 'M4',      price: 2700, kind: 'weapon', slot: 'primary', weaponType: 'm4',    team: 'ct', icon: 'm4' },
  { id: 'aug',     name: 'AUG',     price: 3300, kind: 'weapon', slot: 'primary', weaponType: 'aug',   team: 'ct', icon: 'aug' },
  { id: 'ak',      name: 'AK-47',   price: 2500, kind: 'weapon', slot: 'primary', weaponType: 'ak',    team: 't', icon: 'ak' },
  { id: 'galil',   name: 'Galil',   price: 2000, kind: 'weapon', slot: 'primary', weaponType: 'galil', team: 't', icon: 'galil' },
  { id: 'mp5',     name: 'MP5',     price: 1500, kind: 'weapon', slot: 'primary', weaponType: 'mp5', icon: 'mp5' },
  { id: 'shotgun', name: 'Shotgun', price: 1200, kind: 'weapon', slot: 'primary', weaponType: 'shotgun', icon: 'shotgun' },
  { id: 'awp',     name: 'AWP',     price: 4750, kind: 'weapon', slot: 'primary', weaponType: 'awp', icon: 'awp' },

  // --- gear (shared) ---
  { id: 'kevlar',        name: 'Kevlar',          price: 650,  kind: 'armor',  effects: { armor: 50 }, icon: 'kevlar' },
  { id: 'kevlar_helmet', name: 'Kevlar + Helmet',  price: 1000, kind: 'armor',  effects: { armor: 100 }, icon: 'kevlar_helmet' },
  { id: 'medkit',        name: 'Medkit',           price: 800,  kind: 'health', effects: { maxHealth: 25 }, icon: 'medkit' },
  { id: 'boots',         name: 'Light Boots',      price: 500,  kind: 'speed',  effects: { speedMult: 1.15 }, icon: 'boots' },

  // --- upgrades (shared, applied to equipped weapon) ---
  { id: 'ext_mag',     name: 'Extended Mag', price: 300, kind: 'upgrade', effects: { weapon: { ammoMult: 1.5 } } },
  { id: 'fast_reload', name: 'Fast Reload',  price: 400, kind: 'upgrade', effects: { weapon: { reloadMult: 0.7 } } },

  // --- objective (competitive) ---
  { id: 'bomb', name: 'C4 Bomb', price: 0, kind: 'objective', team: 't', icon: 'bomb' },

  // --- gear (competitive) ---
  { id: 'defuse_kit', name: 'Defuse Kit', price: 400, kind: 'gear', team: 'ct', icon: 'defuse_kit' },
  { id: 'heavy_armor', name: 'Heavy Armor', price: 1000, kind: 'armor', icon: 'heavy_armor' },
]

/** Items available to a team: shared (no team) plus that team's own. */
export function catalogForTeam(team: Team): StoreItem[] {
  return STORE_CATALOG.filter((i) => i.team === undefined || i.team === team)
}

export function findItem(id: string): StoreItem | undefined {
  return STORE_CATALOG.find((i) => i.id === id)
}

export function canAffordItem(money: number, id: string): boolean {
  const item = findItem(id)
  return !!item && money >= item.price
}
