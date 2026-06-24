import type { ZoneDef } from './ZoneDef'
import { DAYLIGHT } from './ZoneDef'

/**
 * Haze — sun-bleached urban district. Mid doors decide the round.
 */
export const HAZE: ZoneDef = {
  id: 'haze',
  name: 'Haze',
  description: 'Mid doors decide the round. Palace to A, apartments to B.',
  arenaSize: 30,
  floorColor: 0xcdb892,
  lighting: {
    ...DAYLIGHT,
    ambientColor: 0xc8c0a8,
    sunColor: 0xfff0d8,
  },
  structures: [
    // Mid doors — two walls forming the central choke
    { center: [-3.5, 1.5, 0], size: [1, 3, 9], material: 'wall' },
    { center: [3.5, 1.5, 0], size: [1, 3, 9], material: 'wall' },
    // Top mid / connector ledge
    { center: [0, 1, -10], size: [5, 2, 1], material: 'crate' },
    // Palace (A approach, south)
    { center: [10, 2, -16], size: [6, 4, 1], material: 'concrete' },
    { center: [12, 1, -22], size: [3, 2, 3], material: 'crate' },
    { center: [-9, 1, -20], size: [4, 2, 4], material: 'crate' }, // A default/triple box
    { center: [-2, 1, -24], size: [3, 2, 3], material: 'crate' },
    // Apartments (B approach, north)
    { center: [9, 2.5, 14], size: [1, 5, 10], material: 'wall' },
    { center: [4, 1, 20], size: [4, 2, 3], material: 'crate' }, // B bench/boxes
    { center: [-6, 1.5, 18], size: [5, 3, 1], material: 'concrete' }, // B short wall
    { center: [-12, 1, 22], size: [3, 2, 3], material: 'crate' },
    // Window / connector wall toward mid
    { center: [-14, 2, 4], size: [1, 4, 10], material: 'concrete' },
  ],
  ctSpawns: [[-20, 22], [-24, 18], [-16, 24], [-22, 14]],
  tSpawns: [[18, -22], [22, -18], [14, -24], [20, -14]],
  bombsites: [
    { id: 'A', center: [4, -24] },
    { id: 'B', center: [-6, 24] },
  ],
}
