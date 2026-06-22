import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GameSession } from './GameSession'
import { defaultCompetitiveConfig, defaultMatchConfig } from './MatchConfig'
import { RoundState } from './RoundManager'
import { emptyInput } from './protocol'
import { BotController } from '../bots/BotController'

describe('bot reload (bug 3)', () => {
  it('a bot with an empty mag triggers a reload instead of staying dry', () => {
    const s = new GameSession({ ...defaultMatchConfig(), mode: 'pvp' })
    const ct = s.addBot('ct')!
    const t = s.addBot('t')!
    ct.player.position.set(0, 2, 0)
    t.player.position.set(0, 2, -5)
    const bot = new BotController(ct.id)
    ct.weapons.current.ammo = 0
    bot.computeInput(ct, [ct, t], null, 1 / 60)
    expect(ct.weapons.current.isReloading).toBe(true)
  })
})

describe('coop bots fight the wave, not each other (bug 6)', () => {
  it('a coop bot aims at the supplied wave hostile, never a teammate/enemy player', () => {
    const s = new GameSession({ ...defaultMatchConfig(), mode: 'coop' })
    const ct = s.addBot('ct')!
    const t = s.addBot('t')!
    ct.player.position.set(0, 2, 0)
    t.player.position.set(3, 2, 0) // an enemy-team player right next to it
    // Coop path: session passes an explicit (here empty) hostile list. With no wave
    // enemies present the bot must stay idle rather than turning on the T player.
    const idle = new BotController(ct.id).computeInput(ct, [ct, t], null, 1 / 60, [])
    expect(idle.shoot).toBe(false)
    expect(idle.forward || idle.backward || idle.left || idle.right).toBe(false)
    expect(idle.yaw).toBe(0) // never faced the player
  })

  it('engages a wave hostile when one is supplied', () => {
    const s = new GameSession({ ...defaultMatchConfig(), mode: 'coop' })
    const ct = s.addBot('ct')!
    ct.player.position.set(0, 2, 0)
    const input = new BotController(ct.id).computeInput(ct, [ct], null, 1 / 60, [new THREE.Vector3(5, 2, -5)])
    expect(input.yaw).not.toBe(0) // turned to face the off-axis hostile
  })
})

describe('competitive round ends on elimination (bug 8)', () => {
  it('wiping the enemy team ends the round and revives everyone with full mags', () => {
    const s = new GameSession({ ...defaultCompetitiveConfig() })
    const me = s.getPlayer(s.localId)!
    me.team = 'ct'
    const t = s.addBot('t')!
    s.roundManager!.state = RoundState.Active
    // Kill the only T -> CT should win by elimination next step.
    t.player.takeDamage(999)
    s.applyInput(s.localId, emptyInput())
    const events = s.step(1 / 60)
    expect(events.some(e => e.type === 'roundEnd')).toBe(true)
    // concludeRound revives everyone for the next round.
    expect(t.player.isDead).toBe(false)
    expect(s.roundManager!.ctScore).toBe(1)
  })

  it('does not end the round during the buy phase (everyone alive)', () => {
    const s = new GameSession({ ...defaultCompetitiveConfig() })
    s.getPlayer(s.localId)!.team = 'ct'
    s.addBot('t')
    s.roundManager!.state = RoundState.Buying
    const events = s.step(1 / 60)
    expect(events.some(e => e.type === 'roundEnd')).toBe(false)
  })
})
