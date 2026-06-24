/** Material key for a zone structure; resolved to a THREE material in Arena.ts. */
export type StructureMaterial = 'wall' | 'crate' | 'concrete' | 'metal' | 'wood'

/** A solid box added to both the rendered scene and the collision world. */
export interface ZoneStructure {
  /** Box center [x, y, z]. */
  center: [number, number, number]
  /** Full box size [width, height, depth]. */
  size: [number, number, number]
  material: StructureMaterial
}

/** A bombsite marker / capture zone, positioned on the floor plane. */
export interface ZoneBombsite {
  id: 'A' | 'B'
  /** Center on the floor [x, z]. */
  center: [number, number]
}

export interface ZoneLighting {
  ambientColor: number
  ambientIntensity: number
  sunColor: number
  sunIntensity: number
  sunPosition: [number, number, number]
}

/** A complete, data-driven zone definition: geometry, lighting, spawns, sites. */
export interface ZoneDef {
  id: string
  name: string
  description: string
  /** Half-extent of the (square) arena. */
  arenaSize: number
  floorColor: number
  /** Sky/fog colour for outdoor zones. Omit for indoor zones (uses engine default). */
  skyColor?: number
  /** Fog start distance (default 30). */
  fogNear?: number
  /** Fog end distance (default 100). */
  fogFar?: number
  lighting: ZoneLighting
  structures: ZoneStructure[]
  /** CT spawn points [x, z]. */
  ctSpawns: [number, number][]
  /** T spawn points [x, z]. */
  tSpawns: [number, number][]
  /** Exactly two bombsites: A and B. */
  bombsites: ZoneBombsite[]
}

/** Daylight lighting shared by the desert/outdoor zones; matches the original arena. */
export const DAYLIGHT: ZoneLighting = {
  ambientColor: 0xb0b8c0,
  ambientIntensity: 0.7,
  sunColor: 0xfff4e0,
  sunIntensity: 1.1,
  sunPosition: [20, 30, 10],
}
