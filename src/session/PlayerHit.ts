import * as THREE from 'three'
import type { Vec3 } from '../types'
import type { HitZone } from '../systems/DamageZones'

export const PLAYER_RADIUS = 0.5
export const PLAYER_HEIGHT = 2.2 // feet (y=0) to head top
const FEET_Y = 0

export interface CapsuleHit { distance: number; point: Vec3; zone: HitZone }

export function zoneForHeight(y: number): HitZone {
  if (y >= 1.6) return 'head'
  if (y <= 0.9) return 'legs'
  return 'body'
}

/**
 * Ray (origin + dir*t, t in [0, range]) vs a vertical capsule at the target's
 * column. `playerEye` is the target's eye position; feet are assumed at y=0.
 */
export function raycastPlayerCapsule(
  origin: THREE.Vector3, dir: THREE.Vector3, range: number, playerEye: THREE.Vector3,
): CapsuleHit | null {
  const a0 = origin.clone()
  const a1 = origin.clone().addScaledVector(dir, range)
  const b0 = new THREE.Vector3(playerEye.x, FEET_Y, playerEye.z)
  const b1 = new THREE.Vector3(playerEye.x, FEET_Y + PLAYER_HEIGHT, playerEye.z)
  const { pA, pB, distSq } = closestPtSegmentSegment(a0, a1, b0, b1)
  if (distSq > PLAYER_RADIUS * PLAYER_RADIUS) return null
  return {
    distance: origin.distanceTo(pA),
    point: { x: pA.x, y: pA.y, z: pA.z },
    zone: zoneForHeight(pB.y),
  }
}

/** Closest points between segments p1->q1 and p2->q2 (Ericson, RTCD §5.1.9). */
function closestPtSegmentSegment(
  p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3,
): { pA: THREE.Vector3; pB: THREE.Vector3; distSq: number } {
  const d1 = q1.clone().sub(p1)
  const d2 = q2.clone().sub(p2)
  const r = p1.clone().sub(p2)
  const a = d1.dot(d1)
  const e = d2.dot(d2)
  const f = d2.dot(r)
  const EPS = 1e-9
  let s = 0, t = 0
  if (a <= EPS && e <= EPS) {
    // both segments are points
  } else if (a <= EPS) {
    t = clamp01(f / e)
  } else {
    const c = d1.dot(r)
    if (e <= EPS) {
      s = clamp01(-c / a)
    } else {
      const b = d1.dot(d2)
      const denom = a * e - b * b
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0
      t = (b * s + f) / e
      if (t < 0) { t = 0; s = clamp01(-c / a) }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a) }
    }
  }
  const pA = p1.clone().addScaledVector(d1, s)
  const pB = p2.clone().addScaledVector(d2, t)
  return { pA, pB, distSq: pA.distanceToSquared(pB) }
}

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v }
