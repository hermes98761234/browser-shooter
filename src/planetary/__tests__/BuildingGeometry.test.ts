import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { BuildingGeometry } from '../BuildingGeometry'
import type { BuildingSpec } from '../BuildingGeometry'

// Simple square footprint — CCW in XZ plane (shoelace area > 0)
const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]

// Rectangular footprint — longer in X direction (CCW in XZ)
const rect: [number, number][] = [[0, 0], [20, 0], [20, 5], [0, 5]]

describe('BuildingGeometry.generate', () => {
  it('flat roof generates > 0 verts and has 2 groups (materialIndex 0 and 1)', () => {
    const geo = BuildingGeometry.generate({ footprint: square, height: 5 })
    expect(geo.getAttribute('position').count).toBeGreaterThan(0)
    expect(geo.groups).toHaveLength(2)
    expect(geo.groups[0].materialIndex).toBe(0)
    expect(geo.groups[1].materialIndex).toBe(1)
  })

  it('throws when footprint has fewer than 3 distinct vertices', () => {
    const spec: BuildingSpec = { footprint: [[0, 0], [1, 0]], height: 5 }
    expect(() => BuildingGeometry.generate(spec)).toThrow()
  })

  it('throws when footprint has exactly 2 points plus a closing duplicate', () => {
    // 3-point array but with the last point closing the ring → 2 unique vertices after dedup
    const spec: BuildingSpec = { footprint: [[0, 0], [1, 0], [0, 0]], height: 5 }
    expect(() => BuildingGeometry.generate(spec)).toThrow()
  })

  it('throws when height < PLANETARY_CONFIG.building.minHeight (3)', () => {
    const spec: BuildingSpec = { footprint: square, height: 2 }
    expect(() => BuildingGeometry.generate(spec)).toThrow()
  })

  it('roofHeight 8 on height 10 produces valid geometry (cap applied, no throw)', () => {
    const spec: BuildingSpec = {
      footprint: square, height: 10, roofShape: 'gabled', roofHeight: 8,
    }
    expect(() => BuildingGeometry.generate(spec)).not.toThrow()
    const geo = BuildingGeometry.generate(spec)
    expect(geo.getAttribute('position').count).toBeGreaterThan(0)
  })

  it('unknown roofShape "onion" falls back to flat without throwing', () => {
    const spec: BuildingSpec = { footprint: square, height: 5, roofShape: 'onion' }
    expect(() => BuildingGeometry.generate(spec)).not.toThrow()
    const geo = BuildingGeometry.generate(spec)
    expect(geo.groups).toHaveLength(2)
    expect(geo.groups[0].materialIndex).toBe(0)
    expect(geo.groups[1].materialIndex).toBe(1)
  })

  it('gabled roof generates > 20 verts and has no degenerate triangles', () => {
    const spec: BuildingSpec = {
      footprint: rect, height: 8, roofShape: 'gabled', roofHeight: 3,
    }
    const geo = BuildingGeometry.generate(spec)
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    expect(pos.count).toBeGreaterThan(20)

    // Iterate every triangle (3 consecutive vertices) across the entire position buffer
    // and assert that all three vertex positions are mutually distinct.
    const arr = pos.array as Float32Array
    const triCount = pos.count / 3
    for (let t = 0; t < triCount; t++) {
      const b = t * 9
      const v0 = [arr[b + 0], arr[b + 1], arr[b + 2]]
      const v1 = [arr[b + 3], arr[b + 4], arr[b + 5]]
      const v2 = [arr[b + 6], arr[b + 7], arr[b + 8]]
      const d01 = Math.hypot(v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2])
      const d02 = Math.hypot(v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2])
      const d12 = Math.hypot(v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2])
      expect(d01, `tri ${t}: v0 == v1`).toBeGreaterThan(1e-6)
      expect(d02, `tri ${t}: v0 == v2`).toBeGreaterThan(1e-6)
      expect(d12, `tri ${t}: v1 == v2`).toBeGreaterThan(1e-6)
    }
  })

  it('closed footprint (duplicate end point) is handled as open polygon', () => {
    // Same as square but with explicit closing point — should NOT throw
    const closed: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    const geo = BuildingGeometry.generate({ footprint: closed, height: 5 })
    expect(geo.getAttribute('position').count).toBeGreaterThan(0)
  })

  it('gabled roof with roofHeight cap still has 2 material groups', () => {
    const geo = BuildingGeometry.generate({
      footprint: rect, height: 10, roofShape: 'gabled', roofHeight: 8,
    })
    expect(geo.groups).toHaveLength(2)
    expect(geo.groups[0].materialIndex).toBe(0)
    expect(geo.groups[1].materialIndex).toBe(1)
  })

  it('pyramidal roof produces > 0 verts and 2 groups', () => {
    const geo = BuildingGeometry.generate({
      footprint: square, height: 6, roofShape: 'pyramidal', roofHeight: 3,
    })
    expect(geo.getAttribute('position').count).toBeGreaterThan(0)
    expect(geo.groups).toHaveLength(2)
  })

  it('hipped roof produces > 0 verts and 2 groups', () => {
    const geo = BuildingGeometry.generate({
      footprint: square, height: 6, roofShape: 'hipped', roofHeight: 3,
    })
    expect(geo.getAttribute('position').count).toBeGreaterThan(0)
    expect(geo.groups).toHaveLength(2)
  })

  it('flat roof on concave L-shape: all triangle centroids inside polygon and normals up', () => {
    // L-shaped (concave) footprint — fan triangulation would emit triangles
    // whose centroids fall outside the polygon; earcut keeps them all inside.
    const lShape: [number, number][] = [
      [0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10],
    ]

    const geo = BuildingGeometry.generate({ footprint: lShape, height: 8, roofShape: 'flat' })
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const nrm = geo.getAttribute('normal') as THREE.BufferAttribute
    const posArr = pos.array as Float32Array
    const nrmArr = nrm.array as Float32Array

    // groups[1] is the roof group; its .start equals wallVertCount
    const wallVertCount = geo.groups[1].start
    const roofVertCount = geo.groups[1].count
    expect(roofVertCount).toBeGreaterThan(0)

    // Ray-casting point-in-polygon for the XZ plane
    function pointInPolygon(x: number, z: number, poly: [number, number][]): boolean {
      let inside = false
      const n = poly.length
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, zi] = poly[i]
        const [xj, zj] = poly[j]
        if ((zi > z) !== (zj > z) &&
            x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
          inside = !inside
        }
      }
      return inside
    }

    const triCount = roofVertCount / 3
    for (let t = 0; t < triCount; t++) {
      const vBase = wallVertCount + t * 3  // vertex index of triangle's first vertex
      const pBase = vBase * 3              // float offset into posArr

      // Triangle vertex positions (x, z only — y is constant eaveY)
      const ax = posArr[pBase + 0], az = posArr[pBase + 2]
      const bx = posArr[pBase + 3], bz = posArr[pBase + 5]
      const cx = posArr[pBase + 6], cz = posArr[pBase + 8]

      // Centroid must lie inside the L-polygon
      const centX = (ax + bx + cx) / 3
      const centZ = (az + bz + cz) / 3
      expect(
        pointInPolygon(centX, centZ, lShape),
        `Roof triangle ${t} centroid (${centX.toFixed(3)}, ${centZ.toFixed(3)}) is outside the L-polygon`,
      ).toBe(true)

      // Normal stored per vertex — all 3 share the same normal; check the first
      const nBase = vBase * 3
      expect(nrmArr[nBase + 1]).toBeCloseTo(1, 5)  // ny ≈ 1 → normal points up
    }
  })
})
