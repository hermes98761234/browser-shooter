import type { ZoneDef } from './ZoneDef'
import { DAYLIGHT } from './ZoneDef'

/**
 * Crossing — urban bridge sector with strong verticality.
 */
export const CROSSING: ZoneDef = {
  id: 'crossing',
  name: 'Crossing',
  description: 'Verticality and water. Long canal to B, elevated A.',
  arenaSize: 30,
  floorColor: 0x7d8a72,
  lighting: {
    ...DAYLIGHT,
    ambientColor: 0xa8b0b0,
    sunColor: 0xf0f4e8,
  },
  structures: [
    // The overpass — a long elevated wall splitting the map
    { center: [0, 3, -2], size: [22, 1, 2], material: 'concrete' },
    { center: [-11, 1.5, -2], size: [1, 3, 2], material: 'concrete' }, // support
    { center: [11, 1.5, -2], size: [1, 3, 2], material: 'concrete' }, // support
    // Canal (B approach, north) — long walls forming the waterway
    { center: [-8, 2, 14], size: [1, 4, 18], material: 'wall' },
    { center: [8, 2, 14], size: [1, 4, 18], material: 'wall' },
    { center: [0, 1, 22], size: [4, 2, 3], material: 'crate' }, // B barrels/boxes
    { center: [4, 1.5, 16], size: [3, 3, 3], material: 'concrete' },
    // A site (south) — elevated plateau and cover
    { center: [-4, 0.5, -20], size: [12, 1, 10], material: 'concrete' }, // raised A floor
    { center: [-8, 1.5, -22], size: [3, 2, 3], material: 'crate' }, // bathrooms boxes
    { center: [2, 1.5, -18], size: [3, 2, 3], material: 'crate' },
    { center: [8, 2, -14], size: [1, 4, 10], material: 'wall' }, // party wall
    // Playground / connector
    { center: [-14, 2, 6], size: [1, 4, 10], material: 'concrete' },
    { center: [14, 1, 4], size: [3, 2, 3], material: 'crate' },
  ],
  ctSpawns: [[-20, 22], [-24, 18], [-16, 24], [-22, 14]],
  tSpawns: [[20, -22], [24, -18], [16, -24], [20, -14]],
  bombsites: [
    { id: 'A', center: [-4, -22] },
    { id: 'B', center: [0, 23] },
  ],
}
