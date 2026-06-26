import * as THREE from 'three'
import { Player } from '../player/Player'
import { ARENA_SIZE } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { GameMode, NetMessage, PlayerInput, SessionEvent, Snapshot, VoiceRosterEntry } from '../session/protocol'
import type { Team } from '../types'
import type { MatchConfig } from '../session/MatchConfig'
import type { CollisionWorld } from '../engine/CollisionWorld'
import { saveMap, loadMaps, newMapId } from '../zones/mapStore'

interface InterpEntry {
  snapshot: { position: THREE.Vector3; rotationY: number; rotationX: number; health: number; isDead: boolean }
  time: number
}

const INTERP_DELAY = 100
const MAX_PENDING = 256

export class NetClient {
  playerId: string | null = null
  mode: GameMode | null = null
  config: MatchConfig | null = null
  latestSnapshot: Snapshot | null = null
  arenaSize: number = ARENA_SIZE
  collisionWorld: CollisionWorld | null = null

  private localSeq = 0
  private pendingInputs: PlayerInput[] = []
  private localPlayer = new Player()
  private lastDt = 1 / 30
  private snapshotCb: ((s: Snapshot) => void) | null = null
  private welcomeCb: ((playerId: string, mode: GameMode, players: { name: string; team: Team }[], started: boolean) => void) | null = null
  private joinRejectedCb: ((reason: 'badPassword' | 'full') => void) | null = null
  private disconnectCb: (() => void) | null = null
  private eventCb: ((ev: SessionEvent) => void) | null = null
  private startCb: (() => void) | null = null
  private playerJoinedCb: ((playerId: string, name: string, team: Team) => void) | null = null
  private teamChangedCb: ((playerId: string, name: string, team: Team) => void) | null = null
  private playerLeftCb: ((playerId: string) => void) | null = null
  private voiceRosterCb: ((teammates: VoiceRosterEntry[]) => void) | null = null
  private voiceStartCb: ((playerId: string, name: string) => void) | null = null
  private voiceStopCb: ((playerId: string) => void) | null = null
  private chatCb: ((msg: Extract<NetMessage, { type: 'chat' }>) => void) | null = null
  private interpBuffers = new Map<string, InterpEntry[]>()

  constructor(public transport: Transport) {
    this.transport.onMessage((msg: NetMessage) => this.handle(msg))
    this.transport.onClose(() => this.disconnectCb?.())
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
    this.localPlayer.rotation.y = input.yaw
    this.localPlayer.rotation.x = THREE.MathUtils.clamp(input.pitch, -Math.PI / 2, Math.PI / 2)
    this.localPlayer.update(dt, input, this.arenaSize, this.collisionWorld ?? undefined)
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
  onWelcome(cb: (playerId: string, mode: GameMode, players: { name: string; team: Team }[], started: boolean) => void): void { this.welcomeCb = cb }
  onJoinRejected(cb: (reason: 'badPassword' | 'full') => void): void { this.joinRejectedCb = cb }
  onDisconnect(cb: () => void): void { this.disconnectCb = cb }
  onEvent(cb: (ev: SessionEvent) => void): void { this.eventCb = cb }
  onStart(cb: () => void): void { this.startCb = cb }
  onPlayerJoined(cb: (playerId: string, name: string, team: Team) => void): void { this.playerJoinedCb = cb }
  onTeamChanged(cb: (playerId: string, name: string, team: Team) => void): void { this.teamChangedCb = cb }
  onPlayerLeft(cb: (playerId: string) => void): void { this.playerLeftCb = cb }
  onVoiceRoster(cb: (teammates: VoiceRosterEntry[]) => void): void { this.voiceRosterCb = cb }
  onVoiceStart(cb: (playerId: string, name: string) => void): void { this.voiceStartCb = cb }
  onVoiceStop(cb: (playerId: string) => void): void { this.voiceStopCb = cb }
  onChat(cb: (msg: Extract<NetMessage, { type: 'chat' }>) => void): void { this.chatCb = cb }
  sendVoiceStart(playerId: string, name: string): void { this.transport.send({ type: 'voiceStart', playerId, name }) }
  sendVoiceStop(playerId: string): void { this.transport.send({ type: 'voiceStop', playerId }) }

  private handle(msg: NetMessage): void {
    if (msg.type === 'welcome') {
      this.playerId = msg.playerId
      this.config = msg.config
      this.mode = msg.config.mode
      if (msg.config.customZone) {
        const zone = msg.config.customZone
        if (!loadMaps().find(m => m.zone.id === zone.id)) {
          saveMap({ id: newMapId(), name: zone.name, createdAt: Date.now(), zone })
        }
      }
      this.welcomeCb?.(msg.playerId, msg.config.mode, msg.players, msg.started)
    } else if (msg.type === 'joinRejected') {
      this.joinRejectedCb?.(msg.reason)
    } else if (msg.type === 'start') {
      this.startCb?.()
    } else if (msg.type === 'snapshot') {
      this.latestSnapshot = msg.snapshot
      this.reconcile(msg.snapshot)
      this.updateInterpBuffers(msg.snapshot)
      for (const ev of msg.snapshot.events) this.eventCb?.(ev)
      this.snapshotCb?.(msg.snapshot)
    } else if (msg.type === 'ping') {
      this.transport.send({ type: 'pong', t: msg.t })
    } else if (msg.type === 'playerJoined') {
      this.playerJoinedCb?.(msg.playerId, msg.name, msg.team)
    } else if (msg.type === 'teamChanged') {
      this.teamChangedCb?.(msg.playerId, msg.name, msg.team)
    } else if (msg.type === 'playerLeft') {
      this.playerLeftCb?.(msg.playerId)
    } else if (msg.type === 'voiceRoster') {
      this.voiceRosterCb?.(msg.teammates)
    } else if (msg.type === 'voiceStart') {
      this.voiceStartCb?.(msg.playerId, msg.name)
    } else if (msg.type === 'voiceStop') {
      this.voiceStopCb?.(msg.playerId)
    } else if (msg.type === 'chat') {
      this.chatCb?.(msg)
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
      this.localPlayer.rotation.y = input.yaw
      this.localPlayer.rotation.x = THREE.MathUtils.clamp(input.pitch, -Math.PI / 2, Math.PI / 2)
      this.localPlayer.update(this.lastDt, input, this.arenaSize, this.collisionWorld ?? undefined)
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
