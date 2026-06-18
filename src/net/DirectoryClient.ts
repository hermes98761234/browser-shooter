import type { Channel } from './Channel'
import type { DirMessage, DirectoryEntry, ServerStatus } from './directoryProtocol'

/**
 * Client side of the directory channel: a host announcing, or a browser listing.
 *
 * Short-lived: a browsing client is created fresh per refresh and discarded after one
 * fetchList; the host's long-lived client only registers/heartbeats. fetchList registers
 * a per-call listener on the channel, so do not reuse one client for repeated polling.
 */
export class DirectoryClient {
  constructor(private channel: Channel<DirMessage>) {}

  register(entry: DirectoryEntry): void {
    this.channel.send({ type: 'register', entry })
  }

  heartbeat(roomCode: string, players: number, status: ServerStatus, mode?: string): void {
    this.channel.send({ type: 'heartbeat', roomCode, players, status, mode })
  }

  unregister(roomCode: string): void {
    this.channel.send({ type: 'unregister', roomCode })
  }

  /** Request the roster; resolves [] if no response arrives within timeoutMs. */
  fetchList(timeoutMs = 3000): Promise<DirectoryEntry[]> {
    return new Promise((resolve) => {
      let settled = false
      const done = (entries: DirectoryEntry[]) => {
        if (settled) return
        settled = true
        resolve(entries)
      }
      const timer = setTimeout(() => done([]), timeoutMs)
      this.channel.onMessage((msg) => {
        if (msg.type === 'listResponse') { clearTimeout(timer); done(msg.entries) }
      })
      this.channel.send({ type: 'listRequest' })
    })
  }

  onClose(cb: () => void): void { this.channel.onClose(cb) }
}
