import type { ZoneDef } from './ZoneDef'

/**
 * Reactor — compact nuclear facility. Raised A platform, B behind the silo.
 */
export const REACTOR: ZoneDef = {
  id: 'reactor',
  name: 'Reactor',
  description: 'Compact facility. Raised A platform, B behind the silo.',
  arenaSize: 30,
  floorColor: 0x8a8d90,
  lighting: {
    ambientColor: 0x9aa0aa,
    ambientIntensity: 0.85,
    sunColor: 0xe8eef5,
    sunIntensity: 0.8,
    sunPosition: [10, 30, -10],
  },
  structures: [
    // Central silo
    { center: [0, 3, 0], size: [7, 6, 7], material: 'concrete' },
    // Catwalk / outside walls
    { center: [-16, 2.5, 0], size: [1, 5, 20], material: 'wall' },
    { center: [16, 2.5, 0], size: [1, 5, 20], material: 'wall' },
    // A site raised platform (south) — a low broad block you can stand on
    { center: [-6, 0.5, -20], size: [14, 1, 12], material: 'concrete' },
    { center: [-10, 1.5, -22], size: [3, 2, 3], material: 'crate' }, // hut/boxes on A
    { center: [2, 1.5, -18], size: [3, 2, 3], material: 'crate' },
    // Ramp wall toward A
    { center: [8, 2, -12], size: [1, 4, 10], material: 'concrete' },
    // B site (north) — low cover and a container
    { center: [6, 1.25, 20], size: [5, 2.5, 4], material: 'crate' }, // container
    { center: [-8, 0.6, 18], size: [8, 1.2, 0.8], material: 'concrete' }, // B sandbags
    { center: [-12, 1.5, 22], size: [3, 3, 3], material: 'concrete' },
    // Hut / connector
    { center: [12, 2, 10], size: [6, 4, 1], material: 'wall' },
  ],
  ctSpawns: [[-22, -22], [-24, -18], [-18, -24], [-22, -14]],
  tSpawns: [[22, 22], [24, 18], [18, 24], [22, 14]],
  bombsites: [
    { id: 'A', center: [-6, -21] },
    { id: 'B', center: [2, 21] },
  ],
}
