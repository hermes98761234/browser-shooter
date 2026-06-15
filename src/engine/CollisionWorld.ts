import * as THREE from 'three'

export interface BoxCollider {
  min: THREE.Vector3
  max: THREE.Vector3
}

export class CollisionWorld {
  boxes: BoxCollider[] = []

  addBox(center: THREE.Vector3, size: THREE.Vector3): void {
    const half = size.clone().multiplyScalar(0.5)
    this.boxes.push({
      min: center.clone().sub(half),
      max: center.clone().add(half),
    })
  }

  /** Push a circle of `radius` (on the XZ plane) out of any overlapping box. Mutates `pos`. */
  resolve(pos: THREE.Vector3, radius: number): void {
    for (const box of this.boxes) {
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

  /** Distance to the nearest box blocking the segment from->to, or null if clear. */
  segmentBlocked(from: THREE.Vector3, to: THREE.Vector3): number | null {
    const dir = to.clone().sub(from)
    const len = dir.length()
    if (len < 1e-8) return null
    dir.divideScalar(len)

    const ray = new THREE.Ray(from.clone(), dir)
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
