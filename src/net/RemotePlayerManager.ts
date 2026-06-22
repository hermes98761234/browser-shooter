import * as THREE from 'three'
import { RemotePlayer } from './RemotePlayer'
import type { EntityState } from '../session/protocol'

/** Keeps the scene's RemotePlayer set in sync with a snapshot's player list. */
export class RemotePlayerManager {
  private players = new Map<string, RemotePlayer>()

  constructor(private scene: THREE.Scene, private localId: string) {}

  ids(): string[] { return [...this.players.keys()] }

  get(id: string): RemotePlayer | undefined { return this.players.get(id) }

  sync(playerStates: EntityState[]): void {
    const localTeam = playerStates.find((s) => s.id === this.localId)?.team
    const seen = new Set<string>()
    for (const s of playerStates) {
      if (s.id === this.localId) continue
      seen.add(s.id)
      let rp = this.players.get(s.id)
      if (!rp) {
        rp = new RemotePlayer(s.id, s.name ?? s.id)
        this.players.set(s.id, rp)
        this.scene.add(rp.group)
      }
      rp.pushState(s)
      // Only teammates' nameplates are visible (enemy plates would show through walls).
      rp.setNameVisible(!!localTeam && s.team === localTeam)
    }
    for (const [id, rp] of this.players) {
      if (!seen.has(id)) { this.scene.remove(rp.group); rp.dispose(); this.players.delete(id) }
    }
  }

  update(dt: number): void {
    for (const rp of this.players.values()) rp.update(dt)
  }

  clear(): void {
    for (const rp of this.players.values()) { this.scene.remove(rp.group); rp.dispose() }
    this.players.clear()
  }
}
