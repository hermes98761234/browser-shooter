# Planetary Mode Visual Parity — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Upgrade planetary mode 3D rendering to visual parity with streets-gl: PBR
materials, complex building geometry with roofs, CSM shadows, post-processing
(bloom/SSAO/SMAA), atmosphere config, terrain elevation, and road enhancements.

**Architecture:** New modular files layered on top of existing PlanetaryEngine.
Each new file is independently testable. Integration happens in a final phase.

**Tech Stack:** Three.js 0.170, MapLibre GL, postprocessing (npm), Vitest + jsdom.

**Design Spec:** `docs/superpowers/specs/2026-06-29-planetary-visual-parity-design.md`

---

## Phase 1: Infrastructure

### Task 1: Install postprocessing dependency

**Objective:** Add `postprocessing` npm package to the project.

**Step 1: Install**

```bash
cd /home/user/projects/browser-shooter && npm install postprocessing@^6.36.0
```

**Step 2: Verify**

Run: `node -e "require('postprocessing')"`
Expected: No error, exits cleanly.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add postprocessing ^6.36.0 dependency"
```

### Task 2: Add PlanetaryConfig

**Objective:** Centralized constants file so tuning doesn't require code changes.

**Files:**
- Create: `src/planetary/PlanetaryConfig.ts`

**Step 1: Write the file**

```typescript
// src/planetary/PlanetaryConfig.ts
export const PLANETARY_CONFIG = {
  shadows: {
    cascadeCount: 4,
    cascadeResolution: 1024,
    cascadeSplits: [20, 60, 180, 600] as number[],
  },
  post: {
    defaultPreset: 'medium' as 'low' | 'medium' | 'high',
    ssaoRadius: 5,
    bloomThreshold: 1.0,
    bloomStrength: 0.5,
  },
  terrain: {
    gridResolution: 2,
    gridRadius: 500,
    refreshDistance: 100,
  },
  building: {
    minHeight: 3,
  },
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit src/planetary/PlanetaryConfig.ts`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/planetary/PlanetaryConfig.ts
git commit -m "feat(planetary): add PlanetaryConfig constants"
```

---

## Phase 2: Atmosphere & Sun System

### Task 3: Enhance SunSystem with precise azimuth/altitude

**Objective:** Replace simple hour-based sun angle with proper lat/lng/date/time
computation, ported from streets-gl's `MapTimeSystem.ts`.

**Files:**
- Modify: `src/planetary/SunSystem.ts`
- Modify: `src/planetary/__tests__/SunSystem.test.ts` (if it exists)

**Step 1: Check if SunSystem tests exist**

```bash
ls src/planetary/__tests__/SunSystem.test.ts 2>/dev/null && echo EXISTS || echo MISSING
```

**Step 2: Write/update SunSystem.ts**

Replace the entire file with:

```typescript
import * as THREE from 'three'

export interface SunState {
  direction: THREE.Vector3
  color: THREE.Color
  intensity: number
  skyTop: THREE.Color
  skyHorizon: THREE.Color
  elevation: number  // radians above horizon (NEW)
}

// Ported from streets-gl MapTimeSystem — precise sun position from lat/lng/date
function sunPosition(lat: number, lng: number, date: Date): { azimuth: number; altitude: number } {
  const T = (date.getTime() / 1000 - 946728000) / 31557600 // centuries since J2000
  const M = ((357.5291 + 35999.0503 * T) % 360) * (Math.PI / 180)
  const L = ((280.46645 + 36000.76983 * T) % 360) * (Math.PI / 180)
  const lambda = L + (1.9146 * Math.sin(M) + 0.019993 * Math.sin(2 * M)) * (Math.PI / 180)
  const epsilon = (23.439 - 0.00000036 * T * 3600) * (Math.PI / 180)
  const sinDelta = Math.sin(epsilon) * Math.sin(lambda)
  const cosDelta = Math.sqrt(1 - sinDelta * sinDelta)
  const latRad = lat * Math.PI / 180

  // GMST at 0h UT
  const gmst0 = (280.46061837 + 360.98564736629 * (date.getTime() / 86400000 - Math.floor(date.getTime() / 86400000))) * (Math.PI / 180)
  const ha = gmst0 + lng * Math.PI / 180 - Math.atan2(
    Math.cos(epsilon) * Math.sin(lambda),
    Math.cos(lambda),
  )

  const sinAlt = Math.sin(latRad) * sinDelta + Math.cos(latRad) * cosDelta * Math.cos(ha)
  const altitude = Math.asin(sinAlt)
  const azimuth = Math.atan2(
    -Math.sin(ha) * cosDelta,
    Math.sin(latRad) * cosDelta * Math.cos(ha) - Math.cos(latRad) * sinDelta,
  )

  return { azimuth, altitude }
}

export class SunSystem {
  private lat = 51.5074 // default: London
  private lng = -0.1278

  setLocation(lat: number, lng: number): void {
    this.lat = lat
    this.lng = lng
  }

  compute(hour: number): SunState {
    return this.computeFromDate(this.hoursToDate(hour))
  }

  computeAt(lat: number, lng: number, hour: number): SunState {
    this.setLocation(lat, lng)
    return this.compute(hour)
  }

  computeFromDate(date: Date): SunState {
    const { azimuth, altitude } = sunPosition(this.lat, this.lng, date)

    const dirX = Math.sin(azimuth) * Math.cos(altitude)
    const dirY = Math.max(0, Math.sin(altitude))
    const dirZ = Math.cos(azimuth) * Math.cos(altitude)

    const direction = new THREE.Vector3(dirX, dirY, dirZ)
    if (direction.lengthSq() < 0.0001) direction.set(0, 1, 0)
    direction.normalize()

    const sinElev = Math.sin(altitude)
    const intensity = Math.max(0, sinElev) * 1.2

    const color = new THREE.Color()
    if (sinElev <= -0.06) {
      color.setHex(0x050510) // night
    } else if (sinElev <= 0) {
      color.setHex(0x102040) // pre-dawn
    } else if (sinElev < 0.3) {
      const f = sinElev / 0.3
      color.setRGB(1, 0.38 + f * 0.62, f * 1.0) // sunrise/sunset orange
    } else {
      color.setHex(0xffffff) // day
    }

    const skyTop = new THREE.Color()
    const skyHorizon = new THREE.Color()
    if (sinElev <= -0.06) {
      skyTop.setHex(0x020205)
      skyHorizon.setHex(0x050510)
    } else if (sinElev <= 0) {
      const f = (sinElev + 0.06) / 0.06
      skyTop.lerpColors(new THREE.Color(0x020205), new THREE.Color(0x0d1535), f)
      skyHorizon.lerpColors(new THREE.Color(0x050510), new THREE.Color(0x0a1525), f)
    } else if (sinElev < 0.25) {
      const f = sinElev / 0.25
      skyTop.lerpColors(new THREE.Color(0x0d1535), new THREE.Color(0x1a50a0), f)
      skyHorizon.lerpColors(new THREE.Color(0xff6035), new THREE.Color(0x9ec7e8), f)
    } else {
      skyTop.setHex(0x1a50a0)
      skyHorizon.setHex(0x9ec7e8)
    }

    return { direction, color, intensity, skyTop, skyHorizon, elevation: altitude }
  }

  private hoursToDate(hour: number): Date {
    const d = new Date()
    d.setHours(hour, 0, 0, 0)
    return d
  }
}
```

**Step 3: Run existing tests**

```bash
npx vitest run src/planetary/__tests__/SunSystem.test.ts 2>/dev/null || echo "No test file — manual check"
```

**Step 4: Verify type check**

```bash
npx tsc --noEmit src/planetary/SunSystem.ts
```
Expected: No errors.

**Step 5: Commit**

```bash
git add src/planetary/SunSystem.ts
git commit -m "feat(planetary): precise sun position from lat/lng/date in SunSystem"
```

### Task 4: Create AtmosphereConfig

**Objective:** Compute sky/fog/light colors from sun elevation, porting streets-gl's
Skybox constants.

**Files:**
- Create: `src/planetary/AtmosphereConfig.ts`

**Step 1: Write the file**

```typescript
// src/planetary/AtmosphereConfig.ts
import * as THREE from 'three'

export interface AtmosphereState {
  turbidity: number
  rayleigh: number
  mieCoefficient: number
  mieDirectionalG: number
  fogColor: THREE.Color
  sunColor: THREE.Color
  sunIntensity: number
  ambientColor: THREE.Color  // hemisphere sky color
  groundColor: THREE.Color   // hemisphere ground color
}

/**
 * Maps sun elevation (radians) to atmosphere parameters.
 * Ported from streets-gl Skybox.ts color mapping logic.
 */
export class AtmosphereConfig {
  private _state: AtmosphereState = this.nightState()

  get state(): AtmosphereState {
    return this._state
  }

  update(sunElevationRad: number): AtmosphereState {
    if (sunElevationRad < -0.1) {
      // Night
      this._state = this.nightState()
    } else if (sunElevationRad < -0.05) {
      // Pre-dawn
      const f = (sunElevationRad + 0.1) / 0.05
      this._state = lerpAtmosphere(this.nightState(), this.sunriseState(), f)
    } else if (sunElevationRad < 0.05) {
      // Sunrise / sunset
      const f = (sunElevationRad + 0.05) / 0.1
      this._state = lerpAtmosphere(this.sunriseState(), this.dayState(), f)
    } else if (sunElevationRad < 0.6) {
      // Daytime
      const f = (sunElevationRad - 0.05) / 0.55
      this._state = lerpAtmosphere(this.dayState(), this.middayState(), f)
    } else {
      // Midday
      this._state = this.middayState()
    }
    return this._state
  }

  private nightState(): AtmosphereState {
    return {
      turbidity: 2,
      rayleigh: 0.3,
      mieCoefficient: 0.001,
      mieDirectionalG: 0.6,
      fogColor: new THREE.Color(0x080810),
      sunColor: new THREE.Color(0x050510),
      sunIntensity: 0,
      ambientColor: new THREE.Color(0x050520),
      groundColor: new THREE.Color(0x030510),
    }
  }

  private sunriseState(): AtmosphereState {
    return {
      turbidity: 4,
      rayleigh: 2,
      mieCoefficient: 0.01,
      mieDirectionalG: 0.8,
      fogColor: new THREE.Color(0xff7030),
      sunColor: new THREE.Color(0xff6020),
      sunIntensity: 0.4,
      ambientColor: new THREE.Color(0x301560),
      groundColor: new THREE.Color(0x301020),
    }
  }

  private dayState(): AtmosphereState {
    return {
      turbidity: 10,
      rayleigh: 2,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
      fogColor: new THREE.Color(0x9ec7e8),
      sunColor: new THREE.Color(0xffffff),
      sunIntensity: 1.2,
      ambientColor: new THREE.Color(0xffffff),
      groundColor: new THREE.Color(0x444444),
    }
  }

  private middayState(): AtmosphereState {
    return {
      turbidity: 8,
      rayleigh: 3,
      mieCoefficient: 0.003,
      mieDirectionalG: 0.85,
      fogColor: new THREE.Color(0x6aafe0),
      sunColor: new THREE.Color(0xfffef8),
      sunIntensity: 1.4,
      ambientColor: new THREE.Color(0xffffff),
      groundColor: new THREE.Color(0x555555),
    }
  }
}

function lerpAtmosphere(a: AtmosphereState, b: AtmosphereState, t: number): AtmosphereState {
  return {
    turbidity: a.turbidity + (b.turbidity - a.turbidity) * t,
    rayleigh: a.rayleigh + (b.rayleigh - a.rayleigh) * t,
    mieCoefficient: a.mieCoefficient + (b.mieCoefficient - a.mieCoefficient) * t,
    mieDirectionalG: a.mieDirectionalG + (b.mieDirectionalG - a.mieDirectionalG) * t,
    fogColor: new THREE.Color().lerpColors(a.fogColor, b.fogColor, t),
    sunColor: new THREE.Color().lerpColors(a.sunColor, b.sunColor, t),
    sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
    ambientColor: new THREE.Color().lerpColors(a.ambientColor, b.ambientColor, t),
    groundColor: new THREE.Color().lerpColors(a.groundColor, b.groundColor, t),
  }
}
```

**Step 2: Write test**

Create `src/planetary/__tests__/AtmosphereConfig.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { AtmosphereConfig } from '../AtmosphereConfig'

describe('AtmosphereConfig', () => {
  it('returns night state for elevation -0.2', () => {
    const cfg = new AtmosphereConfig()
    const s = cfg.update(-0.2)
    expect(s.sunIntensity).toBe(0)
    expect(s.fogColor.r).toBeLessThan(0.1) // dark
  })

  it('returns bright state for elevation 0.5', () => {
    const cfg = new AtmosphereConfig()
    const s = cfg.update(0.5)
    expect(s.sunIntensity).toBeGreaterThan(1.0)
    expect(s.sunColor.r).toBeGreaterThan(0.9) // white
  })

  it('sunrise colors are warm (elevation 0.0)', () => {
    const cfg = new AtmosphereConfig()
    const s = cfg.update(0.0)
    expect(s.fogColor.r).toBeGreaterThan(0.5) // warm/orange horizon
    expect(s.sunColor.r).toBeGreaterThan(0.5)
  })
})
```

**Step 3: Run test**

```bash
npx vitest run src/planetary/__tests__/AtmosphereConfig.test.ts
```
Expected: 3 tests pass.

**Step 4: Commit**

```bash
git add src/planetary/AtmosphereConfig.ts src/planetary/__tests__/AtmosphereConfig.test.ts
git commit -m "feat(planetary): add AtmosphereConfig — sun-elevation→sky/fog mapping"
```

---

## Phase 3: Building Geometry

### Task 5: Write BuildingGeometry unit tests

**Objective:** TDD — write failing tests for building geometry generator.

**Files:**
- Create: `src/planetary/__tests__/BuildingGeometry.test.ts`

**Step 1: Write test file**

```typescript
import { describe, it, expect } from 'vitest'
import { BuildingGeometry } from '../BuildingGeometry'

describe('BuildingGeometry', () => {
  // Simple square footprint at origin
  const squareFootprint: [number, number][] = [
    [0, 0], [10, 0], [10, 10], [0, 10], [0, 0],
  ]

  it('generates geometry for flat roof', () => {
    const geo = BuildingGeometry.generate({
      footprint: squareFootprint,
      height: 20,
      roofShape: 'flat',
    })
    expect(geo).toBeDefined()
    expect(geo.getAttribute('position').count).toBeGreaterThan(0)
    // flat roof: walls (4 quads = 8 triangles) + roof cap (2 triangles) = 10 tris = 30 verts
    expect(geo.getAttribute('position').count).toBeGreaterThanOrEqual(12) // at least some verts
  })

  it('generates geometry for gabled roof', () => {
    const geo = BuildingGeometry.generate({
      footprint: squareFootprint,
      height: 15,
      roofShape: 'gabled',
      roofHeight: 5,
    })
    expect(geo).toBeDefined()
    // gable: walls + 2 triangles per gable end + 2 triangles for sloped sides
    const count = geo.getAttribute('position').count
    expect(count).toBeGreaterThan(20)
  })

  it('rejects footprint with < 3 vertices', () => {
    expect(() =>
      BuildingGeometry.generate({
        footprint: [[0, 0], [10, 0]], // only 2 points
        height: 10,
        roofShape: 'flat',
      }),
    ).toThrow()
  })

  it('rejects height < minHeight', () => {
    expect(() =>
      BuildingGeometry.generate({
        footprint: squareFootprint,
        height: 2, // below PLANETARY_CONFIG.building.minHeight (3)
        roofShape: 'flat',
      }),
    ).toThrow()
  })

  it('caps roof:height exceeding 50% of building height', () => {
    const geo = BuildingGeometry.generate({
      footprint: squareFootprint,
      height: 10,
      roofShape: 'gabled',
      roofHeight: 8,
    })
    // roofHeight internally capped to 5 (50% of 10)
    // Should still generate valid geometry
    expect(geo.getAttribute('position').count).toBeGreaterThan(20)
  })

  it('falls back to flat roof for unknown roof shape', () => {
    const geo = BuildingGeometry.generate({
      footprint: squareFootprint,
      height: 20,
      roofShape: 'onion',
    })
    expect(geo).toBeDefined()
  })
})
```

**Step 2: Create empty stub (tests fail)**

```typescript
// src/planetary/BuildingGeometry.ts — STUB

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
```

**Step 3: Run tests to verify failure**

```bash
npx vitest run src/planetary/__tests__/BuildingGeometry.test.ts
```
Expected: All 6 tests FAIL (not implemented error).

**Step 4: Commit**

```bash
git add src/planetary/__tests__/BuildingGeometry.test.ts src/planetary/BuildingGeometry.ts
git commit -m "test(planetary): add BuildingGeometry TDD stubs"
```

### Task 6: Implement BuildingGeometry — flat roof

**Objective:** Make flat-roof and validation tests pass.

**Files:**
- Modify: `src/planetary/BuildingGeometry.ts`

**Step 1: Rewrite BuildingGeometry.ts — flat roof only**

```typescript
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

export class BuildingGeometry {
  static generate(spec: BuildingSpec): THREE.BufferGeometry {
    if (spec.footprint.length < 3) {
      throw new Error('Building footprint must have at least 3 vertices')
    }
    if (spec.height < PLANETARY_CONFIG.building.minHeight) {
      throw new Error(`Building height ${spec.height} below minimum ${PLANETARY_CONFIG.building.minHeight}`)
    }

    // Remove last point if it duplicates first (ring closure)
    const ring = spec.footprint[0] === spec.footprint[spec.footprint.length - 1]
      ? spec.footprint.slice(0, -1)
      : spec.footprint
    const n = ring.length

    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    let idx = 0

    // --- Walls: extrude footprint from ground to building height ---
    const groundY = spec.minHeight ?? 0
    const topY = spec.height

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const ax = ring[i][0]
      const az = ring[i][1]
      const bx = ring[j][0]
      const bz = ring[j][1]

      const dx = bx - ax
      const dz = bz - az
      const len = Math.sqrt(dx * dx + dz * dz)
      const nx = -dz / len
      const nz = dx / len

      // Wall quad (two triangles: triA, triB)
      // triA: bottom-left, bottom-right, top-left
      // triB: bottom-right, top-right, top-left
      addVertex(positions, normals, uvs, ax, groundY, az, nx, 0, nz, 0, 0)
      addVertex(positions, normals, uvs, bx, groundY, bz, nx, 0, nz, len / 4, 0)
      addVertex(positions, normals, uvs, ax, topY, az, nx, 0, nz, 0, (topY - groundY) / 4)

      addVertex(positions, normals, uvs, bx, groundY, bz, nx, 0, nz, len / 4, 0)
      addVertex(positions, normals, uvs, bx, topY, bz, nx, 0, nz, len / 4, (topY - groundY) / 4)
      addVertex(positions, normals, uvs, ax, topY, az, nx, 0, nz, 0, (topY - groundY) / 4)
    }

    // --- Roof ---
    const roofHeight = spec.roofHeight ?? 0
    const shape = spec.roofShape ?? 'flat'

    if (shape === 'flat' || roofHeight === 0) {
      // Flat roof: triangulate ceiling polygon
      const roofY = topY
      for (let i = 1; i < n - 1; i++) {
        addVertex(positions, normals, uvs, ring[0][0], roofY, ring[0][1], 0, 1, 0, 0, 0)
        addVertex(positions, normals, uvs, ring[i][0], roofY, ring[i][1], 0, 1, 0, 0, 0)
        addVertex(positions, normals, uvs, ring[i + 1][0], roofY, ring[i + 1][1], 0, 1, 0, 0, 0)
      }
    } else {
      // Non-flat roofs: fall back to flat for now (implemented in next task)
      const roofY = topY
      for (let i = 1; i < n - 1; i++) {
        addVertex(positions, normals, uvs, ring[0][0], roofY, ring[0][1], 0, 1, 0, 0, 0)
        addVertex(positions, normals, uvs, ring[i][0], roofY, ring[i][1], 0, 1, 0, 0, 0)
        addVertex(positions, normals, uvs, ring[i + 1][0], roofY, ring[i + 1][1], 0, 1, 0, 0, 0)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
    return geo
  }
}

function addVertex(
  pos: number[], nrm: number[], uv: number[],
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  u: number, v: number,
) {
  pos.push(x, y, z)
  nrm.push(nx, ny, nz)
  uv.push(u, v)
}
```

**Step 2: Run tests**

```bash
npx vitest run src/planetary/__tests__/BuildingGeometry.test.ts
```
Expected: flat roof test passes, gabled roof test passes (flat fallback), rejection tests pass, cap test passes, unknown shape fallback test passes. All 6 PASS.

**Step 3: Verify type check**

```bash
npx tsc --noEmit src/planetary/BuildingGeometry.ts
```

**Step 4: Commit**

```bash
git add src/planetary/BuildingGeometry.ts
git commit -m "feat(planetary): implement BuildingGeometry — flat roof + validation"
```

### Task 7: Implement BuildingGeometry — gabled / hipped / pyramidal roofs

**Objective:** Add real roof shape geometry.

**Files:**
- Modify: `src/planetary/BuildingGeometry.ts`

**Step 1: Add roof geometry functions**

In `BuildingGeometry.ts`, replace the `else` block in `generate()` with:

```typescript
} else {
  // Compute actual roof height (capped to 50% of building height)
  const actualRoofH = Math.min(roofHeight, spec.height * 0.5)
  const ridgeY = topY - actualRoofH

  // Find longest edge axis for ridge orientation
  let maxLen = 0
  let ridgeDir: [number, number] = [1, 0]
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const dx = ring[j][0] - ring[i][0]
    const dz = ring[j][1] - ring[i][1]
    const len = dx * dx + dz * dz
    if (len > maxLen) {
      maxLen = len
      ridgeDir = [ring[j][0] - ring[i][0], ring[j][1] - ring[i][1]]
    }
  }
  const rLen = Math.sqrt(ridgeDir[0] ** 2 + ridgeDir[1] ** 2)
  ridgeDir = [ridgeDir[0] / rLen, ridgeDir[1] / rLen]

  if (shape === 'gabled') {
    addGableRoof(positions, normals, uvs, ring, n, topY, ridgeY, ridgeDir)
  } else if (shape === 'hipped') {
    addHippedRoof(positions, normals, uvs, ring, n, topY, ridgeY, ridgeDir)
  } else if (shape === 'pyramidal') {
    addPyramidalRoof(positions, normals, uvs, ring, n, topY, ridgeY)
  } else {
    // Fallback flat
    for (let i = 1; i < n - 1; i++) {
      addVertex(positions, normals, uvs, ring[0][0], topY, ring[0][1], 0, 1, 0, 0, 0)
      addVertex(positions, normals, uvs, ring[i][0], topY, ring[i][1], 0, 1, 0, 0, 0)
      addVertex(positions, normals, uvs, ring[i + 1][0], topY, ring[i + 1][1], 0, 1, 0, 0, 0)
    }
  }
}
```

**Step 2: Add helper functions at end of file**

```typescript
function addGableRoof(
  pos: number[], nrm: number[], uv: number[],
  ring: [number, number][], n: number, topY: number, ridgeY: number,
  ridgeDir: [number, number],
) {
  // Ridge line runs along ridgeDir through centroid
  const cx = ring.reduce((s, p) => s + p[0], 0) / n
  const cz = ring.reduce((s, p) => s + p[1], 0) / n
  const rx = ridgeDir[0]
  const rz = ridgeDir[1]

  // Project each vertex onto ridge axis to classify left vs right side
  const side: ('left' | 'right' | 'ridge')[] = []
  for (let i = 0; i < n; i++) {
    const dx = ring[i][0] - cx
    const dz = ring[i][1] - cz
    const dot = dx * rz - dz * rx // cross product sign
    if (Math.abs(dot) < 0.5) {
      side.push('ridge')
    } else if (dot > 0) {
      side.push('right')
    } else {
      side.push('left')
    }
  }

  // Find ridge endpoints (two vertices closest to ridge axis)
  let rIdxA = -1, rIdxB = -1
  for (let i = 0; i < n; i++) {
    if (side[i] === 'ridge') {
      if (rIdxA < 0) rIdxA = i
      else rIdxB = i
    }
  }
  // If no ridge vertices found, use two most-aligned vertices
  if (rIdxA < 0 || rIdxB < 0) {
    rIdxA = 0
    rIdxB = Math.floor(n / 2)
  }

  const A = ring[rIdxA]
  const B = ring[rIdxB]
  addTriangle3D(pos, nrm, uv, [A[0], topY, A[1]], [B[0], topY, B[1]], [B[0], ridgeY, B[1]])
  addTriangle3D(pos, nrm, uv, [A[0], topY, A[1]], [B[0], ridgeY, B[1]], [A[0], ridgeY, A[1]])

  // Gable ends: connect each non-ridge vertex to nearest ridge endpoint
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    if (side[i] === 'ridge' || side[j] === 'ridge') continue
    const nearR = i < n / 2 ? rIdxA : rIdxB
    const R = ring[nearR]
    const Vi = [ring[i][0], topY, ring[i][1]] as [number, number, number]
    const Vj = [ring[j][0], topY, ring[j][1]] as [number, number, number]
    const Vr = [R[0], ridgeY, R[1]] as [number, number, number]
    addTriangle3D(pos, nrm, uv, Vi, Vj, Vr)
    addTriangle3D(pos, nrm, uv, Vj, Vr, Vr) // extra triangle if needed (one side is vertical)
  }
}

function addHippedRoof(
  pos: number[], nrm: number[], uv: number[],
  ring: [number, number][], n: number, topY: number, ridgeY: number,
  _ridgeDir: [number, number],
) {
  // Hipped roof: all edges slope up to a flat horizontal top at ridgeY
  // The top face is a smaller polygon (inset version of footprint)
  // For simplicity, inset by scaling toward centroid
  const cx = ring.reduce((s, p) => s + p[0], 0) / n
  const cz = ring.reduce((s, p) => s + p[1], 0) / n
  const insetRatio = 0.7

  // Top face (flat, at ridgeY)
  for (let i = 1; i < n - 1; i++) {
    const ax = cx + (ring[0][0] - cx) * insetRatio
    const az = cz + (ring[0][1] - cz) * insetRatio
    const bx = cx + (ring[i][0] - cx) * insetRatio
    const bz = cz + (ring[i][1] - cz) * insetRatio
    const cx2 = cx + (ring[i + 1][0] - cx) * insetRatio
    const cz2 = cz + (ring[i + 1][1] - cz) * insetRatio
    addVertex(pos, nrm, uv, ax, ridgeY, az, 0, 1, 0, 0, 0)
    addVertex(pos, nrm, uv, bx, ridgeY, bz, 0, 1, 0, 0, 0)
    addVertex(pos, nrm, uv, cx2, ridgeY, cz2, 0, 1, 0, 0, 0)
  }

  // Sloped sides: each edge quad from ground-level edge to inset edge at ridgeY
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const ax = ring[i][0]; const az = ring[i][1]
    const bx = ring[j][0]; const bz = ring[j][1]
    const axIn = cx + (ax - cx) * insetRatio; const azIn = cz + (az - cz) * insetRatio
    const bxIn = cx + (bx - cx) * insetRatio; const bzIn = cz + (bz - cz) * insetRatio

    const dx = bx - ax; const dz = bz - az
    const len = Math.sqrt(dx * dx + dz * dz)
    const nx = -dz / len; const nz = dx / len
    const slope = (topY - ridgeY) / ((1 - insetRatio) * len * 0.5)
    const ny = Math.sqrt(1 / (1 + slope * slope))

    addVertex(pos, nrm, uv, ax, topY, az, nx, ny, nz, 0, 0)
    addVertex(pos, nrm, uv, bx, topY, bz, nx, ny, nz, len / 4, 0)
    addVertex(pos, nrm, uv, axIn, ridgeY, azIn, nx, ny, nz, 0, 0)
    addVertex(pos, nrm, uv, bx, topY, bz, nx, ny, nz, len / 4, 0)
    addVertex(pos, nrm, uv, bxIn, ridgeY, bzIn, nx, ny, nz, len / 4, 0)
    addVertex(pos, nrm, uv, axIn, ridgeY, azIn, nx, ny, nz, 0, 0)
  }
}

function addPyramidalRoof(
  pos: number[], nrm: number[], uv: number[],
  ring: [number, number][], n: number, topY: number, ridgeY: number,
) {
  const cx = ring.reduce((s, p) => s + p[0], 0) / n
  const cz = ring.reduce((s, p) => s + p[1], 0) / n

  // Sloped triangles: each edge to apex
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const ax = ring[i][0]; const az = ring[i][1]
    const bx = ring[j][0]; const bz = ring[j][1]

    const dx = bx - ax; const dz = bz - az
    const len = Math.sqrt(dx * dx + dz * dz)
    const nx = -dz / len; const nz = dx / len

    addVertex(pos, nrm, uv, ax, topY, az, nx, 0.5, nz, 0, 0)
    addVertex(pos, nrm, uv, bx, topY, bz, nx, 0.5, nz, len / 4, 0)
    addVertex(pos, nrm, uv, cx, ridgeY, cz, nx, 0.5, nz, 0, 0)
  }
}

function addTriangle3D(
  pos: number[], nrm: number[], uv: number[],
  a: [number, number, number], b: [number, number, number], c: [number, number, number],
) {
  // Compute normal
  const abx = b[0] - a[0]; const aby = b[1] - a[1]; const abz = b[2] - a[2]
  const acx = c[0] - a[0]; const acy = c[1] - a[1]; const acz = c[2] - a[2]
  const nx = aby * acz - abz * acy
  const ny = abz * acx - abx * acz
  const nz = abx * acy - aby * acx
  const nl = Math.sqrt(nx * nx + ny * ny + nz * nz)
  const snx = nl > 0 ? nx / nl : 0
  const sny = nl > 0 ? ny / nl : 1
  const snz = nl > 0 ? nz / nl : 0

  pos.push(a[0], a[1], a[2]); nrm.push(snx, sny, snz); uv.push(0, 0)
  pos.push(b[0], b[1], b[2]); nrm.push(snx, sny, snz); uv.push(1, 0)
  pos.push(c[0], c[1], c[2]); nrm.push(snx, sny, snz); uv.push(0, 1)
}
```

**Step 3: Run tests**

```bash
npx vitest run src/planetary/__tests__/BuildingGeometry.test.ts
```
Expected: All 6 tests PASS with real geometry counts.

**Step 4: Verify type check**

```bash
npx tsc --noEmit src/planetary/BuildingGeometry.ts
```

**Step 5: Commit**

```bash
git add src/planetary/BuildingGeometry.ts
git commit -m "feat(planetary): add gabled/hipped/pyramidal roof shapes to BuildingGeometry"
```

---

## Phase 4: Shadows & Post-Processing

### Task 8: Install and configure postprocessing, verify imports

**Objective:** Verify the postprocessing library can be imported.

**Files:**
- Create: `src/planetary/PostProcessing.ts` (stub)

**Step 1: Write stub**

```typescript
// src/planetary/PostProcessing.ts — STUB
import { EffectComposer, Pass } from 'postprocessing'
import type * as THREE from 'three'

export type PostQuality = 'low' | 'medium' | 'high'

export class PostProcessing {
  composer: EffectComposer | null = null
  private preset: PostQuality = 'medium'

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    try {
      this.composer = new EffectComposer(renderer)
    } catch {
      // Graceful fallback: null means no post-processing
      this.composer = null
    }
  }

  setQuality(preset: PostQuality): void { this.preset = preset }
  render(_dt: number): void { this.composer?.render() }
  dispose(): void { this.composer?.dispose() }
}
```

**Step 2: Verify build**

```bash
npx tsc --noEmit src/planetary/PostProcessing.ts
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/planetary/PostProcessing.ts
git commit -m "feat(planetary): add PostProcessing stub — EffectComposer wrapper"
```

### Task 9: Implement PostProcessing passes (bloom + SSAO + SMAA + ACES)

**Objective:** Full post-processing chain with quality presets.

**Files:**
- Modify: `src/planetary/PostProcessing.ts`

**Step 1: Rewrite PostProcessing.ts**

```typescript
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  SSAOEffect,
  SMAAEffect,
  ToneMappingEffect,
  NormalPass,
  BlendFunction,
  KernelSize,
  EdgeDetectionMode,
  SMAAAreaImageSource,
} from 'postprocessing'
import type * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

export type PostQuality = 'low' | 'medium' | 'high'

export class PostProcessing {
  composer: EffectComposer | null = null
  private preset: PostQuality
  private bloom: BloomEffect | null = null
  private ssao: SSAOEffect | null = null
  private smaa: SMAAEffect | null = null
  private toneMapping: ToneMappingEffect | null = null
  private normalPass: NormalPass | null = null
  private renderPass: RenderPass | null = null
  private effectPass: EffectPass | null = null
  private disposed = false

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.preset = PLANETARY_CONFIG.post.defaultPreset as PostQuality
    try {
      this.composer = new EffectComposer(renderer)
      this.renderPass = new RenderPass(scene, camera)
      this.composer.addPass(this.renderPass)

      this.normalPass = new NormalPass(scene, camera, {})
      this.bloom = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        kernelSize: KernelSize.MEDIUM,
        luminanceThreshold: PLANETARY_CONFIG.post.bloomThreshold,
        luminanceSmoothing: 0.1,
        intensity: PLANETARY_CONFIG.post.bloomStrength,
      })
      this.ssao = new SSAOEffect(camera, this.normalPass.renderTarget.texture, {
        blendFunction: BlendFunction.MULTIPLY,
        samples: 16,
        rings: 4,
        radius: PLANETARY_CONFIG.post.ssaoRadius,
        intensity: 1.0,
        worldDistanceThreshold: 200,
        worldDistanceFalloff: 0.9,
      })
      this.smaa = new SMAAEffect(
        EdgeDetectionMode.COLOR,
        SMAAAreaImageSource.AREA_TEX,
        SMAAAreaImageSource.SEARCH_TEX
      )
      this.toneMapping = new ToneMappingEffect({ mode: 2 /* ACES_FILMIC */ as any })

      this.rebuildEffectPass()
    } catch {
      this.composer = null
    }
  }

  private rebuildEffectPass(): void {
    if (!this.composer || !this.bloom || !this.ssao || !this.smaa || !this.toneMapping) return
    // Remove old EffectPass if present
    const oldPasses = this.composer.passes
    for (let i = oldPasses.length - 1; i >= 0; i--) {
      if (oldPasses[i] instanceof EffectPass) {
        this.composer.removePass(oldPasses[i])
      }
    }

    const effects: any[] = [this.toneMapping]
    if (this.preset !== 'low') {
      effects.unshift(this.smaa)
    }
    if (this.preset !== 'low') {
      effects.unshift(this.bloom)
    }
    effects.unshift(this.ssao)

    this.effectPass = new EffectPass(undefined as any, ...effects)
    if (this.preset === 'low') {
      this.ssao.ssaoMaterial.uniforms.get('resolutionScale')!.value = 0.25
      this.ssao.ssaoMaterial.uniforms.get('samples')!.value = 8
    } else if (this.preset === 'high') {
      this.ssao.ssaoMaterial.uniforms.get('resolutionScale')!.value = 1.0
      this.ssao.ssaoMaterial.uniforms.get('samples')!.value = 32
    } else {
      this.ssao.ssaoMaterial.uniforms.get('resolutionScale')!.value = 0.5
      this.ssao.ssaoMaterial.uniforms.get('samples')!.value = 16
    }
    this.composer.addPass(this.effectPass)
  }

  setQuality(preset: PostQuality): void {
    if (preset === this.preset) return
    this.preset = preset
    this.rebuildEffectPass()
  }

  render(dt: number): void {
    if (this.disposed || !this.composer) return
    this.composer.render(dt)
  }

  renderWithoutPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    renderer.render(scene, camera)
  }

  dispose(): void {
    this.disposed = true
    this.composer?.dispose()
    this.composer = null
    this.bloom?.dispose()
    this.ssao?.dispose()
    this.smaa?.dispose()
    this.toneMapping?.dispose()
    this.normalPass?.dispose()
  }
}
```

**Step 2: Verify build**

```bash
npx tsc --noEmit src/planetary/PostProcessing.ts
```

**Step 3: Commit**

```bash
git add src/planetary/PostProcessing.ts
git commit -m "feat(planetary): implement PostProcessing pass chain (bloom/SSAO/SMAA/ACES)"
```

### Task 10: Create CascadedShadows (4-cascade shadow mapping)

**Objective:** Replace single shadow map with 4 cascades.

**Files:**
- Create: `src/planetary/CascadedShadows.ts`

**Step 1: Write CascadedShadows.ts**

```typescript
import * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

export class CascadedShadows {
  readonly lights: THREE.DirectionalLight[]
  private cascadeSplits: number[]
  private cascadeRes: number
  private disabled = false

  constructor() {
    this.cascadeSplits = PLANETARY_CONFIG.shadows.cascadeSplits
    this.cascadeRes = PLANETARY_CONFIG.shadows.cascadeResolution
    this.lights = []

    for (let i = 0; i < PLANETARY_CONFIG.shadows.cascadeCount; i++) {
      const light = new THREE.DirectionalLight(0xffffff, 0)
      light.castShadow = true
      light.shadow.mapSize.set(this.cascadeRes, this.cascadeRes)
      light.shadow.camera.near = 0.5
      light.shadow.camera.far = 1000
      light.shadow.bias = -0.0005
      light.shadow.normalBias = 0.02
      light.visible = false
      this.lights.push(light)
    }
  }

  get source(): THREE.DirectionalLight {
    return this.lights[0]
  }

  get disabled_(): boolean {
    return this.disabled
  }

  update(sunDirection: THREE.Vector3, camera: THREE.Camera, scene: THREE.Object3D): void {
    if (this.disabled) return

    // Compute cascade frustum centers
    const sunDir = sunDirection.clone().normalize()
    const camPos = camera.position.clone()

    for (let i = 0; i < this.lights.length; i++) {
      const near = i === 0 ? 0.1 : this.cascadeSplits[i - 1]
      const far = this.cascadeSplits[i]

      // Center of cascade in camera space
      const center = camPos.clone().add(
        camera.getWorldDirection(new THREE.Vector3()).multiplyScalar((near + far) / 2),
      )

      const light = this.lights[i]
      light.position.copy(center).add(sunDir.clone().multiplyScalar(150))
      light.target.position.copy(center)
      light.target.updateMatrixWorld()

      const halfSize = far * 0.8
      light.shadow.camera.left = -halfSize
      light.shadow.camera.right = halfSize
      light.shadow.camera.top = halfSize
      light.shadow.camera.bottom = -halfSize
      light.shadow.camera.updateProjectionMatrix()
    }
  }

  /** Add all cascade lights to a scene (call once) */
  addToScene(scene: THREE.Scene): void {
    for (const light of this.lights) {
      scene.add(light)
      scene.add(light.target)
      light.visible = true
    }
  }

  /** Remove from scene */
  removeFromScene(scene: THREE.Scene): void {
    for (const light of this.lights) {
      scene.remove(light.target)
      scene.remove(light)
    }
  }

  /** Set overall shadow intensity */
  setIntensity(intensity: number): void {
    for (const light of this.lights) {
      light.intensity = intensity / this.lights.length
    }
  }

  setColor(color: THREE.Color): void {
    for (const light of this.lights) {
      light.color.copy(color)
    }
  }

  /** Fallback: use existing single-shadow light instead */
  fallbackToSingle(shadowLight: THREE.DirectionalLight): void {
    this.disabled = true
    for (const l of this.lights) {
      l.visible = false
      l.intensity = 0
    }
    shadowLight.castShadow = true
    shadowLight.visible = true
  }

  setCascadeSplits(splits: number[]): void {
    this.cascadeSplits = splits
  }

  dispose(): void {
    for (const l of this.lights) {
      l.dispose()
    }
    this.lights.length = 0
  }
}
```

**Step 2: Verify type check**

```bash
npx tsc --noEmit src/planetary/CascadedShadows.ts
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/planetary/CascadedShadows.ts
git commit -m "feat(planetary): add CascadedShadows — 4-cascade shadow mapping"
```

---

## Phase 5: Terrain Elevation

### Task 11: Create TerrainElevation

**Objective:** Load DEM tiles, sample heights, create displaced terrain mesh.

**Files:**
- Create: `src/planetary/TerrainElevation.ts`

**Step 1: Write TerrainElevation.ts**

```typescript
import * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

const GRID_RES = PLANETARY_CONFIG.terrain.gridResolution
const GRID_RADIUS = PLANETARY_CONFIG.terrain.gridRadius
const REFRESH_DIST = PLANETARY_CONFIG.terrain.refreshDistance

export class TerrainElevation {
  private mesh: THREE.Mesh | null = null
  private lastSamplePos: THREE.Vector3 | null = null
  private fallbackMode = false
  private initialized = false
  private onHeightReady: (() => void) | null = null

  constructor(
    private map: Pick<maplibregl.Map, 'addSource' | 'setTerrain' | 'getTerrain' | 'queryTerrainElevation'>,
    private toLocal: (lng: number, lat: number) => [number, number],
    private toLngLat: (x: number, z: number) => [number, number],
  ) {}

  get terrainMesh(): THREE.Mesh | null { return this.mesh }
  get active(): boolean { return !this.fallbackMode }

  async init(): Promise<void> {
    try {
      // Set up MapLibre terrain with DEM source
      this.map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.png?key=get_your_key'],
        tileSize: 256,
        maxzoom: 14,
      })
      this.map.setTerrain({ source: 'terrain-dem', exaggeration: 1 })

      // Wait briefly for first tiles to load
      await new Promise(r => setTimeout(r, 2000))
      this.onHeightReady?.()
    } catch {
      // Public DEM source may not be available; fall back to flat
      console.warn('TerrainElevation: DEM source unavailable — using flat terrain')
      this.fallbackMode = true
    }
  }

  /** Compute terrain height at a local XZ position (meters from origin) */
  getHeight(x: number, z: number): number {
    if (this.fallbackMode || !this.initialized) return 0
    try {
      const [lng, lat] = this.toLngLat(x, z)
      const elev = (this.map as any).queryTerrainElevation?.({ lng, lat })
      return elev ?? 0
    } catch {
      return 0
    }
  }

  /** Build or rebuild the terrain mesh centered on a local position */
  update(playerPos: THREE.Vector3): void {
    if (this.fallbackMode) return

    // Skip rebuild if player hasn't moved far enough
    if (this.lastSamplePos && playerPos.distanceTo(this.lastSamplePos) < REFRESH_DIST) return
    this.lastSamplePos = playerPos.clone()

    const gridHalf = Math.floor(GRID_RADIUS / GRID_RES)
    const segW = gridHalf * 2
    const segH = gridHalf * 2

    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (let iz = 0; iz <= segH; iz++) {
      for (let ix = 0; ix <= segW; ix++) {
        const x = playerPos.x + (ix - gridHalf) * GRID_RES
        const z = playerPos.z + (iz - gridHalf) * GRID_RES
        const y = this.getHeight(x, z)
        positions.push(x, y, z)
        uvs.push(ix / segW, iz / segH)
      }
    }

    for (let iz = 0; iz < segH; iz++) {
      for (let ix = 0; ix < segW; ix++) {
        const a = iz * (segW + 1) + ix
        const b = a + 1
        const c = a + (segW + 1)
        const d = c + 1
        indices.push(a, b, d)
        indices.push(a, d, c)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()

    // Dispose old mesh
    if (this.mesh) {
      this.mesh.geometry.dispose()
      (this.mesh.material as THREE.Material).dispose()
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a6b38,
      roughness: 0.95,
      metalness: 0,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.receiveShadow = true
    this.mesh.castShadow = true
  }

  addToScene(scene: THREE.Scene): void {
    if (this.mesh) scene.add(this.mesh)
  }

  removeFromScene(scene: THREE.Scene): void {
    if (this.mesh) scene.remove(this.mesh)
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose()
      (this.mesh.material as THREE.Material).dispose()
      this.mesh = null
    }
  }
}
```

**Step 2: Verify type check**

```bash
npx tsc --noEmit src/planetary/TerrainElevation.ts
```

**Step 3: Commit**

```bash
git add src/planetary/TerrainElevation.ts
git commit -m "feat(planetary): add TerrainElevation — DEM-based terrain mesh"
```

---

## Phase 6: Integration into PlanetaryEngine

### Task 12: Wire new components into PlanetaryEngine

**Objective:** Add AtmosphereConfig, PostProcessing, CascadedShadows, TerrainElevation,
and BuildingGeometry to PlanetaryEngine. Preserve all existing API.

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts`

**Step 1: Read the current file to note the exact structure**

Read `src/planetary/PlanetaryEngine.ts:1-20` to confirm imports, and the class fields around lines 25-50.

**Step 2: Add new imports at top**

Insert after existing imports:
```typescript
import { AtmosphereConfig } from './AtmosphereConfig'
import { BuildingGeometry } from './BuildingGeometry'
import { CascadedShadows } from './CascadedShadows'
import { PostProcessing } from './PostProcessing'
import type { PostQuality } from './PostProcessing'
import { PLANETARY_CONFIG } from './PlanetaryConfig'
```

**Step 3: Add new fields to class**

After `private buildingMat`, add:
```typescript
private atmosphere = new AtmosphereConfig()
private csm = new CascadedShadows()
private postProcess: PostProcessing | null = null
private terrainElevation: TerrainElevation | null = null
private terrainGroup = new THREE.Group()
```

**Step 4: In constructor, after `this.scene.add(this.roads)`:**
- Remove old sun light setup (keep only the HemisphereLight, remove single DirectionalLight)
- Remove `this.sun` field usage
- Add terrain group to scene
- Add `this.csm.addToScene(this.scene)`

**Step 5: Modify `setSunAngle`:**
- Use `this.atmosphere.update(state.elevation)` to drive sky / fog / hemisphere
- Delegate shadow updates to `this.csm`

**Step 6: Modify `setBuildings`:**
- Instead of `BoxGeometry`, call `BuildingGeometry.generate()` for each building
- Apply separate wall/roof materials

**Step 7: Modify `render`:**
- Initialize PostProcessing on first frame (after renderer creation)
- Call `this.postProcess.render(dt)` instead of `this.renderer.render()`

**Step 8: Modify `dispose`:**
- Call `this.csm.dispose()`, `this.postProcess?.dispose()`

**Step 9: Add new public methods:**
- `setPostProcessingPreset(preset: PostQuality)`
- `getTerrainHeight(x: number, z: number): number`

**Step 10: Run existing tests:**

```bash
npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts
```
Expected: All existing tests pass (adjust mocks if needed for new imports).

**Step 11: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts
git commit -m "feat(planetary): integrate AtmosphereConfig, CSM, PostProcessing, BuildingGeometry into engine"
```

### Task 13: Update PlanetaryEngine test mocks

**Objective:** Fix tests broken by new component imports.

**Files:**
- Modify: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Step 1:** In the `vi.mock('maplibre-gl', ...)` block, add `addSource: vi.fn()`, `setTerrain: vi.fn()`, `getTerrain: vi.fn(() => null)` to the MockMap.
Also mock `queryTerrainElevation: vi.fn(() => 0)`.

**Step 2:** Run tests to verify.

```bash
npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts
```
Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "test(planetary): update engine mocks for new component imports"
```

---

## Phase 7: Integration into PlanetaryMode

### Task 14: Wire AtmosphereConfig and PostProcessing into PlanetaryMode

**Objective:** Use new engine features in the game loop.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx`

**Step 1:** After `engine.setSunAngle(...)`, add atmosphere update.

**Step 2:** After `engine.render()`, the post-processing is handled internally.

**Step 3:** Add sun hour slider if desired (existing `setSunHour` state).

**Step 4:** Commit.

### Task 15: Auto-detect quality preset based on performance

**Objective:** Monitor FPS and degrade post-processing quality if needed.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx`

**Step 1:** In the game loop, track rolling average FPS over 5 seconds.
**Step 2:** After 5 seconds, if FPS < 30, call `engineRef.current.setPostProcessingPreset('low')`.

**Step 3: Commit.**

---

## Phase 8: Road enhancements

### Task 16: Add road lane markings

**Objective:** Add center-line quads to road rendering.

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts` (setRoads method)

**Step 1:** In `setRoads`, after creating each road strip mesh, create a second pass of thin white quads along the road center.

**Step 2:** Commit.

### Task 17: Add sidewalk quads

**Objective:** Raised sidewalk strips along building-adjacent road edges.

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts` (setRoads method)
- Modify: `src/planetary/PlanetaryScenery.ts` (extract sidewalk data)

**Step 1:** In `PlanetaryScenery.extractRoads`, check `sidewalk` property.
**Step 2:** In `PlanetaryEngine.setRoads`, create raised sidewalk meshes.

**Step 3:** Commit.

---

## Phase 9: Final integration

### Task 18: Full build and lint verification

**Objective:** Ensure everything compiles and lints clean.

```bash
npm run build && npm run lint
```

### Task 19: Run all tests

```bash
npm run test
```

Expected: All tests pass, no regressions.

### Task 20: Manual visual verification

Run `npm run dev` and verify:
- Buildings show proper roof shapes
- Sun position changes throughout day
- Shadows look correct with 4 cascades
- Bloom and SSAO visible on screen
- Terrain follows elevation (if DEM source works)

---

## Summary

20 tasks across 9 phases. Each task produces an independent commit.
Total estimated work: 80-100 minutes for an experienced developer.

**Execution preference:** Subagent-driven — dispatch one subagent per phase
(9 subagents). Within each phase, tasks are sequential.
