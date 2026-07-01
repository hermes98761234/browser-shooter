# Planetary Mode: More Roads, Sidewalks, Labels, Street Objects

**Date:** 2026-07-01
**Goal:** Bring planetary mode closer to the streets-gl look (reference: user screenshot — textured roads, concrete sidewalks, place-name labels, street furniture) using only data already available in the loaded OpenMapTiles vector tiles. No new dependencies, no new network calls.

## Approach

Procedural augmentation of the existing `PlanetaryScenery` → `engine.setX()` pipeline. Rejected: streets-gl-style raw OSM/Overpass fetching (new network dependency + parsing layer for props indistinguishable at gameplay speed).

## Features

### 1. More road coverage

Widen the `transportation` sourceLayer filter in `PlanetaryScenery.ts`:

- Add classes: `service`, `track`, `pedestrian`, `busway`, `raceway`.
- Accept all `path` subclasses: `footway`, `cycleway`, `steps` (2 m wide), `pedestrian` (3 m wide).
- Same strip pipeline (`stripsFromFeature`), no new rendering code.

### 2. Sidewalks

For each car-road strip (class `minor` and above; not paths, not rails):

- Emit two flanking strips using the existing `pathMat` (light concrete).
- Offset: roadHalfWidth + 1 m from centerline; width 1.5 m; Y = 0.04 (below road Y = 0.05 so roads win overlaps, above grass Y = 0.01).
- Generated inside the existing strip-extraction step; sidewalk strips join the road-strip array so `engine.setRoads()` keeps its signature.

### 3. Place-name labels

- Query `poi` and `place` source layers via `queryRenderedFeatures` for features with a `name`.
- Keep the ~40 nearest to the player.
- Each name rendered to a small canvas → `THREE.Sprite`; distance fade; hidden beyond ~300 m.
- Rebuilt on the same map-idle/stale cycle as other scenery. New engine method `setLabels(...)` following the disposal + add pattern.

### 4. Street objects

Two `InstancedMesh`es, no shadow casting, hidden at perf level 2:

- **Lamp posts** (cylinder + small emissive sphere): every ~35 m along major/minor road strips, deterministic hash jitter (same pattern as forest trees). Cap ~200.
- **Benches** (two boxes): every ~50 m along paths that fall inside green areas. Cap ~80.

**Out of scope:** fences/hedges — OMT tiles carry no barrier data and procedural fences along every road read as noise.

## Performance

- Everything instanced or merged into per-type meshes.
- Respect the 600 m fog cull (`isBeyond()`) and the existing auto-degrade ladder (`engine.setPerfLevel`); street objects and labels off at level 2.

## Testing / Verification

- Headless drive-script recipe + `window.__eng` handle to check object counts and frame time.
- `npm run build` before push (catches test-file type errors `tsc --noEmit` misses).
- CI check after push per project instructions.
