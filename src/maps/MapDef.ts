/** Material key for a map structure; resolved to a THREE material in Arena.ts. */
export type StructureMaterial = 'wall' | 'crate' | 'concrete' | 'metal' | 'wood'

/** A solid box added to both the rendered scene and the collision world. */
export interface MapStructure {
  /** Box center [x, y, z]. */
  center: [number, number, number]
  /** Full box size [width, height, depth]. */
  size: [number, number, number]
  material: StructureMaterial
}

/** A bombsite marker / capture zone, positioned on the floor plane. */
export interface MapBombsite {
  id: 'A' | 'B'
  /** Center on the floor [x, z]. */
  center: [number, number]
}

export interface MapLighting {
  ambientColor: number
  ambientIntensity: number
  sunColor: number
  sunIntensity: number
  sunPosition: [number, number, number]
}

/** A complete, data-driven map definition: geometry, lighting, spawns, sites. */
export interface MapDef {
  id: string
  name: string
  description: string
  /** Half-extent of the (square) arena. All current maps use 30 (60x60 world). */
  arenaSize: number
  floorColor: number
  lighting: MapLighting
  structures: MapStructure[]
  /** CT spawn points [x, z]. */
  ctSpawns: [number, number][]
  /** T spawn points [x, z]. */
  tSpawns: [number, number][]
  /** Exactly two bombsites: A and B. */
  bombsites: MapBombsite[]
}

/** Daylight lighting shared by the desert/outdoor maps; matches the original arena. */
export const DAYLIGHT: MapLighting = {
  ambientColor: 0xb0b8c0,
  ambientIntensity: 0.7,
  sunColor: 0xfff4e0,
  sunIntensity: 1.1,
  sunPosition: [20, 30, 10],
}
