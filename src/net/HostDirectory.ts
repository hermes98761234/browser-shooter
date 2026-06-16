import type Peer from 'peerjs'
import { DirectoryClient } from './DirectoryClient'
import { createLinkedChannels } from './Channel'
import { tryBecomeDirectory, dialDirectory, type ElectResult, type DialResult } from './directoryPeer'
import { HEARTBEAT_MS, type DirMessage, type DirectoryEntry, type ServerStatus } from './directoryProtocol'

type ElectFn = () => Promise<ElectResult>
type DialFn = () => Promise<DialResult | null>

/**
 * Keeps this host listed in the directory: claims the directory if it can,
 * otherwise dials the existing one; registers, heartbeats, re-elects on drop,
 * and unregisters on stop. PeerJS bits are injected for testing.
 */
export class HostDirectory {
  private ownedPeer: Peer | null = null   // directory peer we own (elected)
  private dialPeer: Peer | null = null    // peer used to dial someone else's directory
  private client: DirectoryClient | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private entry: DirectoryEntry | null = null
  private stopped = false

  constructor(private elect: ElectFn = tryBecomeDirectory, private dial: DialFn = dialDirectory) {}

  async start(entry: DirectoryEntry): Promise<void> {
    this.entry = entry
    await this.connect()
    this.client?.register(entry)
    this.timer = setInterval(() => {
      if (this.entry) this.client?.heartbeat(this.entry.roomCode, this.entry.players, this.entry.status)
    }, HEARTBEAT_MS)
  }

  setPlayers(n: number): void { if (this.entry) this.entry.players = n }
  setStatus(s: ServerStatus): void { if (this.entry) this.entry.status = s }

  stop(): void {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.entry) this.client?.unregister(this.entry.roomCode)
    this.ownedPeer?.destroy()
    this.ownedPeer = null
    this.dialPeer?.destroy()
    this.dialPeer = null
    this.client = null
  }

  private async connect(): Promise<void> {
    const election = await this.elect()
    if (election.server) {
      this.ownedPeer = election.peer
      const [srv, cli] = createLinkedChannels<DirMessage>()
      election.server.accept(srv)
      this.client = new DirectoryClient(cli)
    } else {
      const dialed = await this.dial()
      if (dialed) {
        this.dialPeer = dialed.peer
        this.client = dialed.client
        this.client.onClose(() => { if (!this.stopped) void this.reElect() })
      }
    }
  }

  private async reElect(): Promise<void> {
    this.dialPeer?.destroy()
    this.dialPeer = null
    this.client = null
    await this.connect()
    // connect() reassigned this.client, but TS still narrows it to null after the
    // explicit `this.client = null` above; snapshot through the declared type to re-widen.
    const client = this.client as DirectoryClient | null
    if (this.entry && client) client.register(this.entry)
  }
}
