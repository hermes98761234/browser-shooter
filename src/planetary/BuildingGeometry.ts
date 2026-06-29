import * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

export interface BuildingSpec {
  footprint: [number, number][]
  height: number
  minHeight?: number
  roofShape: string
  roofHeight?: number
  roofAngle?: number
}

function addVertex(
  positions: number[],
  normals: number[],
  uvs: number[],
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  u: number, v: number,
): void {
  positions.push(x, y, z)
  normals.push(nx, ny, nz)
  uvs.push(u, v)
}

export class BuildingGeometry {
  static generate(spec: BuildingSpec): THREE.BufferGeometry {
    // 1. Process footprint: strip duplicate-first ring closure
    let ring = spec.footprint
    if (ring.length >= 2) {
      const first = ring[0]
      const last = ring[ring.length - 1]
      if (first[0] === last[0] && first[1] === last[1]) {
        ring = ring.slice(0, -1)
      }
    }

    // 2. Validate: at least 3 vertices
    if (ring.length < 3) {
      throw new Error('Footprint must have at least 3 unique vertices')
    }

    const minHeight = spec.minHeight ?? PLANETARY_CONFIG.building.minHeight
    if (spec.height < minHeight) {
      throw new Error(`Building height must be at least ${minHeight}`)
    }

    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    const groundY = 0
    const topY = spec.height
    const n = ring.length

    // 3. Build wall quads for each edge
    for (let i = 0; i < n; i++) {
      const p1 = ring[i]
      const p2 = ring[(i + 1) % n]
      const dx = p2[0] - p1[0]
      const dz = p2[1] - p1[1]
      const edgeLen = Math.sqrt(dx * dx + dz * dz)

      // Normal perpendicular to edge in XZ plane
      const nx = dz / edgeLen
      const nz = -dx / edgeLen
      const ny = 0

      const uLen = edgeLen / 4
      const vH = topY / 4

      // Triangle 1: bottom-left, bottom-right, top-left
      addVertex(positions, normals, uvs, p1[0], groundY, p1[1], nx, ny, nz, 0, 0)
      addVertex(positions, normals, uvs, p2[0], groundY, p2[1], nx, ny, nz, uLen, 0)
      addVertex(positions, normals, uvs, p1[0], topY, p1[1], nx, ny, nz, 0, vH)

      // Triangle 2: bottom-right, top-right, top-left
      addVertex(positions, normals, uvs, p2[0], groundY, p2[1], nx, ny, nz, uLen, 0)
      addVertex(positions, normals, uvs, p2[0], topY, p2[1], nx, ny, nz, uLen, vH)
      addVertex(positions, normals, uvs, p1[0], topY, p1[1], nx, ny, nz, 0, vH)
    }

    // 4. Roof: fan triangulation from vertex 0 (flat roof for now, and fallback for non-flat)
    const roofNormalNx = 0
    const roofNormalNy = 1
    const roofNormalNz = 0

    for (let i = 1; i < n - 1; i++) {
      const p0 = ring[0]
      const pa = ring[i]
      const pb = ring[i + 1]

      // Simple UVs for roof vertices (planar projection)
      addVertex(positions, normals, uvs, p0[0], topY, p0[1], roofNormalNx, roofNormalNy, roofNormalNz, p0[0] / 4, p0[1] / 4)
      addVertex(positions, normals, uvs, pa[0], topY, pa[1], roofNormalNx, roofNormalNy, roofNormalNz, pa[0] / 4, pa[1] / 4)
      addVertex(positions, normals, uvs, pb[0], topY, pb[1], roofNormalNx, roofNormalNy, roofNormalNz, pb[0] / 4, pb[1] / 4)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    return geo
  }
}
