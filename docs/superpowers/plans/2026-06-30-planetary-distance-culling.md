# Planetary Distance Culling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop creating/drawing meshes for planetary-mode buildings, roads, and trees once they're beyond the distance where fog already hides them (600m), cutting wasted GPU/CPU work without changing what's visible.

**Architecture:** Add small private helpers to `PlanetaryEngine` that compute the current fog-far cutoff and test a local XZ point against it relative to `this.camera.position`. Call these helpers inside `setBuildings`, `setRoads`, and `setTrees` to skip mesh/instance creation for out-of-range objects before any expensive geometry work happens.

**Tech Stack:** TypeScript, Three.js, Vitest.

## Global Constraints

- Cutoff value is read from `this.scene.fog.far` (currently 600, set at `PlanetaryEngine.ts:60`) — no new standalone constant.
- Only `src/planetary/PlanetaryEngine.ts` and its test file are touched. `PlanetaryScenery.ts` (feature extraction, used by collision) is out of scope.
- `setGreenAreas` is out of scope — already one merged mesh regardless of area.
- No quality-preset tiering of cutoff distance — single hard cutoff only.

---

### Task 1: Cull helpers + building culling

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts` (add private helpers; modify `setBuildings`, `PlanetaryEngine.ts:188-203`)
- Test: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Interfaces:**
- Produces: `private cullFar(): number` — returns `this.scene.fog.far` if `this.scene.fog instanceof THREE.Fog`, else `Infinity`.
- Produces: `private isBeyond(x: number, z: number, far: number): boolean` — true if the XZ distance from `this.camera.position` to `(x, z)` exceeds `far`.
- Produces: `private footprintCentroid(footprint: [number, number][]): [number, number]` — average of all footprint points.
- Consumes (later tasks reuse): `cullFar()`, `isBeyond(x, z, far)`.

- [ ] **Step 1: Write the failing test**

Add to `src/planetary/__tests__/PlanetaryEngine.test.ts`, inside the first `describe('PlanetaryEngine', ...)` block (after the existing `'builds building meshes from footprint specs'` test, before the `'places the camera...'` test):

```ts
  it('culls buildings beyond the fog-far distance', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    engine.setViewFromPlayer(new THREE.Vector3(0, 1.7, 0), 0, 0)

    let beforeCount = 0
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) beforeCount++ })

    const specs: BuildingSpec[] = [
      { footprint: [[0,0],[8,0],[8,8],[0,8]], height: 12, roofShape: 'flat' },
      { footprint: [[700,700],[708,700],[708,708],[700,708]], height: 12, roofShape: 'flat' },
    ]
    engine.setBuildings(specs)

    let afterCount = 0
    engine.scene.traverse(o => { if (o instanceof THREE.Mesh) afterCount++ })

    expect(afterCount - beforeCount).toBe(1)
    engine.dispose()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts -t "culls buildings beyond"`
Expected: FAIL — `afterCount - beforeCount` is `2`, not `1` (both buildings currently get meshes).

- [ ] **Step 3: Add the helpers and wire them into `setBuildings`**

In `src/planetary/PlanetaryEngine.ts`, add these three private methods directly above `setBuildings` (currently at line 188):

```ts
  private cullFar(): number {
    return this.scene.fog instanceof THREE.Fog ? this.scene.fog.far : Infinity
  }

  private isBeyond(x: number, z: number, far: number): boolean {
    const dx = x - this.camera.position.x
    const dz = z - this.camera.position.z
    return dx * dx + dz * dz > far * far
  }

  private footprintCentroid(footprint: [number, number][]): [number, number] {
    let sx = 0
    let sz = 0
    for (const [x, z] of footprint) { sx += x; sz += z }
    return [sx / footprint.length, sz / footprint.length]
  }
