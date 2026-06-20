import * as THREE from 'three'
import type { PlayerInput } from '../session/protocol'
import { emptyInput } from '../session/protocol'
import type { PlayerEntity } from '../session/GameSession'
import type { CollisionWorld } from '../engine/CollisionWorld'

const STANDOFF = 8          // preferred distance (m) to hold from the target
const REACTION_TIME = 0.35  // seconds of continuous sight before opening fire
const AIM_ERROR = 0.04      // radians of random aim jitter while firing

/** Drives one bot: reads the world, returns the PlayerInput for this tick. */
export class BotController {
  private aimTimer = 0

  constructor(readonly id: string) {}

  computeInput(self: PlayerEntity, others: PlayerEntity[], world: CollisionWorld | null, dt: number): PlayerInput {
    const input = emptyInput()
    if (self.player.isDead) { this.aimTimer = 0; return input }

    const target = this.pickTarget(self, others)
    if (!target) { this.aimTimer = 0; return input }

    const delta = new THREE.Vector3().subVectors(target.player.position, self.player.position)
    const dist = delta.length()
    const dir = dist > 1e-4 ? delta.clone().multiplyScalar(1 / dist) : new THREE.Vector3(0, 0, -1)

    // Face the target (same convention the session uses to derive the forward ray).
    input.yaw = Math.atan2(-dir.x, -dir.z)
    input.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))

    // Close to a standoff distance; back off if too close.
    if (dist > STANDOFF) input.forward = true
    else if (dist < STANDOFF * 0.6) input.backward = true

    const hasLOS = !world || world.segmentBlocked(self.player.position, target.player.position) === null
    const range = self.weapons.current.def.range

    if (hasLOS && dist <= range) {
      this.aimTimer += dt
      if (this.aimTimer >= REACTION_TIME) {
        input.shoot = true
        input.yaw += (Math.random() - 0.5) * AIM_ERROR
        input.pitch += (Math.random() - 0.5) * AIM_ERROR
      }
    } else {
      this.aimTimer = 0
    }
    return input
  }

  /** Nearest living, enemy-team player. */
  private pickTarget(self: PlayerEntity, others: PlayerEntity[]): PlayerEntity | null {
    let best: PlayerEntity | null = null
    let bestDist = Infinity
    for (const o of others) {
      if (o.id === self.id || o.player.isDead || o.team === self.team) continue
      const d = o.player.position.distanceToSquared(self.player.position)
      if (d < bestDist) { bestDist = d; best = o }
    }
    return best
  }
}
