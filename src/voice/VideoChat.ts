import { reconcileMesh } from './voiceMesh'
import type { VoicePeer, VoiceCall, CamProvider } from './VoiceTransport'
import type { VoiceRosterEntry } from '../session/protocol'

export interface VideoChatDeps {
  peer: VoicePeer
  cam: CamProvider
  localPlayerId: string
  onStreamsChanged: (streams: Map<string, MediaStream>) => void
}

export class VideoChat {
  private roster: VoiceRosterEntry[] = []
  private calls = new Map<string, VoiceCall>()
  private streams = new Map<string, MediaStream>()
  private camStream: MediaStream | null = null
  private cameraOn = false
  private activated = false
  private disposed = false
  private activating: Promise<void> | null = null  // serialises concurrent toggles
  private closing = new Set<string>()
  private peerIdByPlayerId = new Map<string, string>()
  private incomingCallHandler?: (call: VoiceCall) => void

  constructor(private deps: VideoChatDeps) {
    this.incomingCallHandler = (call) => this.handleIncoming(call)
    deps.peer.onIncomingCall(this.incomingCallHandler)
  }

  setRoster(teammates: VoiceRosterEntry[]): void {
    for (const e of teammates) this.peerIdByPlayerId.set(e.playerId, e.peerId)
    this.roster = teammates
    if (this.activated && this.cameraOn) this.reconcile()
  }

  async toggleCamera(): Promise<void> {
    if (this.activating) {
      await this.activating  // wait for in-flight activation to finish, then continue
    }
    if (!this.activated) {
      this.activating = (async () => {
        const stream = await this.deps.cam.getStream()
        if (this.disposed) {
          stream.getVideoTracks().forEach(t => t.stop())
          return
        }
        this.camStream = stream
        this.camStream.getVideoTracks().forEach(t => { t.enabled = false })
        this.activated = true
      })()
      await this.activating
      this.activating = null
      if (this.disposed) return
    }
    this.cameraOn = !this.cameraOn
    this.camStream!.getVideoTracks().forEach(t => { t.enabled = this.cameraOn })
    if (this.cameraOn) {
      this.reconcile()
    } else {
      for (const peerId of [...this.calls.keys()]) this.closeCall(peerId)
    }
  }

  get localStream(): MediaStream | null {
    return this.cameraOn ? this.camStream : null
  }

  peerDisconnected(playerId: string): void {
    const peerId = this.peerIdByPlayerId.get(playerId)
    if (peerId) {
      this.closeCall(peerId)
      this.peerIdByPlayerId.delete(playerId)
    }
  }

  dispose(): void {
    this.disposed = true
    for (const peerId of [...this.calls.keys()]) this.closeCall(peerId)
    this.camStream?.getVideoTracks().forEach(t => t.stop())
    this.camStream = null
    if (this.incomingCallHandler) {
      this.deps.peer.offIncomingCall(this.incomingCallHandler)
    }
  }

  private reconcile(): void {
    if (!this.camStream || !this.cameraOn) return
    const teammatePeerIds = this.roster.map(r => r.peerId)
    const { toOpen, toClose } = reconcileMesh(this.deps.peer.id, [...this.calls.keys()], teammatePeerIds)
    for (const peerId of toClose) this.closeCall(peerId)
    for (const peerId of toOpen) this.openCall(peerId)
  }

  private openCall(peerId: string): void {
    if (this.calls.has(peerId) || !this.camStream) return
    this.wireCall(this.deps.peer.call(peerId, this.camStream))
  }

  private handleIncoming(call: VoiceCall): void {
    const isRosterMember = this.roster.some(r => r.peerId === call.peerId)
    if (!this.activated || !this.cameraOn || !this.camStream || !isRosterMember || this.calls.has(call.peerId)) {
      call.close()
      return
    }
    call.answer(this.camStream)
    this.wireCall(call)
  }

  private wireCall(call: VoiceCall): void {
    this.calls.set(call.peerId, call)
    call.onStream((stream) => {
      if (this.calls.get(call.peerId) !== call) return  // ignore buffered events after cleanup or re-call
      this.streams.set(call.peerId, stream)
      this.emit()
    })
    call.onClose(() => this.cleanupCall(call.peerId))
  }

  private closeCall(peerId: string): void {
    const call = this.calls.get(peerId)
    if (!call) return
    this.closing.add(peerId)
    call.close()
    this.cleanupCall(peerId)
    this.closing.delete(peerId)
  }

  private cleanupCall(peerId: string): void {
    if (!this.calls.has(peerId)) return
    this.calls.delete(peerId)
    this.streams.delete(peerId)
    this.emit()
    // Only retry when remote closed — local close (dispose, toggleOff, peerDisconnected) sets closing flag
    if (!this.closing.has(peerId) && this.cameraOn && !this.disposed) this.reconcile()
  }

  private emit(): void {
    this.deps.onStreamsChanged(new Map(this.streams))
  }
}
