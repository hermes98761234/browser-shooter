import type { Transport } from '../session/Transport'
import type { GameMode, NetMessage, PlayerInput, Snapshot } from '../session/protocol'

/** Client-side driver: joins, forwards input, tracks the latest authoritative snapshot. */
export class NetClient {
  playerId: string | null = null
  mode: GameMode | null = null
  latestSnapshot: Snapshot | null = null

  private snapshotCb: ((s: Snapshot) => void) | null = null
  private welcomeCb: ((playerId: string, mode: GameMode) => void) | null = null

  constructor(private transport: Transport) {
    this.transport.onMessage((msg: NetMessage) => this.handle(msg))
  }

  join(name: string): void {
    this.transport.send({ type: 'join', name })
  }

  sendInput(input: PlayerInput): void {
    if (!this.playerId) return
    this.transport.send({ type: 'input', playerId: this.playerId, input })
  }

  onSnapshot(cb: (s: Snapshot) => void): void { this.snapshotCb = cb }
  onWelcome(cb: (playerId: string, mode: GameMode) => void): void { this.welcomeCb = cb }

  private handle(msg: NetMessage): void {
    if (msg.type === 'welcome') {
      this.playerId = msg.playerId
      this.mode = msg.mode
      this.welcomeCb?.(msg.playerId, msg.mode)
    } else if (msg.type === 'snapshot') {
      this.latestSnapshot = msg.snapshot
      this.snapshotCb?.(msg.snapshot)
    } else if (msg.type === 'ping') {
      this.transport.send({ type: 'pong', t: msg.t })
    }
  }
}
