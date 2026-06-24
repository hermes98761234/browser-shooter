import type { ZoneDef } from './ZoneDef'
import { DAYLIGHT } from './ZoneDef'

/**
 * Ember — industrial heat zone of tight corridors.
 */
export const EMBER: ZoneDef = {
  id: 'ember',
  name: 'Ember',
  description: 'Tight corridors. Hold the flank to B, arches to A.',
  arenaSize: 30,
  floorColor: 0xb08858,
  lighting: {
    ...DAYLIGHT,
    ambientColor: 0xb8a890,
    sunColor: 0xffe8c0,
    sunIntensity: 1.0,
  },
  structures: [
    // Banana — a curved choke faked with staggered walls (north / B)
    { center: [10, 2, 6], size: [1, 4, 12], material: 'wall' },
    { center: [4, 2, 12], size: [10, 4, 1], material: 'wall' },
    { center: [16, 1.5, 14], size: [1, 3, 8], material: 'concrete' },
    // B site car / boxes
    { center: [9, 1, 20], size: [3, 2, 4], material: 'crate' },
    { center: [16, 1, 22], size: [3, 2, 3], material: 'crate' },
    // Mid / apartments wall
    { center: [-2, 2, 0], size: [1, 4, 12], material: 'concrete' },
    { center: [2, 1, -2], size: [3, 2, 3], material: 'crate' },
    // Arches (A approach, south)
    { center: [-10, 2, -6], size: [1, 4, 10], material: 'wall' },
    { center: [-4, 2.5, -12], size: [10, 5, 1], material: 'wall' },
    // A site — pit / boxes / sandbags
    { center: [-12, 1, -20], size: [4, 2, 4], material: 'crate' },
    { center: [-4, 1, -22], size: [3, 2, 3], material: 'crate' },
    { center: [-8, 0.6, -16], size: [6, 1.2, 0.8], material: 'concrete' }, // pit sandbags
    // Graveyard wall
    { center: [14, 2, -8], size: [1, 4, 12], material: 'concrete' },
  ],
  ctSpawns: [[-20, 20], [-24, 16], [-16, 22], [-22, 24]],
  tSpawns: [[20, -20], [24, -16], [16, -22], [20, -24]],
  bombsites: [
    { id: 'A', center: [-9, -20] },
    { id: 'B', center: [12, 21] },
  ],
}
