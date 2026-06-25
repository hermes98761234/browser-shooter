// src/zones/registry.ts
import type { ZoneDef } from './ZoneDef'
import { ARID } from './arid'
import { HAZE } from './haze'
import { EMBER } from './ember'
import { REACTOR } from './reactor'
import { CROSSING } from './crossing'
import { RANDOM } from './random'
import { generateRandomZone } from './generator'

/** All selectable zones, in menu order. Arid first (the default). */
export const ZONES: ZoneDef[] = [ARID, HAZE, EMBER, REACTOR, CROSSING, RANDOM]

export const DEFAULT_ZONE_ID = ARID.id

/** Look up a zone by id, falling back to the default (Arid) for unknown/undefined ids. */
export function getZone(id?: string): ZoneDef {
  // ponytail: generate fresh each session so 'random' is never the same map twice
  if (id === 'random') return generateRandomZone()
  return ZONES.find((z) => z.id === id) ?? ARID
}