```

Then update `setBuildings` (replace the existing method body):

```ts
  setBuildings(specs: BuildingSpec[]) {
    this.disposeGroup(this.buildings)
    const far = this.cullFar()
    for (const spec of specs) {
      const [cx, cz] = this.footprintCentroid(spec.footprint)
      if (this.isBeyond(cx, cz, far)) continue
      let geo: THREE.BufferGeometry
      try {
        geo = BuildingGeometry.generate(spec)
      } catch {
        continue
      }
      const mesh = new THREE.Mesh(geo, [this.wallMat, this.roofMat])
      // DO NOT set mesh.position — footprints are absolute local XZ
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.buildings.add(mesh)
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: PASS (all tests in the file, including the existing `'builds building meshes from footprint specs'` test, which is unaffected since its fixtures sit within ~28m of the default camera origin).

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "perf(planetary): cull buildings beyond fog-far distance"
```

---

### Task 2: Road culling

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts` (`setRoads`, `PlanetaryEngine.ts:205-266`)
- Test: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Interfaces:**
- Consumes: `cullFar()`, `isBeyond(x, z, far)` from Task 1.

- [ ] **Step 1: Write the failing test**

Add to `src/planetary/__tests__/PlanetaryEngine.test.ts`, inside the `describe('PlanetaryEngine — setRoads / setTrees / setGreenAreas', ...)` block, after `makeRoadStrip()`'s existing usages (add a new helper function right after `makeRoadStrip` and a new test after `'setRoads disposes old meshes on rebuild'`):

```ts
function makeFarRoadStrip(): RoadStrip {
  return {
    corners: [
      new THREE.Vector3(700, 0.05, 700),
      new THREE.Vector3(700, 0.05, 704),
      new THREE.Vector3(710, 0.05, 704),
      new THREE.Vector3(710, 0.05, 700),
    ],
    uvLength: 10,
  }
}
```

```ts
  it('culls roads beyond the fog-far distance', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    engine.setViewFromPlayer(new THREE.Vector3(0, 1.7, 0), 0, 0)

    let before = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) before++ })
    engine.setRoads([makeRoadStrip(), makeFarRoadStrip()])
    let after = 0; engine.scene.traverse(o => { if (o instanceof THREE.Mesh) after++ })

    // near strip adds a road mesh + a lane-marking mesh; far strip adds none
    expect(after - before).toBe(2)
    engine.dispose()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts -t "culls roads beyond"`
Expected: FAIL — `after - before` is `4` (both strips add meshes), not `2`.

- [ ] **Step 3: Cull far strips in `setRoads`**

In `src/planetary/PlanetaryEngine.ts`, update `setRoads` (currently lines 205-266) by adding a cull check at the top of the loop. The method becomes:

```ts
  setRoads(roads: RoadStrip[]): void {
    this.disposeGroup(this.roads)
    const far = this.cullFar()
    for (const strip of roads) {
      const [a, b, c, d] = strip.corners
      const mx = (a.x + b.x + c.x + d.x) / 4
      const mz = (a.z + b.z + c.z + d.z) / 4
      if (this.isBeyond(mx, mz, far)) continue
      // Two triangles: ABD and BCD
      const positions = new Float32Array([
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        d.x, d.y, d.z,
        b.x, b.y, b.z,
        c.x, c.y, c.z,
        d.x, d.y, d.z,
      ])
      // UV: tile along length, road width = 1 UV unit
      const uvLen = strip.uvLength / 4  // tile every 4 m
      const uvs = new Float32Array([
        0, 0,  1, 0,  0, uvLen,
        1, 0,  1, uvLen,  0, uvLen,
      ])
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      geo.computeVertexNormals()
      const mesh = new THREE.Mesh(geo, this.roadMat)
      mesh.receiveShadow = true
      this.roads.add(mesh)

      // Center-line marking: a 0.12 m-wide white quad strip raised +0.02 Y above the road.
      // Corners [a, b, c, d]: a and b share v=0 (one short edge), d and c share v=uvLen (other short edge).
      // Centerline endpoints are midpoints of the two short (cross-strip) edges.
      const yOffset = 0.02
      const mid1x = (a.x + b.x) / 2
      const mid1y = (a.y + b.y) / 2 + yOffset
      const mid1z = (a.z + b.z) / 2
      const mid2x = (d.x + c.x) / 2
      const mid2y = (d.y + c.y) / 2 + yOffset
      const mid2z = (d.z + c.z) / 2

      const cdx = mid2x - mid1x
      const cdz = mid2z - mid1z
      const clen = Math.sqrt(cdx * cdx + cdz * cdz)
      if (clen > 1e-6) {
        // Perpendicular offset of 0.06 m (half of 0.12 m width)
        const px = (-cdz / clen) * 0.06
        const pz = (cdx / clen) * 0.06

        const lanePos = new Float32Array([
          mid1x + px, mid1y, mid1z + pz,
          mid1x - px, mid1y, mid1z - pz,
          mid2x + px, mid2y, mid2z + pz,
          mid1x - px, mid1y, mid1z - pz,
          mid2x - px, mid2y, mid2z - pz,
          mid2x + px, mid2y, mid2z + pz,
        ])
        const laneGeo = new THREE.BufferGeometry()
        laneGeo.setAttribute('position', new THREE.BufferAttribute(lanePos, 3))
        laneGeo.computeVertexNormals()
        const laneMesh = new THREE.Mesh(laneGeo, this.laneMat)
        this.roads.add(laneMesh)
      }
    }
  }
```

(Only the new `const far = this.cullFar()` line and the `if (this.isBeyond(...)) continue` line are new; everything else in the method body is unchanged from the current implementation.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: PASS (all tests, including the existing `'setRoads adds meshes to scene'` and `'setRoads disposes old meshes on rebuild'`, which use only near-origin strips and are unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "perf(planetary): cull roads beyond fog-far distance"
```

---

### Task 3: Tree culling

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts` (`setTrees`, `PlanetaryEngine.ts:268-288`)
- Test: `src/planetary/__tests__/PlanetaryEngine.test.ts`

**Interfaces:**
- Consumes: `cullFar()`, `isBeyond(x, z, far)` from Task 1.

- [ ] **Step 1: Write the failing test**

Add to `src/planetary/__tests__/PlanetaryEngine.test.ts`, after the existing `'setTrees adds an InstancedMesh to scene'` test:

```ts
  it('culls trees beyond the fog-far distance', () => {
    const container = document.createElement('div')
    const engine = new PlanetaryEngine(container)
    ;(engine.map as any)._triggerLoad()
    engine.setViewFromPlayer(new THREE.Vector3(0, 1.7, 0), 0, 0)

    engine.setTrees([new THREE.Vector3(10, 0, 10), new THREE.Vector3(800, 0, 800)])

    let mesh: THREE.InstancedMesh | undefined
    engine.scene.traverse(o => { if (o instanceof THREE.InstancedMesh) mesh = o })
    expect(mesh).toBeDefined()
    expect(mesh!.count).toBe(1)
    engine.dispose()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts -t "culls trees beyond"`
Expected: FAIL — `mesh!.count` is `2`, not `1`.

- [ ] **Step 3: Filter positions in `setTrees`**

In `src/planetary/PlanetaryEngine.ts`, update `setTrees` (currently lines 268-288):

```ts
  setTrees(positions: THREE.Vector3[]): void {
    if (this.trees) {
      this.trees.geometry.dispose()
      this.scene.remove(this.trees)
      this.trees = null
    }
    const far = this.cullFar()
    const visible = positions.filter(p => !this.isBeyond(p.x, p.z, far))
    if (visible.length === 0) return
    const geo = new THREE.PlaneGeometry(6, 10)
    const mesh = new THREE.InstancedMesh(geo, this.treeMat, visible.length)
    mesh.castShadow = true
    const dummy = new THREE.Object3D()
    for (let i = 0; i < visible.length; i++) {
      dummy.position.copy(visible[i])
      dummy.position.y = 5  // center of 10 m tall plane
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    this.trees = mesh
    this.scene.add(this.trees)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/planetary/__tests__/PlanetaryEngine.test.ts`
Expected: PASS (all tests, including the existing `'setTrees adds an InstancedMesh to scene'`, which uses only near-origin positions and is unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts src/planetary/__tests__/PlanetaryEngine.test.ts
git commit -m "perf(planetary): cull trees beyond fog-far distance"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: All tests pass, no regressions in unrelated suites.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds with no type errors (catches test-file type errors `tsc --noEmit` alone would miss).

- [ ] **Step 3: Push**

```bash
git push
```
