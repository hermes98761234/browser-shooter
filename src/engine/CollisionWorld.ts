import * as THREE from 'three'

export interface BoxCollider {
  min: THREE.Vector3
  max: THREE.Vector3
}

/** How far the player can step up onto a ledge without jumping. */
export const STEP_TOLERANCE = 0.35

/** Vertical extent of the player's body (feet to just above the head), for height-aware collision. */
export const PLAYER_HEIGHT = 2.2

export class CollisionWorld {
  readonly boxes: BoxCollider[] = []

  addBox(center: THREE.Vector3, size: THREE.Vector3): void {
    const half = size.clone().multiplyScalar(0.5)
    this.boxes.push({
      min: center.clone().sub(half),
      max: center.clone().add(half),
    })
  }

  /**
   * Push a circle of `radius` (on the XZ plane) out of any overlapping box. Mutates `pos`.
   *
   * When `feetY` is supplied the resolve is height-aware: a box no longer blocks the
   * player horizontally if the player is standing on top of it (feet at or above the
   * box top, within {@link STEP_TOLERANCE}) or if the box is entirely above the player's
   * head. This lets the player walk across surfaces they have jumped onto. Omitting
   * `feetY` keeps the original always-block behaviour (used by enemies and tests).
   */
  resolve(pos: THREE.Vector3, radius: number, feetY?: number): void {
    // Single pass per box: adjacent boxes may not fully separate in one call; acceptable for a static map.
    for (const box of this.boxes) {
      if (feetY !== undefined) {
        // Standing on top of (or above) this box — no horizontal blocking.
        if (feetY >= box.max.y - STEP_TOLERANCE) continue
        // Box floats entirely above the player's head — it cannot block the feet/body.
        if (box.min.y >= feetY + PLAYER_HEIGHT) continue
      }
      const closestX = THREE.MathUtils.clamp(pos.x, box.min.x, box.max.x)
      const closestZ = THREE.MathUtils.clamp(pos.z, box.min.z, box.max.z)
      const dx = pos.x - closestX
      const dz = pos.z - closestZ
      const distSq = dx * dx + dz * dz

      if (distSq < radius * radius) {
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq)
          const push = radius - dist
          pos.x += (dx / dist) * push
          pos.z += (dz / dist) * push
        } else {
          // center is inside the box: push out along the least-penetration axis
          const toLeft = pos.x - box.min.x
          const toRight = box.max.x - pos.x
          const toBack = pos.z - box.min.z
          const toFront = box.max.z - pos.z
          const minPen = Math.min(toLeft, toRight, toBack, toFront)
          if (minPen === toLeft) pos.x = box.min.x - radius
          else if (minPen === toRight) pos.x = box.max.x + radius
          else if (minPen === toBack) pos.z = box.min.z - radius
          else pos.z = box.max.z + radius
        }
      }
    }
  }

  /**
   * Height of the surface the player is standing on at `pos`, given their feet are at
   * `feetY`. Returns the highest box top whose XZ footprint is within `radius` of the
   * player and that sits at or below `feetY + STEP_TOLERANCE` (i.e. reachable from above
   * without clipping through a taller wall). Returns `0` (the floor) when nothing supports
   * the player.
   */
  supportHeight(pos: THREE.Vector3, radius: number, feetY: number): number {
    let support = 0
    const reach = feetY + STEP_TOLERANCE
    for (const box of this.boxes) {
      if (box.max.y > reach) continue // top is above what the player can land on / step onto
      const closestX = THREE.MathUtils.clamp(pos.x, box.min.x, box.max.x)
      const closestZ = THREE.MathUtils.clamp(pos.z, box.min.z, box.max.z)
      const dx = pos.x - closestX
      const dz = pos.z - closestZ
      if (dx * dx + dz * dz < radius * radius && box.max.y > support) {
        support = box.max.y
      }
    }
    return support
  }

  /** Distance to the nearest box blocking the segment from->to, or null if clear. */
  segmentBlocked(from: THREE.Vector3, to: THREE.Vector3): number | null {
    const dir = to.clone().sub(from)
    const len = dir.length()
    if (len < 1e-8) return null
    dir.divideScalar(len)

    const ray = new THREE.Ray(from, dir)
    const box3 = new THREE.Box3()
    const target = new THREE.Vector3()
    let nearest: number | null = null

    for (const box of this.boxes) {
      box3.set(box.min, box.max)
      const hit = ray.intersectBox(box3, target)
      if (hit) {
        const d = from.distanceTo(target)
        if (d <= len && (nearest === null || d < nearest)) {
          nearest = d
        }
      }
    }
    return nearest
  }
}
