# Dust2 Reimplementation — Design

**Date:** 2026-06-23
**Status:** Approved
**Scope:** Rewrite `src/maps/dust2.ts` into a faithful, full-callout layout of CS Dust2 using the existing box-geometry `MapDef` format. Reuse existing materials (no renderer changes).

## Goals

- Replace the current crude `dust2.ts` stub (two buildings + a mid walkway) with a layout whose named areas match the real Dust2 radar: a "four-lane / four-quadrant" map around a central Mid intersection.
- Keep `id: 'dust2'` so the registry, save data, and existing references are unchanged.
- Recognizable by **shape and relative position** of callouts, not by exact color. No `Arena.ts` / `CollisionWorld.ts` / `registry.ts` changes.

## Non-goals

- No new materials, lighting retune, or palette pass (explicitly deferred — layout only).
- No animated doors, curved geometry, or true sub-floor depressions (the engine is axis-aligned boxes on a flat floor).
- No gameplay/economy/bot tuning beyond placing valid spawns and bombsites.

## Coordinate frame (top-down radar orientation)

- `+x` = east = **A side** (right) · `-x` = west = **B side** (left)
- `+z` = south = **T spawn** (bottom) · `-z` = north = **CT side** (top)
- `arenaSize: 50` → 100×100 floor. All structures kept within ±48 so they stay inside the auto-generated perimeter walls.

## Region plan

Approximate centers `[x, z]`; exact box lists authored in implementation.

| Area | Callouts captured | Approx location | Material(s) |
|------|-------------------|-----------------|-------------|
| T Spawn | open courtyard, 3 exits (Long / Mid / Tunnels) | south `[0, 44]` | wall, crate |
| Mid | Suicide/Top-Mid incline, Mid Doors (gapped), Xbox crate, Catwalk start | spine `x≈4`; doors `[2,0]`; Xbox `[6,-2]` | wall, wood (doors), crate |
| A Long | Long Doors (2 gapped sets), Pit, A Car | east `x≈38`, `z 42→-6` | wall, concrete, metal/crate |
| A Short | Catwalk ledge, Stairs, Short over CT | `[16,-12]` elevated → A | concrete + stairs() |
| A Site | elevated platform, Goose alcove, A Ramp | `[34,-18]` (bombsite A) | concrete, crate |
| B Tunnels | Upper (T→B), Lower (branch→Mid near Xbox), stairs | west `x≈-20` | wall, concrete |
| B Site | walled courtyard, B Doors (gapped), Window (gap), Humvee/Car | `[-34,-20]` (bombsite B) | wall, metal |
| CT Spawn | under A-Short, behind Mid Doors | north-center `[-2,-34]` | concrete |

## Spawns & bombsites

- `tSpawns`: 4 points clustered ~`z 44` in the T courtyard.
- `ctSpawns`: 4 points clustered ~`z -34` in CT.
- `bombsites`: `A [34,-18]`, `B [-34,-20]` (engine fixes radius at 4). Both centers kept clear of walls/crates.

## Verticality

Uses only what the engine already supports: `stairs()` + box `supportHeight` for ramps, Catwalk, and the A-site platform; the Xbox crate is a jump-up step to Catwalk (`supportHeight` + jump). No new mechanics.

## Deliberate approximations (`ponytail:` comments in code)

- **Pit** → a waist-high walled enclosure at floor level; the flat floor can't be recessed below `y=0`.
- **Doors** (Mid / Long / B) → wall segments with a centered gap for the opening/sightline; no animated doors.

## Files touched

- `src/maps/dust2.ts` — full rewrite.
- `src/maps/buildings.ts` — export the existing internal `wall()` as `doorway()` for reuse (gapped double-doors recur 3×). No behavior change.
- New: `src/maps/dust2.test.ts`.

No changes to `Arena.ts`, `CollisionWorld.ts`, `registry.ts`, `MapDef.ts`.

## Testing

`dust2.test.ts` asserts the invariants that matter:
- All structures, spawns, and bombsites lie within `±arenaSize`.
- Exactly two bombsites (A and B) present.
- Each bombsite center is not embedded inside any structure box (XZ overlap check).
- Each spawn point is not embedded inside any structure box.

Then full `npm test` + `npm run lint` green before opening the PR.

## Delivery

Branch `feat/dust2-reimplement` → PR.
