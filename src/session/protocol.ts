import type { Vec3 } from '../types'
import type { HitZone } from '../systems/DamageZones'

export type GameMode = 'coop' | 'pvp'
export const GAME_MODES: readonly GameMode[] = ['coop', 'pvp'] as const

export interface PlayerInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
  shoot: boolean
  yaw: number   // absolute look yaw (radians)
  pitch: number // absolute look pitch (radians)
}

export function emptyInput(): PlayerInput {
  return { forward: false, backward: false, left: false, right: false, jump: false, shoot: false, yaw: 0, pitch: 0 }
}

export interface EntityState {
  id: string
  kind: 'player' | 'enemy'
  type: string
  position: Vec3
  rotationY: number
  health: number
  isDead: boolean
}

export interface Snapshot {
  tick: number
  players: EntityState[]
  enemies: EntityState[]
}

export interface HitEvent {
  targetId: string
  zone: HitZone
  damage: number
  killed: boolean
  point: Vec3
}

/** Events the session emits each step for effects/audio/UI to react to. */
export type SessionEvent =
  | { type: 'playerHitEnemy'; hit: HitEvent; enemyType: string }
  | { type: 'wallImpact'; point: Vec3 }
  | { type: 'enemyShoot'; from: Vec3; to: Vec3; hit: boolean; damage: number }
  | { type: 'enemyMelee'; damage: number; enemyPos: Vec3 }
  | { type: 'enemyTelegraph'; enemyPos: Vec3; facing: Vec3 }
  | { type: 'enemyKilled'; enemyType: string; pos: Vec3; scoreValue: number }
  | { type: 'pickup'; pickupType: string; value: number }
  | { type: 'playerDied' }

/** Network envelope — unused in Phase 1, consumed by PeerTransport in Phase 2. */
export type NetMessage =
  | { type: 'input'; playerId: string; input: PlayerInput }
  | { type: 'snapshot'; snapshot: Snapshot }
