import * as THREE from 'three'

export interface BuildingSpec {
  footprint: [number, number][]
  height: number
  minHeight?: number
  roofShape: string
  roofHeight?: number
  roofAngle?: number
}

export class BuildingGeometry {
  static generate(spec: BuildingSpec): THREE.BufferGeometry {
    throw new Error('not implemented')
  }
}
