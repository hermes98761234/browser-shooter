import type { NetMessage } from './protocol'

export interface Transport {
  send(msg: NetMessage): void
  onMessage(cb: (msg: NetMessage) => void): void
  onClose(cb: () => void): void
  /** Optional: the remote endpoint's PeerJS id (set by PeerConnection only). */
  remotePeerId?: string
  /** Optional: invoked locally to simulate/trigger a close (test + loopback use). */
  close?(): void
}

/** Single-process transport: delivers messages synchronously to all handlers. */
export class LoopbackTransport implements Transport {
  private handlers: ((msg: NetMessage) => void)[] = []
  private closeHandlers: (() => void)[] = []

  send(msg: NetMessage): void {
    for (const h of this.handlers) h(msg)
  }

  onMessage(cb: (msg: NetMessage) => void): void {
    this.handlers.push(cb)
  }

  onClose(cb: () => void): void {
    this.closeHandlers.push(cb)
  }

  close(): void {
    for (const h of this.closeHandlers) h()
  }
}

/** Two cross-wired endpoints: each one's send() reaches only the other's handlers. */
export function createLinkedTransports(): [Transport, Transport] {
  const aHandlers: ((msg: NetMessage) => void)[] = []
  const bHandlers: ((msg: NetMessage) => void)[] = []
  const aClose: (() => void)[] = []
  const bClose: (() => void)[] = []
  const fireClose = () => { aClose.forEach(h => h()); bClose.forEach(h => h()) }
  const a: Transport = {
    send: (msg) => bHandlers.forEach(h => h(msg)),
    onMessage: (cb) => { aHandlers.push(cb) },
    onClose: (cb) => { aClose.push(cb) },
    close: fireClose,
  }
  const b: Transport = {
    send: (msg) => aHandlers.forEach(h => h(msg)),
    onMessage: (cb) => { bHandlers.push(cb) },
    onClose: (cb) => { bClose.push(cb) },
    close: fireClose,
  }
  return [a, b]
}
