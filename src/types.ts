export interface Vec3 {
  x: number
  y: number
  z: number
}

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover'

export interface WeaponDef {
  name: string
  damage: number
  fireRate: number
  maxAmmo: number
  spread: number
  range: number
  reloadTime: number
}

export type WeaponType = 'pistol' | 'shotgun' | 'rifle'

export interface EnemyDef {
  type: string
  health: number
  damage: number
  speed: number
  attackRange: number
  scoreValue: number
  color: number
}

export interface WaveDef {
  number: number
  enemies: { type: string; count: number }[]
  spawnDelay: number
}
