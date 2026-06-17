import { describe, it, expect } from 'vitest'
import { NetHost } from './NetHost'
import { NetClient } from './NetClient'
import { GameSession } from '../session/GameSession'
import { createLinkedTransports } from '../session/Transport'
import type { Snapshot } from '../session/protocol'

// Using createLinkedTransports from the repo — identical shape to the brief's makePair():
// each transport's send() delivers synchronously to the other's onMessage handlers.

describe('PvP integration', () => {
  it('opposite-team client shot reduces the host player health in the snapshot', () => {
    const config = { mode: 'pvp' as const, damagePolicy: 'team' as const, fragLimit: 0 }
    const session = new GameSession(config)
    // Host player on CT at origin.
    session.getPlayer(session.localId)!.team = 'ct'
    session.getPlayer(session.localId)!.player.position.set(0, 2, 0)

    const host = new NetHost(session, config)
    const [hostSide, clientSide] = createLinkedTransports()

    const client = new NetClient(clientSide)
    let latestHealth = 100
    client.onSnapshot((s) => {
      const me = s.players.find(p => p.id === session.localId)
      if (me) latestHealth = me.health
    })

    host.addClient('p1', 'Ann', hostSide, 't')
    // Place the shooter at +Z so yaw=0 (facing -Z) aims directly at the host at origin.
    // Brief had z=-8 but that fires away from origin; z=8 makes the -Z ray intersect
    // the host capsule at (0, 0..2.2, 0) within the pistol's 50-unit range.
    const shooter = session.getPlayer('p1')!
    shooter.player.position.set(0, 2, 8)
    const yaw = 0 // facing -Z toward host at origin
    client.sendInput({ forward: false, backward: false, left: false, right: false, jump: false, shoot: true, yaw, pitch: 0, seq: 0, renderTime: 0 })

    host.tick(1 / 30)
    expect(latestHealth).toBeLessThan(100)
  })

  it('same-team shot under team policy does no damage', () => {
    const config = { mode: 'pvp' as const, damagePolicy: 'team' as const, fragLimit: 0 }
    const session = new GameSession(config)
    session.getPlayer(session.localId)!.team = 'ct'
    session.getPlayer(session.localId)!.player.position.set(0, 2, 0)
    const host = new NetHost(session, config)
    const [hostSide, clientSide] = createLinkedTransports()
    const client = new NetClient(clientSide)
    let latestHealth = 100
    client.onSnapshot((s) => {
      const me = s.players.find(p => p.id === session.localId)
      if (me) latestHealth = me.health
    })
    host.addClient('p1', 'Ann', hostSide, 'ct') // same team as host
    // Same geometry fix: shooter at +Z facing -Z toward host at origin.
    session.getPlayer('p1')!.player.position.set(0, 2, 8)
    client.sendInput({ forward: false, backward: false, left: false, right: false, jump: false, shoot: true, yaw: 0, pitch: 0, seq: 0, renderTime: 0 })
    host.tick(1 / 30)
    expect(latestHealth).toBe(100)
  })

  it('match-over snapshot reaches client when fragLimit is hit', () => {
    const config = { mode: 'pvp' as const, damagePolicy: 'team' as const, fragLimit: 1 }
    const session = new GameSession(config)
    session.getPlayer(session.localId)!.team = 'ct'
    session.getPlayer(session.localId)!.player.position.set(0, 2, 0)
    session.getPlayer(session.localId)!.player.health = 1

    const host = new NetHost(session, config)
    const [hostSide, clientSide] = createLinkedTransports()
    const client = new NetClient(clientSide)

    let latestSnap: Snapshot | null = null
    client.onSnapshot((s) => { latestSnap = s })

    host.addClient('p1', 'Ann', hostSide, 't')
    session.getPlayer('p1')!.player.position.set(0, 2, 8)

    client.sendInput({ forward: false, backward: false, left: false, right: false, jump: false, shoot: true, yaw: 0, pitch: 0, seq: 0, renderTime: 0 })

    host.tick(1 / 30)

    expect(latestSnap).not.toBeNull()
    expect(latestSnap!.scores.matchOver).toBe(true)
    expect(latestSnap!.scores.winningTeam).toBe('t')
    expect(latestSnap!.events.some(ev => ev.type === 'matchOver')).toBe(true)
  })

  it('welcome propagates config to the client', () => {
    const config = { mode: 'hybrid' as const, damagePolicy: 'ffa' as const, fragLimit: 7 }
    const session = new GameSession(config)
    const host = new NetHost(session, config)
    const [hostSide, clientSide] = createLinkedTransports()
    const client = new NetClient(clientSide)
    host.addClient('p1', 'Ann', hostSide, 't')
    expect(client.config).toEqual(config)
  })
})
