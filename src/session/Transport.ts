import type { NetMessage } from './protocol'

export interface Transport {
  send(msg: NetMessage): void
  onMessage(cb: (msg: NetMessage) => void): void
}

/** Single-process transport: delivers messages synchronously to all handlers. */
export class LoopbackTransport implements Transport {
  private handlers: ((msg: NetMessage) => void)[] = []

  send(msg: NetMessage): void {
    for (const h of this.handlers) h(msg)
  }

  onMessage(cb: (msg: NetMessage) => void): void {
    this.handlers.push(cb)
  }
}
