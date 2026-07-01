import * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

export interface BuildingSpec {
  footprint: [number, number][]   // ring of absolute local [x, z] meters; may be open or closed
  height: number                   // absolute top Y (meters)
  minHeight?: number               // ground Y (default 0)
  roofShape?: string               // 'flat' | 'gabled' | 'hipped' | 'pyramidal' | other→flat
  roofHeight?: number              // peak rise above height's eave; capped to 50% of wall height
  buildingType?: 'house' | 'other' // wall-material hint only; does not affect geometry generation
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Shoelace signed area in the XZ plane. Positive = CCW (X right, Z "up"). */
function signedArea2D(pts: [number, number][]): number {
  let area = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % n]
    area += x1 * z2 - x2 * z1
  }
  return area / 2
}

// ─── roof builders ──────────────────────────────────────────────────────────

type AddTriFn = (
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
) => void

/**
 * Earcut-triangulate a flat polygon in the XZ plane at y = eaveY.
 * Uses THREE.ShapeUtils.triangulateShape so concave (non-convex) footprints
 * are handled correctly — fan triangulation produces triangles outside the
 * polygon for L/U/T shapes.
 *
 * The contour is already normalised to CCW (positive shoelace) by the caller.
 * triangulateShape returns faces wound CCW in Vector2 (XY) space, which maps
 * to a downward 3D normal when applied naively to the XZ plane.  Swapping the
 * 2nd and 3rd vertices of each face (emitting a, c, b instead of a, b, c)
 * reverses the winding and produces the required upward (0, 1, 0) normal.
 */
function buildFlatRoof(pts: [number, number][], eaveY: number, add: AddTriFn): void {
  const contour = pts.map(([x, z]) => new THREE.Vector2(x, z))
  const faces = THREE.ShapeUtils.triangulateShape(contour, [])
  for (const [a, b, c] of faces) {
    // Emit (a, c, b) — swapping 2nd and 3rd vertices — so the cross-product
    // normal points up (+Y) for a CCW footprint in the XZ plane.
    add(
      pts[a][0], eaveY, pts[a][1],
      pts[c][0], eaveY, pts[c][1],
      pts[b][0], eaveY, pts[b][1],
    )
  }
}

/**
 * Gabled roof: ridge runs along the longest bounding-box axis through the
 * centroid. Each footprint edge becomes either a slope quad (2 triangles) or a
 * gable-end triangle.  Winding chosen so normals are always outward-upward for
 * a CCW footprint.
 *
 * No degenerate triangles: slope quads require distinct P1/P2 (pDist > ε);
 * gable triangles always have V1≠P (differ in Y) and V2≠P (differ in Y) and
 * V1≠V2 (different footprint vertices).
 */
function buildGabledRoof(
  pts: [number, number][],
  eaveY: number,
  peakRise: number,
  add: AddTriFn,
): void {
  const n = pts.length
  let cx = 0, cz = 0
  for (const [x, z] of pts) { cx += x; cz += z }
  cx /= n; cz /= n

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
  }
  const extX = maxX - minX
  const extZ = maxZ - minZ

  // Principal axis: whichever bounding-box dimension is longer
  const ax = extX >= extZ ? 1 : 0   // axis direction in X
  const az = extX >= extZ ? 0 : 1   // axis direction in Z

  // Scalar projections of each footprint vertex onto the axis (relative to centroid)
  const ts = pts.map(([x, z]) => (x - cx) * ax + (z - cz) * az)
  const tMin = Math.min(...ts)
  const tMax = Math.max(...ts)

  const ridgeY = eaveY + peakRise

  for (let i = 0; i < n; i++) {
    const [V1x, V1z] = pts[i]
    const [V2x, V2z] = pts[(i + 1) % n]

    // Clamp each vertex's projection to the ridge span
    const c1 = Math.max(tMin, Math.min(tMax, ts[i]))
    const c2 = Math.max(tMin, Math.min(tMax, ts[(i + 1) % n]))

    const P1x = cx + c1 * ax, P1z = cz + c1 * az
    const P2x = cx + c2 * ax, P2z = cz + c2 * az

    const pDist = Math.hypot(P2x - P1x, P2z - P1z)

    if (pDist < 1e-6) {
      // Gable end — single triangle: V1, P, V2
      // V1 and V2 at eaveY; P at ridgeY → all positions distinct.
      add(V1x, eaveY, V1z, P1x, ridgeY, P1z, V2x, eaveY, V2z)
    } else {
      // Slope quad — two triangles with CCW outward winding:
      //   T1 = (V1, P2, V2)    T2 = (V1, P1, P2)
      add(V1x, eaveY, V1z, P2x, ridgeY, P2z, V2x, eaveY, V2z)
      add(V1x, eaveY, V1z, P1x, ridgeY, P1z, P2x, ridgeY, P2z)
    }
  }
}

