import type { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { NetMessage, SessionEvent, Snapshot, VoiceRosterEntry } from '../session/protocol'
import type { MatchConfig } from '../session/MatchConfig'
import type { Team } from '../types'
import { applyItem } from '../player/applyPurchase'
import { findItem } from '../weapons/StoreCatalog'
import { pickSpawn } from '../session/Spawns'

interface ClientLink { playerId: string; transport: Transport; voicePeerId?: string }

/** Host-authoritative driver: owns the session, ingests client input, broadcasts snapshots. */
export class NetHost {
  private links: ClientLink[] = []
  /** Last measured round-trip latency per client, in ms. */
  private pings = new Map<string, number>()
  /** Last processed input seq per client — stamped onto snapshots as `ack`. */
  private lastSeq = new Map<string, number>()
  /** Monotonically increasing snapshot sequence number. */
  private snapSeq = 0
  private started = false
  private hostVoice: { playerId: string; peerId: string } | null = null
  private hostRosterCb: ((teammates: VoiceRosterEntry[]) => void) | null = null
  private remoteVoiceStartCb: ((playerId: string, name: string) => void) | null = null
  private remoteVoiceStopCb: ((playerId: string) => void) | null = null
  private clientTeamChangedCb: ((playerId: string, name: string, team: Team) => void) | null = null
  private chatCb: ((msg: Extract<NetMessage, { type: 'chat' }>) => void) | null = null

  setHostVoice(playerId: string, peerId: string): void {
    this.hostVoice = { playerId, peerId }
    this.refreshVoiceRoster()
  }
  onHostRoster(cb: (teammates: VoiceRosterEntry[]) => void): void { this.hostRosterCb = cb }
  onClientTeamChanged(cb: (playerId: string, name: string, team: Team) => void): void { this.clientTeamChangedCb = cb }
  onChat(cb: (msg: Extract<NetMessage, { type: 'chat' }>) => void): void { this.chatCb = cb }
  onRemoteVoiceStart(cb: (playerId: string, name: string) => void): void { this.remoteVoiceStartCb = cb }
  onRemoteVoiceStop(cb: (playerId: string) => void): void { this.remoteVoiceStopCb = cb }

  /** All voice participants (host + connected clients) with team + peer id. */
  private voiceParticipants(): { playerId: string; peerId: string; name: string; team: Team }[] {
    const out: { playerId: string; peerId: string; name: string; team: Team }[] = []
    if (this.hostVoice) {
      const p = this.session.getPlayer(this.hostVoice.playerId)
      if (p) out.push({ playerId: this.hostVoice.playerId, peerId: this.hostVoice.peerId, name: p.name, team: p.team })
    }
    for (const link of this.links) {
      const p = this.session.getPlayer(link.playerId)
      if (p && link.voicePeerId) out.push({ playerId: link.playerId, peerId: link.voicePeerId, name: p.name, team: p.team })
    }
    return out
  }

  private voiceTeammatesFor(playerId: string): VoiceRosterEntry[] {
    const all = this.voiceParticipants()
    const me = all.find(p => p.playerId === playerId)
    if (!me) return []
    return all
      .filter(p => p.playerId !== playerId && p.team === me.team)
      .map(p => ({ playerId: p.playerId, peerId: p.peerId, name: p.name }))
  }

  /** Recompute and push the team-scoped roster to every client and the host. */
  refreshVoiceRoster(): void {
    for (const link of this.links) {
      link.transport.send({ type: 'voiceRoster', teammates: this.voiceTeammatesFor(link.playerId) })
    }
    if (this.hostVoice) this.hostRosterCb?.(this.voiceTeammatesFor(this.hostVoice.playerId))
  }

  private relayVoice(msg: Extract<NetMessage, { type: 'voiceStart' | 'voiceStop' }>, speakerId: string): void {
    const all = this.voiceParticipants()
    const speaker = all.find(p => p.playerId === speakerId)
    if (!speaker) return
    for (const p of all) {
      if (p.playerId === speakerId || p.team !== speaker.team) continue
      if (this.hostVoice && p.playerId === this.hostVoice.playerId) {
        if (msg.type === 'voiceStart') this.remoteVoiceStartCb?.(speakerId, msg.name)
        else this.remoteVoiceStopCb?.(speakerId)
      } else {
        this.links.find(l => l.playerId === p.playerId)?.transport.send(msg)
      }
    }
  }

  /** The host itself started/stopped talking — relay to teammate clients. */
  localVoiceStart(): void {
    if (!this.hostVoice) return
    const p = this.session.getPlayer(this.hostVoice.playerId)
    this.relayVoice({ type: 'voiceStart', playerId: this.hostVoice.playerId, name: p?.name ?? '' }, this.hostVoice.playerId)
  }
  localVoiceStop(): void {
    if (!this.hostVoice) return
    this.relayVoice({ type: 'voiceStop', playerId: this.hostVoice.playerId }, this.hostVoice.playerId)
  }

  constructor(private session: GameSession, private config: MatchConfig) {}

  /** True if `pw` may join: open games accept anything; protected games require an exact match. */
  passwordOk(pw?: string): boolean {
    const want = this.config.password
    return !want || want === pw
  }

  addClient(playerId: string, name: string, transport: Transport, team: Team = 'ct', voicePeerId?: string): void {
    const validName = name?.trim() || 'Player'
    const entity = this.session.addPlayer(playerId, validName, team)
    entity.player.position.copy(pickSpawn(team, this.session.map))
    this.lastSeq.set(playerId, 0)
    transport.onMessage((msg) => {
      if (msg.type === 'input' && msg.playerId === playerId) {
        this.session.applyInput(playerId, msg.input)
        this.lastSeq.set(playerId, msg.input.seq)
      } else if (msg.type === 'pong') {
        this.pings.set(playerId, Math.round(performance.now() - msg.t))
      } else if (msg.type === 'buy' && msg.playerId === playerId) {
        const entity = this.session.getPlayer(playerId)
        const item = findItem(msg.item)
        if (entity && item) applyItem(item, entity.player, entity.weapons)
      } else if (msg.type === 'startWave' && msg.playerId === playerId) {
        if (this.config.mode !== 'pvp') this.session.waveManager.spawnNextWave()
      } else if (msg.type === 'setTeam' && msg.playerId === playerId) {
        const entity = this.session.getPlayer(playerId)
        if (entity && (msg.team === 'ct' || msg.team === 't')) {
          entity.team = msg.team; entity.player.position.copy(pickSpawn(msg.team, this.session.map)); this.refreshVoiceRoster()
          this.broadcast({ type: 'teamChanged', playerId, name: entity.name, team: msg.team })
          this.clientTeamChangedCb?.(playerId, entity.name, msg.team)
        }
      } else if (msg.type === 'plantBomb' && msg.playerId === playerId) {
        this.session.tryPlant(playerId)
      } else if (msg.type === 'defuseBomb' && msg.playerId === playerId) {
        this.session.tryDefuse(playerId, msg.hasKit)
      } else if (msg.type === 'throwGrenade' && msg.playerId === playerId) {
        this.session.throwGrenade(playerId, msg.grenadeType, msg.mode)
      } else if (msg.type === 'voiceStart' && msg.playerId === playerId) {
        this.relayVoice(msg, playerId)
      } else if (msg.type === 'voiceStop' && msg.playerId === playerId) {
        this.relayVoice(msg, playerId)
      } else if (msg.type === 'chat' && msg.playerId === playerId) {
        this.routeChat(msg)
      }
    })
    const players = this.session.playerIds()
      .filter(id => id !== playerId)
      .map(id => this.session.getPlayer(id)!)
      .filter(e => !e.isBot)
      .map(e => ({ name: e.name, team: e.team }))
    transport.send({ type: 'welcome', playerId, mode: this.config.mode, config: this.config, players, started: this.started })
    this.links.push({ playerId, transport, voicePeerId })
    this.broadcast({ type: 'playerJoined', playerId, name: validName, team })
    this.refreshVoiceRoster()
    // Free game already running: drop the new client straight into the live match.
    if (this.started && this.config.joinPolicy === 'free') {
      transport.send({ type: 'start' })
    }
  }

  /** Notify clients when the host changes their own team. */
  broadcastTeamChange(playerId: string, name: string, team: Team): void {
    this.broadcast({ type: 'teamChanged', playerId, name, team })
  }

  routeChat(msg: Extract<NetMessage, { type: 'chat' }>): void {
    const senderTeam = this.session.getPlayer(msg.playerId)?.team
    for (const link of this.links) {
      if (link.playerId === msg.playerId) continue  // no echo to sender
      if (msg.scope === 'team' && this.session.getPlayer(link.playerId)?.team !== senderTeam) continue
      if (msg.scope === 'player' && this.session.getPlayer(link.playerId)?.name !== msg.targetName) continue
      link.transport.send(msg)
    }
    // Notify the host player if they are a valid recipient and didn't send the message
    if (msg.playerId !== this.session.localId) {
      const hostPlayer = this.session.getPlayer(this.session.localId)
      const hostReceives =
        msg.scope === 'all' ||
        (msg.scope === 'team' && hostPlayer?.team === senderTeam) ||
        (msg.scope === 'player' && hostPlayer?.name === msg.targetName)
      if (hostReceives) this.chatCb?.(msg)
    }
  }

  /** Tell every client to leave the lobby and begin the match. */
  startMatch(): void {
    this.started = true
    this.broadcast({ type: 'start' })
  }

  removeClient(playerId: string): void {
    this.links = this.links.filter(l => l.playerId !== playerId)
    this.pings.delete(playerId)
    this.lastSeq.delete(playerId)
    this.session.removePlayer(playerId)
    this.broadcast({ type: 'playerLeft', playerId })
    this.refreshVoiceRoster()
  }

  /** Send a latency probe to every client; replies update the ping map. */
  pingClients(): void {
    const t = performance.now()
    for (const link of this.links) link.transport.send({ type: 'ping', t })
  }

  /** Advance the authoritative sim one step and broadcast the resulting snapshot. */
  tick(dt: number): SessionEvent[] {
    const events = this.session.step(dt)
    this.broadcastSnapshot(this.session.getSnapshot(), events)
    return events
  }

  /** Broadcast an already-computed snapshot without stepping the sim (host renders locally). */
  broadcastSnapshot(snapshot: Snapshot, events: SessionEvent[] = []): void {
    for (const p of snapshot.players) p.ping = this.pings.get(p.id) ?? 0
    snapshot.seq = this.snapSeq++
    snapshot.ack = Object.fromEntries(this.lastSeq)
    snapshot.events = events
    this.broadcast({ type: 'snapshot', snapshot })
  }

  private broadcast(msg: NetMessage): void {
    for (const link of this.links) link.transport.send(msg)
  }
}
