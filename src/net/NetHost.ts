import type { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { NetMessage, SessionEvent, Snapshot } from '../session/protocol'
import type { MatchConfig } from '../session/MatchConfig'
import type { Team } from '../types'
import { applyItem } from '../player/applyPurchase'
import { findItem } from '../weapons/StoreCatalog'

interface ClientLink { playerId: string; transport: Transport }

/** Host-authoritative driver: owns the session, ingests client input, broadcasts snapshots. */
export class NetHost {
  private links: ClientLink[] = []
  /** Last measured round-trip latency per client, in ms. */
  private pings = new Map<string, number>()
  /** Last processed input seq per client — stamped onto snapshots as `ack`. */
  private lastSeq = new Map<string, number>()
  /** Monotonically increasing snapshot sequence number. */
  private snapSeq = 0

  constructor(private session: GameSession, private config: MatchConfig) {}

  addClient(playerId: string, name: string, transport: Transport, team: Team = 'ct'): void {
    this.session.addPlayer(playerId, name, team)
    this.lastSeq.set(playerId, 0)
    transport.onMessage((msg) => {
      if (msg.type === 'input' && msg.playerId === playerId) {
        this.session.applyInput(playerId, msg.input)
        this.lastSeq.set(playerId, msg.input.seq)
      } else if (msg.type === 'pong') {
        this.pings.set(playerId, Math.round(performance.now() - msg.t))
      } else if (msg.type === 'buy' && msg.playerId === playerId) {
        const entity = this.session.getPlayer(playerId)
        const item = findItem(msg.item)
        if (entity && item) applyItem(item, entity.player, entity.weapons)
      } else if (msg.type === 'startWave' && msg.playerId === playerId) {
        if (this.config.mode !== 'pvp') this.session.waveManager.spawnNextWave()
      } else if (msg.type === 'setTeam' && msg.playerId === playerId) {
        const entity = this.session.getPlayer(playerId)
        if (entity && (msg.team === 'ct' || msg.team === 't')) entity.team = msg.team
      } else if (msg.type === 'plantBomb' && msg.playerId === playerId) {
        this.session.tryPlant(playerId)
      } else if (msg.type === 'defuseBomb' && msg.playerId === playerId) {
        this.session.tryDefuse(playerId, msg.hasKit)
      }
    })
    const players = this.links.map(l => this.session.getPlayer(l.playerId)?.name ?? l.playerId)
    transport.send({ type: 'welcome', playerId, mode: this.config.mode, config: this.config, players })
    this.links.push({ playerId, transport })
    this.broadcast({ type: 'playerJoined', playerId, name })
  }

  /** Tell every client to leave the lobby and begin the match. */
  startMatch(): void {
    this.broadcast({ type: 'start' })
  }

  removeClient(playerId: string): void {
    this.links = this.links.filter(l => l.playerId !== playerId)
    this.pings.delete(playerId)
    this.lastSeq.delete(playerId)
    this.session.removePlayer(playerId)
    this.broadcast({ type: 'playerLeft', playerId })
  }

  /** Send a latency probe to every client; replies update the ping map. */
  pingClients(): void {
    const t = performance.now()
    for (const link of this.links) link.transport.send({ type: 'ping', t })
  }

  /** Advance the authoritative sim one step and broadcast the resulting snapshot. */
  tick(dt: number): SessionEvent[] {
    const events = this.session.step(dt)
    this.broadcastSnapshot(this.session.getSnapshot(), events)
    return events
  }

  /** Broadcast an already-computed snapshot without stepping the sim (host renders locally). */
  broadcastSnapshot(snapshot: Snapshot, events: SessionEvent[] = []): void {
    for (const p of snapshot.players) p.ping = this.pings.get(p.id) ?? 0
    snapshot.seq = this.snapSeq++
    snapshot.ack = Object.fromEntries(this.lastSeq)
    snapshot.events = events
    this.broadcast({ type: 'snapshot', snapshot })
  }

  private broadcast(msg: NetMessage): void {
    for (const link of this.links) link.transport.send(msg)
  }
}
