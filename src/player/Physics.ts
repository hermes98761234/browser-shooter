import * as THREE from 'three'

export interface CollisionResult {
  collided: boolean
  normal: THREE.Vector3
  penetration: number
}

export class Physics {
  arenaSize: number
  wallThickness: number
  playerRadius: number

  constructor(arenaSize: number = 28, wallThickness: number = 0.5, playerRadius: number = 0.5) {
    this.arenaSize = arenaSize
    this.wallThickness = wallThickness
    this.playerRadius = playerRadius
  }

  /**
   * Check collision with arena walls and return collision result.
   * The arena is a square centered at origin with walls at ±arenaSize.
   */
  checkWallCollision(position: THREE.Vector3): CollisionResult {
    const result: CollisionResult = {
      collided: false,
      normal: new THREE.Vector3(),
      penetration: 0,
    }

    const limit = this.arenaSize - this.playerRadius

    if (position.x > limit) {
      result.collided = true
      result.normal.set(-1, 0, 0)
      result.penetration = position.x - limit
    } else if (position.x < -limit) {
      result.collided = true
      result.normal.set(1, 0, 0)
      result.penetration = -limit - position.x
    }

    if (position.z > limit) {
      result.collided = true
      result.normal.set(0, 0, -1)
      result.penetration = Math.max(result.penetration, position.z - limit)
    } else if (position.z < -limit) {
      result.collided = true
      result.normal.set(0, 0, 1)
      result.penetration = Math.max(result.penetration, -limit - position.z)
    }

    return result
  }

  /**
   * Resolve collision by pushing position out of walls.
   */
  resolveCollision(position: THREE.Vector3): boolean {
    const collision = this.checkWallCollision(position)
    if (collision.collided) {
      position.addScaledVector(collision.normal, collision.penetration)
      return true
    }
    return false
  }

  /**
   * Clamp position to arena bounds (simple AABB).
   */
  clampToArena(position: THREE.Vector3): void {
    const limit = this.arenaSize - this.playerRadius
    position.x = THREE.MathUtils.clamp(position.x, -limit, limit)
    position.z = THREE.MathUtils.clamp(position.z, -limit, limit)
  }

  /**
   * Check if a ray intersects arena walls. Returns distance or -1 if no hit.
   */
  raycastWalls(origin: THREE.Vector3, direction: THREE.Vector3, maxDist: number = 100): number {
    let closestHit = -1
    const limit = this.arenaSize

    // Check each of the 4 walls
    const walls = [
      { axis: 'x' as const, value: limit, normal: -1 },
      { axis: 'x' as const, value: -limit, normal: 1 },
      { axis: 'z' as const, value: limit, normal: -1 },
      { axis: 'z' as const, value: -limit, normal: 1 },
    ]

    for (const wall of walls) {
      const originVal = wall.axis === 'x' ? origin.x : origin.z
      const dirVal = wall.axis === 'x' ? direction.x : direction.z

      if (Math.abs(dirVal) < 0.0001) continue

      const t = (wall.value - originVal) / dirVal
      if (t < 0 || t > maxDist) continue

      // Check the other axis is within bounds
      const otherAxis = wall.axis === 'x' ? 'z' : 'x'
      const hitOther = otherAxis === 'x'
        ? origin.x + direction.x * t
        : origin.z + direction.z * t

      if (Math.abs(hitOther) <= limit) {
        if (closestHit < 0 || t < closestHit) {
          closestHit = t
        }
      }
    }

    return closestHit
  }
}
