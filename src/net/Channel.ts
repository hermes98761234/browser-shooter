import type { DataConnection } from 'peerjs'

/** A bidirectional typed message channel. Game code uses Transport; directory code uses this. */
export interface Channel<T> {
  send(msg: T): void
  onMessage(cb: (msg: T) => void): void
  onClose(cb: () => void): void
  close(): void
}

/** Two cross-wired in-process endpoints for tests. close() notifies both ends. */
export function createLinkedChannels<T>(): [Channel<T>, Channel<T>] {
  const aMsg: ((m: T) => void)[] = []; const bMsg: ((m: T) => void)[] = []
  const aClose: (() => void)[] = []; const bClose: (() => void)[] = []
  const fireBoth = () => { aClose.forEach(h => h()); bClose.forEach(h => h()) }
  const a: Channel<T> = {
    send: (m) => bMsg.forEach(h => h(m)),
    onMessage: (cb) => { aMsg.push(cb) },
    onClose: (cb) => { aClose.push(cb) },
    close: fireBoth,
  }
  const b: Channel<T> = {
    send: (m) => aMsg.forEach(h => h(m)),
    onMessage: (cb) => { bMsg.push(cb) },
    onClose: (cb) => { bClose.push(cb) },
    close: fireBoth,
  }
  return [a, b]
}

/** Adapts a peerjs DataConnection to Channel<T>. */
export class PeerChannel<T> implements Channel<T> {
  constructor(private conn: DataConnection) {}
  send(msg: T): void { this.conn.send(msg) }
  onMessage(cb: (msg: T) => void): void { this.conn.on('data', (d) => cb(d as T)) }
  onClose(cb: () => void): void { this.conn.on('close', cb) }
  close(): void { this.conn.close() }
}
