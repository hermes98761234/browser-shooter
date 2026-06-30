# Planetary mode: distance culling for buildings/roads/trees

## Problem

`PlanetaryEngine` already sets `scene.fog = new THREE.Fog(0x9ec7e8, 120, 600)`
(`PlanetaryEngine.ts:60`), but fog only affects pixel color — every building,
road, and tree is still generated as real geometry and drawn every frame out
to the camera's far plane (2000m, `PlanetaryEngine.ts:62`). Buildings are one
`THREE.Mesh` per footprint with shadows enabled; roads are one mesh + one
lane-marking mesh per segment. None of this is culled by distance, so users
report low/unstable FPS in planetary mode.

## Goal

Stop creating and drawing meshes for objects beyond the point where fog
already makes them invisible (the fog's far value, 600m). No visible change
to the scene — only removes wasted GPU/CPU work.

## Approach

Cull in `PlanetaryEngine.ts` only, at the three methods that build meshes:

- `setBuildings(specs)`: compute each building footprint's centroid in local
  XZ, compare its distance to `this.camera.position` against
  `this.scene.fog.far`. Skip `BuildingGeometry.generate()` and mesh creation
  for specs beyond that distance.
- `setRoads(roads)`: same check using each strip's corner midpoint; skip mesh
  + lane-marking mesh creation for far segments.
- `setTrees(positions)`: filter the `positions` array by the same distance
  check before building the `InstancedMesh`.

The cutoff reads `this.scene.fog.far` directly rather than a new constant, so
the visual fog distance and the render-cost cutoff can never drift apart.

**Out of scope:**
- `PlanetaryScenery.ts` (feature extraction) is untouched. `scenery.data.buildings`
  is also consumed by collision logic; collision only matters at close range,
  so leaving extraction uncut is both simpler and safer.
- `setGreenAreas` is untouched — it's already a single merged mesh regardless
  of area, so there's no per-object cost to cut.
- No quality-preset tiering (low/medium/high cutoff distances) — out of scope
  per user decision; a single hard cutoff at fog-far is sufficient for now.

## Testing

Existing `PlanetaryEngine.test.ts` fixtures all sit within ~28m of the
default camera position, so they're unaffected. Add one test per method
(`setBuildings`, `setRoads`, `setTrees`) that places a fixture beyond 600m
from `camera.position` and asserts it's excluded from the resulting group
child count / instance count, alongside one within range that's still
included.
