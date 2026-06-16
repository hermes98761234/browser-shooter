import Peer, { type DataConnection } from 'peerjs'
import { PeerConnection } from './PeerConnection'
import type { Transport } from '../session/Transport'

/** Client peer: dials a room code and resolves a Transport once the channel opens. */
export class PeerClient {
  private peer: Peer | null = null

  connect(roomCode: string): Promise<Transport> {
    this.peer = new Peer()
    return new Promise((resolve, reject) => {
      this.peer!.on('open', () => {
        const conn = this.peer!.connect(roomCode, { reliable: true })
        conn.on('open', () => resolve(new PeerConnection(conn as DataConnection)))
        conn.on('error', (err: unknown) => reject(err))
      })
      this.peer!.on('error', (err: unknown) => reject(err))
    })
  }

  stop(): void { this.peer?.destroy(); this.peer = null }
}
