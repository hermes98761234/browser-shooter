import type { Team } from '../types'
import type { GameMode } from './protocol'
import type { ZoneDef } from '../zones/ZoneDef'

export type DamagePolicy = 'team' | 'friendly' | 'ffa'
export type JoinPolicy = 'lobby' | 'free'

export interface MatchConfig {
  mode: GameMode
  damagePolicy: DamagePolicy
  fragLimit: number // team score to win; 0 = endless
  roundsToWin?: number
  buyPhaseDuration?: number
  roundDuration?: number
  joinPolicy?: JoinPolicy   // 'lobby' (default) | 'free'
  password?: string         // only meaningful when joinPolicy === 'free'; blank/undefined = open
  zoneId?: string           // selected zone id; undefined falls back to the default zone (Arid)
  randomSeed?: number       // seed for the random zone; host generates once, clients receive via welcome
  customZone?: ZoneDef     // full zone definition when zoneId === 'custom'
  voiceMode?: 'team' | 'proximity'
}

export function defaultMatchConfig(): MatchConfig {
  return { mode: 'coop', damagePolicy: 'team', fragLimit: 30, joinPolicy: 'lobby', zoneId: 'arid' }
}

export function defaultCompetitiveConfig(): MatchConfig {
  return {
    mode: 'competitive',
    damagePolicy: 'team',
    fragLimit: 0,
    roundsToWin: 16,
    buyPhaseDuration: 15,
    roundDuration: 115,
    joinPolicy: 'lobby',
    zoneId: 'arid',
  }
}

/** Can `attacker`'s team damage `target`'s team under `policy`? Pure. */
export function canDamage(attacker: Team, target: Team, policy: DamagePolicy): boolean {
  if (policy === 'ffa') return true
  if (policy === 'friendly') return true
  return attacker !== target // 'team': opposite only
}
