import type Peer from 'peerjs'
import type { MediaConnection } from 'peerjs'

/** Acquires the local microphone stream (lazily, once). */
export interface MicProvider {
  getStream(): Promise<MediaStream>
}

/** A single peer-to-peer audio call. */
export interface VoiceCall {
  readonly peerId: string
  answer(stream: MediaStream): void
  onStream(cb: (stream: MediaStream) => void): void
  onClose(cb: () => void): void
  close(): void
}

/** A node in the voice mesh: can place and receive audio calls. */
export interface VoicePeer {
  readonly id: string
  call(peerId: string, stream: MediaStream): VoiceCall
  onIncomingCall(cb: (call: VoiceCall) => void): void
  offIncomingCall(cb: (call: VoiceCall) => void): void
}

export class BrowserMicProvider implements MicProvider {
  private stream: Promise<MediaStream> | null = null

  getStream(): Promise<MediaStream> {
    if (!this.stream) {
      this.stream = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      }).catch((err) => {
        this.stream = null
        throw err
      })
    }
    return this.stream
  }
}

class PeerJsVoiceCall implements VoiceCall {
  constructor(private conn: MediaConnection) {}
  get peerId(): string { return this.conn.peer }
  answer(stream: MediaStream): void { this.conn.answer(stream) }
  onStream(cb: (stream: MediaStream) => void): void {
    this.conn.on('stream', (s) => cb(s as MediaStream))
  }
  onClose(cb: () => void): void { this.conn.on('close', () => cb()) }
  close(): void { this.conn.close() }
}

export class PeerJsVoicePeer implements VoicePeer {
  private callbacks = new Map<(call: VoiceCall) => void, (conn: MediaConnection) => void>()
  constructor(private peer: Peer) {}
  get id(): string { return this.peer.id }
  call(peerId: string, stream: MediaStream): VoiceCall {
    return new PeerJsVoiceCall(this.peer.call(peerId, stream))
  }
  onIncomingCall(cb: (call: VoiceCall) => void): void {
    const wrapper = (conn: MediaConnection) => {
      if (conn.metadata?.type === 'video') return  // video calls handled by PeerJsVideoPeer
      cb(new PeerJsVoiceCall(conn))
    }
    this.callbacks.set(cb, wrapper)
    this.peer.on('call', wrapper)
  }
  offIncomingCall(cb: (call: VoiceCall) => void): void {
    const wrapper = this.callbacks.get(cb)
    if (wrapper) {
      this.peer.removeListener('call', wrapper)
      this.callbacks.delete(cb)
    }
  }
}

/** Acquires the local camera stream (lazily, once). */
export interface CamProvider {
  getStream(): Promise<MediaStream>
}

export class BrowserCamProvider implements CamProvider {
  private stream: Promise<MediaStream> | null = null

  getStream(): Promise<MediaStream> {
    if (this.stream) {
      return this.stream.then(s => {
        const tracks = s.getVideoTracks()
        if (tracks.length > 0 && tracks.every(t => t.readyState === 'ended')) {
          // Synchronously replace this.stream so concurrent callers share the new acquisition
          this.stream = navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch((err) => {
            this.stream = null
            throw err
          })
          return this.stream
        }
        return s
      })
    }
    this.stream = navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch((err) => {
      this.stream = null
      throw err
    })
    return this.stream
  }
}

/** Like PeerJsVoicePeer but tags outgoing calls as video and only handles incoming video calls. */
export class PeerJsVideoPeer implements VoicePeer {
  private callbacks = new Map<(call: VoiceCall) => void, (conn: MediaConnection) => void>()
  constructor(private peer: Peer) {}
  get id(): string { return this.peer.id }
  call(peerId: string, stream: MediaStream): VoiceCall {
    return new PeerJsVoiceCall(this.peer.call(peerId, stream, { metadata: { type: 'video' } }))
  }
  onIncomingCall(cb: (call: VoiceCall) => void): void {
    const wrapper = (conn: MediaConnection) => {
      if (conn.metadata?.type !== 'video') return  // ignore voice calls
      cb(new PeerJsVoiceCall(conn))
    }
    this.callbacks.set(cb, wrapper)
    this.peer.on('call', wrapper)
  }
  offIncomingCall(cb: (call: VoiceCall) => void): void {
    const wrapper = this.callbacks.get(cb)
    if (wrapper) {
      this.peer.removeListener('call', wrapper)
      this.callbacks.delete(cb)
    }
  }
}
