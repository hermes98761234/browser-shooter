import type { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { GameMode, NetMessage, SessionEvent, Snapshot } from '../session/protocol'

interface ClientLink { playerId: string; transport: Transport }

/** Host-authoritative driver: owns the session, ingests client input, broadcasts snapshots. */
export class NetHost {
  private links: ClientLink[] = []
  /** Last measured round-trip latency per client, in ms. */
  private pings = new Map<string, number>()

  constructor(private session: GameSession, private mode: GameMode) {}

  addClient(playerId: string, name: string, transport: Transport): void {
    this.session.addPlayer(playerId, name)
    transport.onMessage((msg) => {
      if (msg.type === 'input' && msg.playerId === playerId) {
        this.session.applyInput(playerId, msg.input)
      } else if (msg.type === 'pong') {
        this.pings.set(playerId, Math.round(performance.now() - msg.t))
      }
    })
    transport.send({ type: 'welcome', playerId, mode: this.mode })
    this.links.push({ playerId, transport })
    this.broadcast({ type: 'playerJoined', playerId, name })
  }

  removeClient(playerId: string): void {
    this.links = this.links.filter(l => l.playerId !== playerId)
    this.pings.delete(playerId)
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
    this.broadcastSnapshot(this.session.getSnapshot())
    return events
  }

  /** Broadcast an already-computed snapshot without stepping the sim (host renders locally). */
  broadcastSnapshot(snapshot: Snapshot): void {
    // Stamp each player's measured ping so every client renders the same scoreboard.
    // The host itself is the authority, so its own latency is 0.
    for (const p of snapshot.players) p.ping = this.pings.get(p.id) ?? 0
    this.broadcast({ type: 'snapshot', snapshot })
  }

  private broadcast(msg: NetMessage): void {
    for (const link of this.links) link.transport.send(msg)
  }
}
