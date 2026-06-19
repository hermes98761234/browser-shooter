export interface Speaker {
  playerId: string
  name: string
}

/** Tracks who is currently talking. Entries are refreshed by talk heartbeats
 *  and pruned if they go stale (guards against a lost stop or a dropped peer). */
export class SpeakerRegistry {
  private map = new Map<string, { name: string; lastSeen: number }>()

  constructor(private ttlMs = 2500) {}

  get size(): number {
    return this.map.size
  }

  start(playerId: string, name: string, now: number): void {
    const existing = this.map.get(playerId)
    if (existing) {
      existing.name = name
      existing.lastSeen = now
    } else {
      this.map.set(playerId, { name, lastSeen: now })
    }
  }

  stop(playerId: string): void {
    this.map.delete(playerId)
  }

  remove(playerId: string): void {
    this.map.delete(playerId)
  }

  prune(now: number): void {
    for (const [id, entry] of this.map) {
      if (now - entry.lastSeen > this.ttlMs) this.map.delete(id)
    }
  }

  list(): Speaker[] {
    return [...this.map.entries()].map(([playerId, e]) => ({ playerId, name: e.name }))
  }
}