/**
 * Pyramidal roof: every footprint edge slopes to the centroid apex.
 */
function buildPyramidalRoof(
  pts: [number, number][],
  eaveY: number,
  peakRise: number,
  add: AddTriFn,
): void {
  const n = pts.length
  let cx = 0, cz = 0
  for (const [x, z] of pts) { cx += x; cz += z }
  cx /= n; cz /= n
  const apexY = eaveY + peakRise

  for (let i = 0; i < n; i++) {
    const [V1x, V1z] = pts[i]
    const [V2x, V2z] = pts[(i + 1) % n]
    // (V1, apex, V2) — winding gives outward normal for CCW polygon
    add(V1x, eaveY, V1z, cx, apexY, cz, V2x, eaveY, V2z)
  }
}

/**
 * Hipped roof: footprint edges slope inward to a centroid-scaled ridge polygon.
 * Uses a 30 % centroid-shrink so the ridge cap never collapses to a point.
 */
function buildHippedRoof(
  pts: [number, number][],
  eaveY: number,
  peakRise: number,
  add: AddTriFn,
): void {
  const n = pts.length
  let cx = 0, cz = 0
  for (const [x, z] of pts) { cx += x; cz += z }
  cx /= n; cz /= n
  const ridgeY = eaveY + peakRise
  const SHRINK = 0.3

  // Ridge polygon: each vertex moved 30 % toward centroid, elevated to ridgeY
  const rp: [number, number, number][] = pts.map(([x, z]) => [
    cx + (x - cx) * SHRINK, ridgeY, cz + (z - cz) * SHRINK,
  ])

  // Slope quads for each footprint edge
  for (let i = 0; i < n; i++) {
    const [V1x, V1z] = pts[i]
    const [V2x, V2z] = pts[(i + 1) % n]
    const [R1x, R1y, R1z] = rp[i]
    const [R2x, R2y, R2z] = rp[(i + 1) % n]

    add(V1x, eaveY, V1z, R2x, R2y, R2z, V2x, eaveY, V2z)
    add(V1x, eaveY, V1z, R1x, R1y, R1z, R2x, R2y, R2z)
  }

  // Top cap: fan-triangulate the CCW ridge polygon (same winding as flat roof)
  const [R0x, R0y, R0z] = rp[0]
  for (let i = 1; i < n - 1; i++) {
    const [Rix, Riy, Riz] = rp[i]
    const [Ri1x, Ri1y, Ri1z] = rp[i + 1]
    add(R0x, R0y, R0z, Ri1x, Ri1y, Ri1z, Rix, Riy, Riz)
  }
}

// ─── main export ────────────────────────────────────────────────────────────

