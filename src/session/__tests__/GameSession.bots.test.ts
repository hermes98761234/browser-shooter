import { describe, it, expect } from 'vitest'
import { GameSession, MAX_BOTS } from '../GameSession'
import { defaultCompetitiveConfig } from '../MatchConfig'
import { RoundState } from '../RoundManager'
import * as THREE from 'three'

function pvpSession(): GameSession {
  return new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
}

describe('GameSession bots', () => {
  it('addBot creates an AI player with a BOT name, team, and a rifle', () => {
    const s = pvpSession()
    const bot = s.addBot('t')!
    expect(bot).not.toBeNull()
    expect(bot.isBot).toBe(true)
    expect(bot.team).toBe('t')
    expect(bot.name.startsWith('BOT ')).toBe(true)
    expect(bot.weapons.current.type).toBe('rifle')
    expect(s.getPlayer(bot.id)).toBe(bot)
  })

  it('removeBot removes the bot from the player map', () => {
    const s = pvpSession()
    const bot = s.addBot('ct')!
    s.removeBot(bot.id)
    expect(s.getPlayer(bot.id)).toBeUndefined()
  })

  it('marks bots (and only bots) with isBot in the snapshot', () => {
    const s = pvpSession()
    const bot = s.addBot('t')!
    const snap = s.getSnapshot()
    const botState = snap.players.find(p => p.id === bot.id)!
    const human = snap.players.find(p => p.id === s.localId)!
    expect(botState.isBot).toBe(true)
    expect(human.isBot).toBeFalsy()
  })

  it('drives the bot to face its enemy during step', () => {
    const s = pvpSession()
    // Local human is CT at the origin; put a T bot directly behind it on +Z.
    const bot = s.addBot('t')!
    bot.player.position.set(0, 2, 10)
    bot.player.rotation.set(0, 0, 0)
    s.step(0.05)
    // Bot should now look toward the human at the origin (-Z from the bot).
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(bot.player.rotation.x, bot.player.rotation.y, 0, 'YXZ'))
    const dirToHuman = new THREE.Vector3(0, 0, -10).normalize()
    expect(fwd.dot(dirToHuman)).toBeGreaterThan(0.95)
  })

  it('keeps bots armed with a rifle through a competitive round reset', () => {
    const s = new GameSession(defaultCompetitiveConfig())
    const bot = s.addBot('t')!
    expect(bot.weapons.current.type).toBe('rifle')
    // Force the round to end; step() concludes it and respawns everyone with a fresh loadout.
    s.roundManager!.state = RoundState.Over
    s.step(0.016)
    expect(bot.weapons.current.type).toBe('rifle')
  })

  it('re-arms a bot with a rifle after a competitive death reset', () => {
    const s = new GameSession(defaultCompetitiveConfig())
    const bot = s.addBot('ct')!
    s.handleDeath(bot.id)
    expect(bot.weapons.current.type).toBe('rifle')
  })

  it('caps the number of bots and returns null once the cap is reached', () => {
    const s = pvpSession()
    for (let i = 0; i < MAX_BOTS; i++) {
      expect(s.addBot(i % 2 === 0 ? 'ct' : 't')).not.toBeNull()
    }
    expect(s.addBot('ct')).toBeNull()
  })

  it('records a bot kill on the scoreboard by id', () => {
    const s = pvpSession()
    const bot = s.addBot('t')!
    s.scoreboard.recordKill(bot.id, 't', s.localId, 'ct', 'team')
    const scores = s.getSnapshot().scores
    expect(scores.players[bot.id].kills).toBe(1)
    expect(scores.players[s.localId].deaths).toBe(1)
  })
})
