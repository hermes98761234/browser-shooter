import type { Vector3 } from 'three'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type GameState = 'menu' | 'mpmenu' | 'settings' | 'teamselect' | 'playing' | 'paused' | 'gameover' | 'matchover'

export interface WeaponDef {
  name: string
  damage: number
  fireRate: number
  maxAmmo: number
  spread: number
  range: number
  reloadTime: number
}

export type WeaponType =
  // secondary (pistols)
  | 'pistol' | 'usp' | 'glock' | 'deagle'
  // primary
  | 'm4' | 'aug' | 'ak' | 'galil' | 'mp5' | 'shotgun' | 'awp' | 'rifle'

export type GrenadeType = 'he' | 'flash' | 'smoke'

export type Team = 'ct' | 't'

export type ItemKind = 'weapon' | 'armor' | 'health' | 'speed' | 'upgrade' | 'objective' | 'gear' | 'grenade'

export interface WeaponUpgrade {
  ammoMult?: number    // multiplies maxAmmo (and refills)
  reloadMult?: number  // multiplies reloadTime
  damageMult?: number  // multiplies damage
}

export interface StatEffect {
  armor?: number       // +armor points
  maxHealth?: number   // +max HP (and full heal)
  speedMult?: number   // multiplies move speed
  weapon?: WeaponUpgrade // applied to the equipped weapon
}

export interface StoreItem {
  id: string
  name: string
  price: number
  kind: ItemKind
  team?: Team                       // omitted = both teams
  slot?: 'primary' | 'secondary'    // weapons only
  weaponType?: WeaponType           // weapons only
  effects?: StatEffect              // gear/upgrades
  icon?: string                     // SVG icon component name
}

export interface EnemyDef {
  type: string
  health: number
  damage: number
  speed: number
  attackRange: number // melee strike range
  scoreValue: number
  color: number
  attackType: 'melee' | 'ranged'
  fireRange: number // distance at which a ranged enemy will engage
  fireRate: number // seconds between ranged shots
  accuracy: number // 0..1 hit probability per shot
  telegraphTime: number // seconds of aiming before a ranged shot
  standoff: number // preferred minimum distance for ranged enemies
}

export type EnemyAction =
  | { type: 'melee'; damage: number }
  | { type: 'shoot'; damage: number; from: Vector3; to: Vector3; hit: boolean }

export interface WaveDef {
  number: number
  enemies: { type: string; count: number }[]
  spawnDelay: number
}
