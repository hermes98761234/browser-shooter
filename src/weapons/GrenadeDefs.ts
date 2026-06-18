import type { GrenadeType } from '../types'

export interface GrenadeDef {
  name: string
  price: number
  carryLimit: number
  longThrowSpeed: number
  shortThrowSpeed: number
  fuseTimer: number
  effectRadius: number
  gravity: number
  restitution: number
  maxBounces: number
}

export const GRENADE_DEFS: Record<GrenadeType, GrenadeDef> = {
  he: {
    name: 'HE Grenade',
    price: 300,
    carryLimit: 1,
    longThrowSpeed: 25,
    shortThrowSpeed: 12,
    fuseTimer: 2.5,
    effectRadius: 10,
    gravity: 9.8,
    restitution: 0.4,
    maxBounces: 3,
  },
  flash: {
    name: 'Flashbang',
    price: 200,
    carryLimit: 2,
    longThrowSpeed: 25,
    shortThrowSpeed: 12,
    fuseTimer: 1.5,
    effectRadius: 8,
    gravity: 9.8,
    restitution: 0.4,
    maxBounces: 3,
  },
  smoke: {
    name: 'Smoke Grenade',
    price: 300,
    carryLimit: 1,
    longThrowSpeed: 20,
    shortThrowSpeed: 10,
    fuseTimer: 2,
    effectRadius: 6,
    gravity: 9.8,
    restitution: 0.4,
    maxBounces: 3,
  },
}

export function calcHeDamage(distance: number): number {
  if (distance <= 2) return 100
  if (distance <= 5) return 100 - ((distance - 2) / 3) * 50
  if (distance <= 10) return 50 - ((distance - 5) / 5) * 50
  return 0
}

export function calcFlashBlindDuration(distance: number): number {
  if (distance <= 4) return 5
  if (distance <= 8) return 3 - ((distance - 4) / 4) * 1
  return 0
}
