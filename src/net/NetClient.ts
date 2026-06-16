import * as THREE from 'three'
import { Player } from '../player/Player'
import { ARENA_SIZE } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { GameMode, NetMessage, PlayerInput, SessionEvent, Snapshot } from '../session/protocol'

interface InterpEntry {
  snapshot: { position: THREE.Vector3; rotationY: number; rotationX: number; health: number; isDead: boolean }
  time: number
}

const INTERP_DELAY = 100
const MAX_PENDING = 256

export class NetClient {
  playerId: string | null = null
  mode: GameMode | null = null
  latestSnapshot: Snapshot | null = null

  private localSeq = 0
  private pendingInputs: PlayerInput[] = []
  private localPlayer = new Player()
  private lastDt = 1 / 30
  private snapshotCb: ((s: Snapshot) => void) | null = null
  private welcomeCb: ((playerId: string, mode: GameMode) => void) | null = null
  private eventCb: ((ev: SessionEvent) => void) | null = null
  private interpBuffers = new Map<string, InterpEntry[]>()

  constructor(private transport: Transport) {
    this.transport.onMessage((msg: NetMessage) => this.handle(msg))
  }

  join(name: string): void {
    this.transport.send({ type: 'join', name })
  }

  sendInput(input: PlayerInput): void {
    if (!this.playerId) return
    const seqInput = { ...input, seq: ++this.localSeq, renderTime: performance.now() }
    this.transport.send({ type: 'input', playerId: this.playerId, input: seqInput })
    this.pendingInputs.push(seqInput)
    if (this.pendingInputs.length > MAX_PENDING) this.pendingInputs.shift()
  }

  predictLocal(dt: number): void {
    if (!this.playerId || this.pendingInputs.length === 0) return
    this.lastDt = dt
    const input = this.pendingInputs[this.pendingInputs.length - 1]
    this.localPlayer.update(dt, input, ARENA_SIZE)
  }

  getLocalPosition(): THREE.Vector3 {
    return this.localPlayer.position
  }

  getLocalRotation(): THREE.Euler {
    return this.localPlayer.rotation
  }

  get pendingInputCount(): number {
    return this.pendingInputs.length
  }

  getInterpolatedPosition(id: string, renderTime: number): THREE.Vector3 | null {
    const buf = this.interpBuffers.get(id)
    if (!buf || buf.length < 2) return null

    const t = renderTime - INTERP_DELAY
    let a: InterpEntry | null = null
    let b: InterpEntry | null = null
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].time <= t && buf[i + 1].time >= t) {
        a = buf[i]
        b = buf[i + 1]
        break
      }
    }
    if (!a || !b) return buf[buf.length - 1].snapshot.position.clone()

    const frac = (t - a.time) / (b.time - a.time)
    return new THREE.Vector3().lerpVectors(a.snapshot.position, b.snapshot.position, frac)
  }

  getInterpolatedRotation(id: string, renderTime: number): { yaw: number; pitch: number } | null {
    const buf = this.interpBuffers.get(id)
    if (!buf || buf.length < 2) return null

    const t = renderTime - INTERP_DELAY
    let a: InterpEntry | null = null
    let b: InterpEntry | null = null
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].time <= t && buf[i + 1].time >= t) {
        a = buf[i]
        b = buf[i + 1]
        break
      }
    }
    if (!a || !b) {
      const last = buf[buf.length - 1].snapshot
      return { yaw: last.rotationY, pitch: last.rotationX }
    }

    const frac = (t - a.time) / (b.time - a.time)
    return {
      yaw: a.snapshot.rotationY + (b.snapshot.rotationY - a.snapshot.rotationY) * frac,
      pitch: a.snapshot.rotationX + (b.snapshot.rotationX - a.snapshot.rotationX) * frac,
    }
  }

  onSnapshot(cb: (s: Snapshot) => void): void { this.snapshotCb = cb }
  onWelcome(cb: (playerId: string, mode: GameMode) => void): void { this.welcomeCb = cb }
  onEvent(cb: (ev: SessionEvent) => void): void { this.eventCb = cb }

  private handle(msg: NetMessage): void {
    if (msg.type === 'welcome') {
      this.playerId = msg.playerId
      this.mode = msg.mode
      this.welcomeCb?.(msg.playerId, msg.mode)
    } else if (msg.type === 'snapshot') {
      this.latestSnapshot = msg.snapshot
      this.reconcile(msg.snapshot)
      this.updateInterpBuffers(msg.snapshot)
      for (const ev of msg.snapshot.events) this.eventCb?.(ev)
      this.snapshotCb?.(msg.snapshot)
    } else if (msg.type === 'ping') {
      this.transport.send({ type: 'pong', t: msg.t })
    }
  }

  private reconcile(snap: Snapshot): void {
    if (!this.playerId) return
    const me = snap.players.find(p => p.id === this.playerId)
    if (!me) return

    const ack = snap.ack[this.playerId] ?? 0
    this.pendingInputs = this.pendingInputs.filter(i => i.seq > ack)

    this.localPlayer.position.set(me.position.x, me.position.y, me.position.z)
    this.localPlayer.rotation.y = me.rotationY
    this.localPlayer.rotation.x = me.rotationX ?? 0
    this.localPlayer.health = me.health

    for (const input of this.pendingInputs) {
      this.localPlayer.update(this.lastDt, input, ARENA_SIZE)
    }
  }

  private updateInterpBuffers(snap: Snapshot): void {
    const now = performance.now()
    for (const p of snap.players) {
      if (p.id === this.playerId) continue
      let buf = this.interpBuffers.get(p.id)
      if (!buf) { buf = []; this.interpBuffers.set(p.id, buf) }
      buf.push({
        snapshot: {
          position: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
          rotationY: p.rotationY,
          rotationX: p.rotationX ?? 0,
          health: p.health,
          isDead: p.isDead,
        },
        time: now,
      })
      while (buf.length > 10) buf.shift()
    }
  }
}
