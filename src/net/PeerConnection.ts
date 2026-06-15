import type { DataConnection } from 'peerjs'
import type { Transport } from '../session/Transport'
import type { NetMessage } from '../session/protocol'

/** Adapts a single peerjs DataConnection to the Transport interface. */
export class PeerConnection implements Transport {
  constructor(private conn: DataConnection) {}

  send(msg: NetMessage): void {
    this.conn.send(msg)
  }

  onMessage(cb: (msg: NetMessage) => void): void {
    this.conn.on('data', (data) => cb(data as NetMessage))
  }
}