export class BuildingGeometry {
  static generate(spec: BuildingSpec): THREE.BufferGeometry {

    // 1. Normalise footprint: drop duplicate closing vertex if present
    let pts = [...spec.footprint]
    if (pts.length > 1) {
      const [fx, fz] = pts[0]
      const [lx, lz] = pts[pts.length - 1]
      if (Math.abs(fx - lx) < 1e-9 && Math.abs(fz - lz) < 1e-9) {
        pts = pts.slice(0, -1)
      }
    }

    if (pts.length < 3) {
      throw new Error(
        `BuildingGeometry: footprint must have at least 3 distinct vertices, got ${pts.length}`,
      )
    }
    if (spec.height < PLANETARY_CONFIG.building.minHeight) {
      throw new Error(
        `BuildingGeometry: height ${spec.height} is below minimum ${PLANETARY_CONFIG.building.minHeight}`,
      )
    }

    // 2. Normalise winding to CCW (positive shoelace area) so all roof
    //    builders produce outward-upward normals.
    if (signedArea2D(pts) < 0) {
      pts = pts.slice().reverse()
    }

    const minHeight = spec.minHeight ?? 0
    const wallHeight = spec.height - minHeight
    const eaveY = spec.height

    // roofHeight is capped to 50 % of wall height
    const rawRoofHeight = spec.roofHeight ?? wallHeight * 0.4
    const effectiveRoofHeight = Math.min(rawRoofHeight, wallHeight * 0.5)

    // ── walls ──────────────────────────────────────────────────────────────
    const wallPos: number[] = []
    const wallNrm: number[] = []
    const wallUV: number[] = []

    let cumLen = 0
    const n = pts.length

    for (let i = 0; i < n; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[(i + 1) % n]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.sqrt(dx * dx + dz * dz)
      if (len < 1e-9) continue   // skip degenerate edges

      // Outward wall normal for CCW-wound footprints (dz, 0, -dx)
      const nx = dz / len
      const nz = -dx / len

      const u0 = cumLen / 4
      const u1 = (cumLen + len) / 4
      const v1 = wallHeight / 4
      cumLen += len

      // Triangle 1: BL, BR, TR
      wallPos.push(ax, minHeight, az,  bx, minHeight, bz,  bx, eaveY, bz)
      wallNrm.push(nx, 0, nz,  nx, 0, nz,  nx, 0, nz)
      wallUV.push(u0, 0,  u1, 0,  u1, v1)

      // Triangle 2: BL, TR, TL
      wallPos.push(ax, minHeight, az,  bx, eaveY, bz,  ax, eaveY, az)
      wallNrm.push(nx, 0, nz,  nx, 0, nz,  nx, 0, nz)
      wallUV.push(u0, 0,  u1, v1,  u0, v1)
    }

    // ── roof ───────────────────────────────────────────────────────────────
    const roofPos: number[] = []
    const roofNrm: number[] = []
    const roofUV: number[] = []

    /** Adds one roof triangle; computes normal via cross product; falls back
     *  to (0,1,0) if the cross product is zero-length. */
    const addRoofTri: AddTriFn = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      const e1x = bx - ax, e1y = by - ay, e1z = bz - az
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az
      let rnx = e1y * e2z - e1z * e2y
      let rny = e1z * e2x - e1x * e2z
      let rnz = e1x * e2y - e1y * e2x
      const rlen = Math.sqrt(rnx * rnx + rny * rny + rnz * rnz)
      if (rlen < 1e-9) {
        rnx = 0; rny = 1; rnz = 0
      } else {
        rnx /= rlen; rny /= rlen; rnz /= rlen
      }
      roofPos.push(ax, ay, az,  bx, by, bz,  cx, cy, cz)
      roofNrm.push(rnx, rny, rnz,  rnx, rny, rnz,  rnx, rny, rnz)
      roofUV.push(0, 0,  1, 0,  0.5, 1)
    }

    const roofShape = spec.roofShape ?? 'flat'

    if (roofShape === 'gabled' && effectiveRoofHeight > 0) {
      buildGabledRoof(pts, eaveY, effectiveRoofHeight, addRoofTri)
    } else if (roofShape === 'pyramidal' && effectiveRoofHeight > 0) {
      buildPyramidalRoof(pts, eaveY, effectiveRoofHeight, addRoofTri)
    } else if (roofShape === 'hipped' && effectiveRoofHeight > 0) {
      buildHippedRoof(pts, eaveY, effectiveRoofHeight, addRoofTri)
    } else {
      // flat + unknown shapes + effectiveRoofHeight == 0 fallback
      buildFlatRoof(pts, eaveY, addRoofTri)
    }

    // ── assemble geometry ──────────────────────────────────────────────────
    const allPos = [...wallPos, ...roofPos]
    const allNrm = [...wallNrm, ...roofNrm]
    const allUV  = [...wallUV,  ...roofUV]

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(allPos), 3))
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(new Float32Array(allNrm), 3))
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(new Float32Array(allUV),  2))

    const wallVertCount = wallPos.length / 3
    const roofVertCount = roofPos.length / 3
    geo.addGroup(0, wallVertCount, 0)
    geo.addGroup(wallVertCount, roofVertCount, 1)

    return geo
  }
}
