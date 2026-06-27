import { SpeakerRegistry, type Speaker } from './SpeakerRegistry'
import { reconcileMesh } from './voiceMesh'
import type { VoicePeer, VoiceCall, MicProvider } from './VoiceTransport'
import type { VoiceRosterEntry } from '../session/protocol'

export interface VoiceChatDeps {
  peer: VoicePeer
  mic: MicProvider
  localPlayerId: string
  localName: string
  sendStart: (playerId: string, name: string) => void
  sendStop: (playerId: string) => void
  onSpeakersChanged: (speakers: Speaker[]) => void
  playStream: (peerId: string, stream: MediaStream) => void
  stopStream: (peerId: string) => void
  now?: () => number
  heartbeatMs?: number
  ttlMs?: number
}

/** Orchestrates push-to-talk: lazy mic, a teammate audio mesh, and the
 *  active-speaker registry. Voice "activates" on the first startTalking()
 *  (which acquires the mic); the indicator works independently of media. */
export class VoiceChat {
  private registry: SpeakerRegistry
  private roster: VoiceRosterEntry[] = []
  private calls = new Map<string, VoiceCall>() // peerId -> call
  private mic: MediaStream | null = null
  private activated = false
  private disposed = false
  private talking = false
  private lastSent = 0
  private now: () => number
  private heartbeatMs: number

  private peerIdByPlayerId = new Map<string, string>()
  private incomingCallHandler?: (call: VoiceCall) => void

  constructor(private deps: VoiceChatDeps) {
    this.now = deps.now ?? (() => performance.now())
    this.heartbeatMs = deps.heartbeatMs ?? 1000
    this.registry = new SpeakerRegistry(deps.ttlMs ?? 2500)
    this.incomingCallHandler = (call) => this.handleIncoming(call)
    deps.peer.onIncomingCall(this.incomingCallHandler)
  }

  setRoster(teammates: VoiceRosterEntry[]): void {
    for (const e of teammates) this.peerIdByPlayerId.set(e.playerId, e.peerId)
    this.roster = teammates
    if (this.activated) this.reconcile()
  }

  async startTalking(): Promise<void> {
    if (this.talking) return
    this.talking = true
    if (!this.activated) await this.activate()
    this.setMicEnabled(true)
    this.registry.start(this.deps.localPlayerId, this.deps.localName, this.now())
    this.deps.sendStart(this.deps.localPlayerId, this.deps.localName)
    this.lastSent = this.now()
    this.emit()
  }

  stopTalking(): void {
    if (!this.talking) return
    this.talking = false
    this.setMicEnabled(false)
    this.registry.stop(this.deps.localPlayerId)
    this.deps.sendStop(this.deps.localPlayerId)
    this.emit()
  }

  remoteStart(playerId: string, name: string): void {
    this.registry.start(playerId, name, this.now())
    this.emit()
  }

  remoteStop(playerId: string): void {
    this.registry.stop(playerId)
    this.emit()
  }

  peerDisconnected(playerId: string): void {
    const peerId = this.peerIdByPlayerId.get(playerId)
    if (peerId) {
      this.closeCall(peerId)
      this.peerIdByPlayerId.delete(playerId)
    }
    this.registry.remove(playerId)
    this.emit()
  }

  /** Drive each frame: resend talk heartbeats, prune stale speakers. */
  tick(now: number): void {
    if (this.talking && now - this.lastSent >= this.heartbeatMs) {
      this.registry.start(this.deps.localPlayerId, this.deps.localName, now)
      this.deps.sendStart(this.deps.localPlayerId, this.deps.localName)
      this.lastSent = now
    }
    const before = this.registry.size
    this.registry.prune(now)
    if (this.registry.size !== before) this.emit()
  }

  dispose(): void {
    this.disposed = true
    for (const peerId of [...this.calls.keys()]) this.closeCall(peerId)
    this.mic?.getAudioTracks().forEach(t => t.stop())
    this.mic = null
    if (this.incomingCallHandler) {
      this.deps.peer.offIncomingCall(this.incomingCallHandler)
    }
  }

  private async activate(): Promise<void> {
    const stream = await this.deps.mic.getStream()
    if (this.disposed) {
      stream.getAudioTracks().forEach(t => t.stop())
      return
    }
    this.mic = stream
    this.setMicEnabled(false)
    this.activated = true
    this.reconcile()
  }

  private reconcile(): void {
    if (!this.mic) return
    const teammatePeerIds = this.roster.map(r => r.peerId)
    const { toOpen, toClose } = reconcileMesh(this.deps.peer.id, [...this.calls.keys()], teammatePeerIds)
    for (const peerId of toClose) this.closeCall(peerId)
    for (const peerId of toOpen) this.openCall(peerId)
  }

  private openCall(peerId: string): void {
    if (this.calls.has(peerId) || !this.mic) return
    this.wireCall(this.deps.peer.call(peerId, this.mic))
  }

  private handleIncoming(call: VoiceCall): void {
    const isTeammate = this.roster.some(r => r.peerId === call.peerId)
    if (!this.activated || !this.mic || !isTeammate || this.calls.has(call.peerId)) {
      call.close()
      return
    }
    call.answer(this.mic)
    this.wireCall(call)
  }

  private wireCall(call: VoiceCall): void {
    this.calls.set(call.peerId, call)
    call.onStream((stream) => {
      if (this.calls.get(call.peerId) !== call) return  // ignore buffered events after cleanup or re-call
      this.deps.playStream(call.peerId, stream)
    })
    call.onClose(() => this.cleanupCall(call.peerId))
  }

  private closeCall(peerId: string): void {
    const call = this.calls.get(peerId)
    if (!call) return
    call.close()
    this.cleanupCall(peerId)
  }

  /** Idempotent teardown: runs once per peer whether closed locally or remotely. */
  private cleanupCall(peerId: string): void {
    if (!this.calls.has(peerId)) return
    this.calls.delete(peerId)
    this.deps.stopStream(peerId)
  }

  private setMicEnabled(on: boolean): void {
    this.mic?.getAudioTracks().forEach(t => { t.enabled = on })
  }

  private emit(): void {
    this.deps.onSpeakersChanged(this.registry.list())
  }
}
