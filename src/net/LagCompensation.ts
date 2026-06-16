import * as THREE from 'three'
import type { Enemy } from '../enemies/Enemy'

interface HistoryEntry {
  time: number
  enemies: Map<string, THREE.Vector3>
}

export class LagCompensation {
  private history: HistoryEntry[] = []
  private maxAge = 1000

  record(time: number, enemies: Enemy[]): void {
    const snapshot = new Map<string, THREE.Vector3>()
    for (const e of enemies) {
      if (!e.isDead) snapshot.set(e.id, e.mesh.position.clone())
    }
    this.history.push({ time, enemies: snapshot })
    const cutoff = time - this.maxAge
    while (this.history.length > 0 && this.history[0].time < cutoff) {
      this.history.shift()
    }
  }

  rewind(renderTime: number): Map<string, THREE.Vector3> | null {
    if (this.history.length === 0) return null
    if (renderTime < this.history[0].time - this.maxAge) return null

    let best = this.history[0]
    for (const entry of this.history) {
      if (entry.time <= renderTime && entry.time >= best.time) {
        best = entry
      }
    }
    return best.enemies
  }
}
