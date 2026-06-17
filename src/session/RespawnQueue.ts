export class RespawnQueue {
  private timers = new Map<string, number>()

  enqueue(playerId: string, delay: number): void { this.timers.set(playerId, delay) }
  isPending(playerId: string): boolean { return this.timers.has(playerId) }
  remaining(playerId: string): number { return this.timers.get(playerId) ?? 0 }
  remove(playerId: string): void { this.timers.delete(playerId) }

  /** Decrement timers; return ids whose timer reached zero (and remove them). */
  update(dt: number): string[] {
    const ready: string[] = []
    for (const [id, t] of this.timers) {
      const next = t - dt
      if (next <= 0) { ready.push(id); this.timers.delete(id) }
      else this.timers.set(id, next)
    }
    return ready
  }
}
