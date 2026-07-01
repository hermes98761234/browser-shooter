# Planetary Mode — Sidewalks, Water, Building Variety — Design Spec

**Date:** 2026-07-01
**Status:** Approved

## Goal

Close the visual gap between Planetary Mode and the streets-gl reference (paved sidewalks alongside/crossing roads, water areas, and visually distinct small houses vs. apartment blocks), building on `2026-06-29-streets-gl-visual-detail-design.md` which already delivered textured buildings, roads, billboard trees, and green areas.

## Context

Current state (`src/planetary/PlanetaryScenery.ts`, `PlanetaryEngine.ts`, `BuildingGeometry.ts`):
- Roads: all `transportation` layer lines (including `pedestrian`/`path`/`footway`/`cycleway`/`steps`/`bridleway`) render identically — asphalt texture + white centerline, just narrower.
- No water rendering — `water` OMT layer is never queried.
- Buildings: roof shape already varies per-tag (`flat`/`gabled`/`hipped`/`pyramidal`), but wall material is a single shared textured facade for every building regardless of type or size.

Investigated and explicitly out of scope:
- **Fences/barriers**: OpenMapTiles has no dedicated barrier-line layer, so real OSM fences/walls aren't reliably available from the current tile source. Dropped rather than faked.
- **Synthetic sidewalks** (offsetting every road edge to guarantee a sidewalk even where OSM has none): would need mitered corner geometry at intersections to avoid gaps/overlaps, and diverges from real map data. Not pursued now; noted below as a possible fast-follow.

## Architecture

### `src/planetary/PlanetaryScenery.ts`

**Roads → add a `kind` tag.** In `extractRoads()`, classify the same `cls` value already read (`subclass`/`class`) into `kind: 'road' | 'path'`:
- `pedestrian`, `path`, `footway`, `cycleway`, `steps`, `bridleway` → `'path'`
- everything else → `'road'`

```ts
export interface RoadStrip {
  corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]
  uvLength: number
  kind: 'road' | 'path'
}
```

No new query — this reclassifies data already extracted.

**Water → new extractor**, structurally identical to `extractGreenAreas()`:

```ts
const WATER_SOURCE_LAYER = 'water'

private extractWaterAreas(): Float32Array {
  // query WATER_SOURCE_LAYER, triangulate Polygon/MultiPolygon rings
  // via THREE.ShapeUtils.triangulateShape, same as extractGreenAreas.
  // No class filter — render all water polygons (river/lake/pond/dock/
  // ocean/swimming_pool) the same way.
}
```

Added to `SceneryData.waterTriangles: Float32Array`, populated in `update()` alongside the other four fields.

**Buildings → add a `buildingType` tag.** In `extractBuildings()`, read the OSM `building` tag (already have `props`):

```ts
const buildingTag = String(props.building ?? '')
const HOUSE_TYPES = new Set(['house', 'detached', 'semidetached_house', 'bungalow', 'cabin', 'farm'])
const buildingType: 'house' | 'other' = HOUSE_TYPES.has(buildingTag) ? 'house' : 'other'
```

Added to `BuildingSpec.buildingType`.

### `src/planetary/BuildingGeometry.ts`

`BuildingSpec` gains one optional field:

```ts
buildingType?: 'house' | 'other'   // default 'other'; drives wall material choice only
```

No geometry-generation change — roof/wall mesh building is unaffected. This field is read only by `PlanetaryEngine.setBuildings()`.

### `src/planetary/PlanetaryEngine.ts`

**New materials** (inline in constructor, matching the existing style of `greenMat`/`laneMat`):
- `pathMat`: `MeshStandardMaterial`, flat light gray (`0xb0aca4`), roughness 1, metalness 0. No texture asset — flat tint is enough to read as "paved footway" next to asphalt roads.
- `waterMat`: `MeshStandardMaterial`, flat blue (`0x2f6690`), roughness 0.15, metalness 0.1 for a bit of sheen. No reflection/refraction/animation.
- `houseWallMat`: `MeshStandardMaterial`, flat cream (`0xe8dcc0`), roughness 0.9, metalness 0, no texture map (tiling the apartment window facade texture onto a small house footprint looks wrong at that scale).

**`setRoads(roads: RoadStrip[])`**: when building each strip's mesh, pick `roadMat` or `pathMat` by `strip.kind`. Skip the centerline-stripe mesh entirely when `kind === 'path'`.

**`setWaterAreas(triangles: Float32Array)`**: new method, copy of `setGreenAreas()` with y=0.015 (just above the grass mesh's y=0.01, to avoid z-fighting where a pond sits at a park's edge) and `waterMat`.

**`setBuildings(specs: BuildingSpec[])`**: when constructing each building's `Mesh`, pass `[spec.buildingType === 'house' ? this.houseWallMat : this.wallMat, this.roofMat]` instead of the currently-hardcoded `[this.wallMat, this.roofMat]`. Roof material stays shared for both types.

### `src/planetary/PlanetaryMode.tsx`

One new wiring line alongside the existing `engine.setRoads/setTrees/setGreenAreas` calls in the rebuild-version-changed block:

```ts
engine.setWaterAreas(scenery.data.waterTriangles)
```

No new refs, no new state, no new UI.

## Data flow

Unchanged shape — `waterTriangles` and `kind`/`buildingType` just ride along inside the existing `SceneryData`/`BuildingSpec` structures through the same `markStale()` → `update()` → `rebuildVersion` pipeline already used for roads/trees/green areas/buildings.

## Culling & collision

- No change. Water and path strips flow through the same 600m fog-far cull and 50m rescan gate already applied to roads/green areas.
- No collision boxes added for water or sidewalks — only buildings get `BoxCollider` entries today, and none of these three additions are solid obstacles worth colliding with.

## Out of scope

- Synthetic sidewalks generated for every road regardless of OSM data (needs mitered intersection geometry — noted as a possible fast-follow if real sidewalk coverage proves too sparse in play).
- Fences/barriers (no OpenMapTiles source layer for them).
- Water shaders (reflection, refraction, waves, flow animation).
- House-specific roof/footprint shape beyond the existing roof:shape logic.
- Street furniture (benches, lamp posts, signs).

## Testing

- Unit test for `PlanetaryScenery.extractRoads()`: a footway feature produces `kind: 'path'`, a residential feature produces `kind: 'road'`.
- Unit test for `PlanetaryScenery.extractWaterAreas()`: mock `queryRenderedFeatures` returning a water Polygon, assert triangulated output is non-empty.
- Unit test for `PlanetaryScenery.extractBuildings()`: a feature with `building=house` produces `buildingType: 'house'`; a feature with `building=apartments` (or no tag) produces `'other'`.
- Manual verification: spawn in an area with mapped footways and a water body; confirm sidewalks render gray without a centerline, water renders as a blue plane, and small houses show a cream wall tint distinct from apartment towers.
