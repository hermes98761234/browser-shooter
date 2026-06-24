// src/zones/registry.ts
import type { ZoneDef } from './ZoneDef'
import { ARID } from './arid'
import { HAZE } from './haze'
import { EMBER } from './ember'
import { REACTOR } from './reactor'
import { CROSSING } from './crossing'
import { RANDOM } from './random'

/** All selectable zones, in menu order. Arid first (the default). */
export const ZONES: ZoneDef[] = [ARID, HAZE, EMBER, REACTOR, CROSSING, RANDOM]

export const DEFAULT_ZONE_ID = ARID.id

/** Look up a zone by id, falling back to the default (Arid) for unknown/undefined ids. */
export function getZone(id?: string): ZoneDef {
  return ZONES.find((z) => z.id === id) ?? ARID
}
