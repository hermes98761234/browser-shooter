import { DirectoryRoster } from './DirectoryRoster'
import { ENTRY_TTL_MS, type DirMessage } from './directoryProtocol'
import type { Channel } from './Channel'

/** The elected directory. Holds one roster shared across all accepted channels. */
export class DirectoryServer {
  private roster = new DirectoryRoster()
  constructor(private now: () => number = () => Date.now()) {}

  /** Begin serving one connection (a host registering, or a browser listing). */
  accept(channel: Channel<DirMessage>): void {
    channel.onMessage((msg) => {
      const t = this.now()
      switch (msg.type) {
        case 'register': this.roster.upsert(msg.entry, t); break
        case 'heartbeat': this.roster.heartbeat(msg.roomCode, msg.players, msg.status, t, msg.mode); break
        case 'unregister': this.roster.remove(msg.roomCode); break
        case 'listRequest':
          this.roster.expire(ENTRY_TTL_MS, t)
          channel.send({ type: 'listResponse', entries: this.roster.list() })
          break
      }
    })
  }
}
