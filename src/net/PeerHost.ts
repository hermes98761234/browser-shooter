import Peer, { type DataConnection } from 'peerjs'
import { PeerConnection } from './PeerConnection'
import type { Transport } from '../session/Transport'

/** Host peer: advertises a room code and emits a Transport per joined client. */
export class PeerHost {
  private _peer: Peer | null = null
  private connectCb: ((t: Transport) => void) | null = null

  /** Resolves with the room code (this peer's id). */
  start(): Promise<string> {
    this._peer = new Peer()
    return new Promise((resolve, reject) => {
      this._peer!.on('open', (id: unknown) => resolve(id as string))
      this._peer!.on('error', (err: unknown) => reject(err))
      this._peer!.on('connection', (conn: unknown) => {
        const dc = conn as DataConnection
        dc.on('open', () => this.connectCb?.(new PeerConnection(dc)))
      })
    })
  }

  onClientConnect(cb: (t: Transport) => void): void { this.connectCb = cb }

  get peer(): Peer | null { return this._peer }

  stop(): void { this._peer?.destroy(); this._peer = null }
}
