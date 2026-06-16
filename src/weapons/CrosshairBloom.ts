/**
 * The "smart" part of the crosshair: a normalized inaccuracy value (≈0..2) that
 * grows when the player is inaccurate and recovers when they settle, mirroring
 * how a Counter-Strike dynamic crosshair reacts to movement, jumping and firing.
 *
 * The value is unit-less; the renderer multiplies it by {@link BLOOM_PIXELS} to
 * get the extra gap in pixels.
 */

export const BLOOM_PIXELS = 14

export interface BloomInputs {
  /** Player is moving fast enough that shots spread. */
  moving: boolean
  /** Player is off the ground (largest accuracy penalty). */
  airborne: boolean
  /** The weapon fired one or more shots this frame. */
  shotsFired: number
  /** Base spread of the active weapon (WeaponDef.spread), used to scale recoil kick. */
  weaponSpread: number
}

const MAX_BLOOM = 2.2
const RECOVERY_RATE = 9 // how quickly bloom eases back toward its target

/** The resting target the bloom eases toward, before per-shot kicks are added. */
function bloomTarget(inputs: BloomInputs): number {
  if (inputs.airborne) return 1.4
  if (inputs.moving) return 0.6
  return 0
}

/** Per-shot recoil kick, larger for high-spread weapons (shotgun) than precise ones (AWP). */
function shotKick(weaponSpread: number): number {
  return 0.18 + Math.min(0.6, weaponSpread * 4)
}

/**
 * Advance the bloom one frame. Pure: returns the next value, given the previous
 * one, the elapsed time and the current inputs.
 */
export function stepBloom(prev: number, dt: number, inputs: BloomInputs): number {
  const target = bloomTarget(inputs)
  // Ease toward the resting target.
  let next = prev + (target - prev) * Math.min(1, dt * RECOVERY_RATE)
  // Add a recoil impulse for every shot fired this frame.
  if (inputs.shotsFired > 0) {
    next += inputs.shotsFired * shotKick(inputs.weaponSpread)
  }
  return Math.max(0, Math.min(MAX_BLOOM, next))
}
