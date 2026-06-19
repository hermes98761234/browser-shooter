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
}

export class BrowserMicProvider implements MicProvider {
  private stream: Promise<MediaStream> | null = null

  getStream(): Promise<MediaStream> {
    if (!this.stream) {
      this.stream = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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
  constructor(private peer: Peer) {}
  get id(): string { return this.peer.id }
  call(peerId: string, stream: MediaStream): VoiceCall {
    return new PeerJsVoiceCall(this.peer.call(peerId, stream))
  }
  onIncomingCall(cb: (call: VoiceCall) => void): void {
    this.peer.on('call', (conn: MediaConnection) => cb(new PeerJsVoiceCall(conn)))
  }
}
