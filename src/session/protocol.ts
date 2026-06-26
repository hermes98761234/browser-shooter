import type { Vec3, Team } from '../types'
import type { HitZone } from '../systems/DamageZones'
import type { MatchConfig } from './MatchConfig'
import type { MatchScores } from './Scoreboard'

export type GameMode = 'coop' | 'pvp' | 'hybrid' | 'competitive'
export const GAME_MODES: readonly GameMode[] = ['coop', 'pvp', 'hybrid', 'competitive'] as const

export type { MatchScores, PlayerScore } from './Scoreboard'

export interface PlayerInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
  shoot: boolean
  yaw: number   // absolute look yaw (radians)
  pitch: number // absolute look pitch (radians)
  seq: number
  renderTime: number
}

export function emptyInput(): PlayerInput {
  return { forward: false, backward: false, left: false, right: false, jump: false, shoot: false, yaw: 0, pitch: 0, seq: 0, renderTime: 0 }
}

export interface EntityState {
  id: string
  kind: 'player' | 'enemy'
  type: string
  position: Vec3
  rotationY: number
  rotationX?: number   // pitch (players only; remote aim)
  health: number
  isDead: boolean
  weaponType?: string  // players only; for remote weapon model
  name?: string        // players only; nameplate
  team?: Team          // players only
  isBot?: boolean      // players only; true for AI-controlled bots
  respawnIn?: number   // players only; seconds until respawn (omitted if alive)
  ping?: number        // players only; round-trip latency in ms (host-measured)
  hasArmor?: boolean   // players only; armor state
  hasHelmet?: boolean  // players only; helmet state
}

export interface GrenadeState {
  id: string
  type: 'he' | 'flash' | 'smoke'
  position: Vec3
  velocity: Vec3
  rotation: Vec3
  bounces: number
  fuseTimer: number
  thrownBy: string
}

export interface VoiceRosterEntry {
  playerId: string
  peerId: string   // PeerJS id used for the direct voice mesh
  name: string
}

export interface Snapshot {
  tick: number
  seq: number
  ack: Record<string, number>
  players: EntityState[]
  enemies: EntityState[]
  grenades: GrenadeState[]
  events: SessionEvent[]
  scores: MatchScores
  round?: number
  roundTimer?: number
  buyPhase?: boolean
  buyPhaseTimer?: number
  ctScore?: number
  tScore?: number
  bomb?: {
    state: string
    carrier?: string
    position?: Vec3
    site?: 'A' | 'B'
    timer?: number
    plantProgress?: number
    defuseProgress?: number
    defuseDuration?: number
  }
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
  | { type: 'enemyShoot'; from: Vec3; to: Vec3; hit: boolean; damage: number; victimId: string }
  | { type: 'playerShot'; shooterId: string; from: Vec3; to: Vec3 }
  | { type: 'enemyMelee'; damage: number; enemyPos: Vec3; victimId: string }
  | { type: 'enemyTelegraph'; enemyPos: Vec3; facing: Vec3 }
  | { type: 'enemyKilled'; enemyType: string; pos: Vec3; scoreValue: number }
  | { type: 'pickup'; pickupType: string; value: number; playerId: string }
  | { type: 'playerDied'; playerId: string }
  | { type: 'playerHitPlayer'; hit: HitEvent; victimId: string }
  | { type: 'playerKilledPlayer'; attackerId: string; victimId: string; victimTeam: Team; teamkill: boolean; zone: HitZone }
  | { type: 'playerRespawned'; playerId: string }
  | { type: 'matchOver'; winningTeam: Team }
  | { type: 'roundStart'; round: number; money: number; ctScore: number; tScore: number }
  | { type: 'roundEnd'; winner: 'ct' | 't' | 'draw'; reason: string; ctScore: number; tScore: number }
  | { type: 'buyPhaseStart'; duration: number }
  | { type: 'buyPhaseEnd' }
  | { type: 'halftime'; ctScore: number; tScore: number }
  | { type: 'moneyUpdate'; playerId: string; amount: number }
  | { type: 'bombPlanted'; site: 'A' | 'B'; planterId: string; timer: number }
  | { type: 'bombDropped'; position: Vec3; playerId: string }
  | { type: 'bombPickedUp'; playerId: string }
  | { type: 'bombExploded'; site: 'A' | 'B' }
  | { type: 'bombDefused'; site: 'A' | 'B' }
  | { type: 'grenadeThrown'; playerId: string; grenadeType: 'he' | 'flash' | 'smoke'; position: Vec3; velocity: Vec3; id: string }
  | { type: 'grenadeDetonated'; id: string; position: Vec3; grenadeType: 'he' | 'flash' | 'smoke'; affectedPlayers: string[]; blindDurations?: Record<string, number> }

/** Network envelope carried by Transport. */
export type NetMessage =
  | { type: 'input'; playerId: string; input: PlayerInput }
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'join'; name: string; team?: Team; password?: string }
  | { type: 'welcome'; playerId: string; mode: GameMode; config: MatchConfig; players: { name: string; team: Team }[]; started: boolean }
  | { type: 'joinRejected'; reason: 'badPassword' | 'full' }
  | { type: 'playerJoined'; playerId: string; name: string; team: Team }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'teamChanged'; playerId: string; name: string; team: Team }
  | { type: 'ping'; t: number }   // host→client latency probe (echo t back)
  | { type: 'pong'; t: number }   // client→host reply carrying the original t
  | { type: 'probe'; t: number }     // pre-join latency probe from a browsing client
  | { type: 'probeAck'; t: number }  // host reply echoing t back to the prober
  | { type: 'buy'; playerId: string; item: string }
  | { type: 'startWave'; playerId: string }
  | { type: 'setTeam'; playerId: string; team: Team }
  | { type: 'plantBomb'; playerId: string }
  | { type: 'defuseBomb'; playerId: string; hasKit: boolean }
  | { type: 'throwGrenade'; playerId: string; grenadeType: 'he' | 'flash' | 'smoke'; mode: 'long' | 'short' }
  | { type: 'voiceRoster'; teammates: VoiceRosterEntry[] }
  | { type: 'voiceStart'; playerId: string; name: string }
  | { type: 'voiceStop'; playerId: string }
  | { type: 'start' }
