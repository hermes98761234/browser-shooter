import type { Team } from '../types'
import type { DamagePolicy } from './MatchConfig'

export interface PlayerScore { kills: number; deaths: number }
export interface MatchScores {
  teams: { ct: number; t: number }
  players: Record<string, PlayerScore>
  matchOver: boolean
  winningTeam: Team | null
}

export class Scoreboard {
  private teams = { ct: 0, t: 0 }
  private players = new Map<string, PlayerScore>()
  matchOver = false
  winningTeam: Team | null = null

  constructor(private fragLimit = 0) {}

  private ensure(id: string): PlayerScore {
    let s = this.players.get(id)
    if (!s) { s = { kills: 0, deaths: 0 }; this.players.set(id, s) }
    return s
  }

  recordKill(attackerId: string, attackerTeam: Team, victimId: string, victimTeam: Team, policy: DamagePolicy): void {
    if (this.matchOver) return
    this.ensure(victimId).deaths++
    if (attackerId === victimId) return // suicide: no credit
    const attacker = this.ensure(attackerId)
    const sameTeam = attackerTeam === victimTeam
    if (policy === 'friendly' && sameTeam) {
      attacker.kills-- // teamkill penalty, no team score
    } else {
      attacker.kills++
      this.teams[attackerTeam]++
    }
    if (this.fragLimit > 0 && this.teams[attackerTeam] >= this.fragLimit) {
      this.matchOver = true
      this.winningTeam = attackerTeam
    }
  }

  recordDeath(victimId: string): void {
    if (this.matchOver) return
    this.ensure(victimId).deaths++
  }

  snapshot(): MatchScores {
    return {
      teams: { ...this.teams },
      players: Object.fromEntries([...this.players].map(([id, s]) => [id, { ...s }])),
      matchOver: this.matchOver,
      winningTeam: this.winningTeam,
    }
  }

  reset(): void {
    this.teams = { ct: 0, t: 0 }
    this.players.clear()
    this.matchOver = false
    this.winningTeam = null
  }
}
