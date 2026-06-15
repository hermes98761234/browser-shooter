# Counter-Strike–style combat for the wave shooter

**Date:** 2026-06-15
**Status:** Approved

## Summary

Evolve the existing wave-survival horde shooter (Three.js + React) toward a
Counter-Strike feel **without** changing the core wave-survival loop. We add:

1. A real map with cover (crates, low walls, structures) instead of an empty arena.
2. Humanoid enemies built from Three.js primitives that **shoot back**
   (hitscan + visible tracer + telegraph), alongside the existing melee rushers.
3. Full collision and line-of-sight: obstacles block both movement and bullets.
4. A first-person weapon viewmodel (gun in the player's hands) with bob and recoil.

All visuals are built from Three.js primitives — no asset-loading pipeline,
works offline.

### Explicitly out of scope

- **Fullscreen / pointer-lock changes:** none. Leave current behavior untouched.
- Round-based / bomb-defuse / buy-phase mechanics. Wave survival stays.
- External GLTF/model assets.

## Architecture

New modules and the files they touch:

| File | Status | Responsibility |
|------|--------|----------------|
| `src/engine/CollisionWorld.ts` | new | Box-collider registry; movement push-out + segment LOS test |
| `src/engine/Arena.ts` | rewritten | Build map with cover, return a `CollisionWorld` |
| `src/enemies/EnemyModel.ts` | new | `buildSoldier(type)` → humanoid `THREE.Group` |
| `src/enemies/Enemy.ts` | rewritten | Group model, melee + ranged AI, LOS, tagged actions |
| `src/enemies/EnemyDefs.ts` | edited | New combat fields + ranged enemy types |
| `src/enemies/WaveManager.ts` | edited | Mix ranged types into waves |
| `src/weapons/Viewmodel.ts` | new | First-person gun parented to camera; bob + recoil |
| `src/effects/ParticleSystem.ts` | edited | `tracer(from, to)` + enemy telegraph muzzle flash |
| `src/player/Player.ts` | edited | Resolve movement against `CollisionWorld` |
| `src/App.tsx` | edited | Wire collision world, enemy actions, viewmodel, LOS for player shots |
| `src/types.ts` | edited | Extend `EnemyDef`; add enemy action union |

## Components

### 1. CollisionWorld (`src/engine/CollisionWorld.ts`)

Pure logic, no scene dependency, fully unit-testable.

- Holds a list of axis-aligned box colliders `{ min: Vector3, max: Vector3 }`.
- `addBox(center, size)` — register a collider.
- `resolve(pos, radius): void` — circle-vs-AABB push-out on the X/Z plane.
  Resolve each axis independently so entities slide along surfaces instead of
  sticking. Mutates `pos`.
- `segmentBlocked(from, to): number | null` — ray/segment-vs-box; returns the
  distance to the nearest blocking box along the segment, or `null` if clear.
  Used for enemy line-of-sight and to stop player bullets through walls.

### 2. Map (`src/engine/Arena.ts`)

`createArena(scene): CollisionWorld`

- Ground plane (concrete-ish material) + perimeter walls (registered as colliders).
- Interior cover: stacked crates, low walls / sandbag rows, two small raised
  structures or pillars, one central hard-cover piece. Each obstacle adds its
  AABB to the returned `CollisionWorld`.
- Lighting retained but warmed toward daylight to reduce the "arena" look.

### 3. Humanoid enemy model (`src/enemies/EnemyModel.ts`)

`buildSoldier(type): THREE.Group` — assembles head, torso, two arms, two legs,
and a held gun from primitives. Proportions/colors vary per type:
standard, light runner, bulky armored tank, ranged rifleman/sniper.

`Enemy.mesh` becomes a `THREE.Group`. Raycasts use recursive
`intersectObject(group, true)`. Death animation scales the group down (unchanged
behavior, new target type).

### 4. Enemy AI (`Enemy.ts`, `EnemyDefs.ts`, `types.ts`)

`EnemyDef` gains: `attackType: 'melee' | 'ranged'`, `fireRange`, `fireRate`,
`accuracy` (0–1 hit probability), `telegraphTime`, `standoff`.

`update(dt, playerPos, world)` returns a tagged action union or `null`:

```ts
type EnemyAction =
  | { type: 'melee'; damage: number }
  | { type: 'shoot'; damage: number; from: Vector3; to: Vector3; hit: boolean }
```

- **Melee** (grunt / runner / tank): rush + close-range hit (current behavior).
- **Ranged** (rifleman / sniper):
  - No LOS (via `segmentBlocked`) or out of `fireRange` → advance toward player
    to gain LOS.
  - LOS + within `fireRange` → hold at `standoff` distance, **telegraph**
    (muzzle flash + aim sound) for `telegraphTime`, then fire a **hitscan** shot.
    `accuracy` roll decides `hit`. Never fires when LOS is blocked.

App applies player damage when `hit`, spawns a tracer from `from`→`to`, plays a
sound, and triggers the existing directional damage indicator using the shooter
position. Movement runs through `CollisionWorld.resolve`. Waves mix ranged types in.

### 5. Effects (`ParticleSystem.ts`)

- `tracer(from, to)` — thin fading line/cylinder for enemy hitscan shots.
- Reuse `muzzleFlash` at the enemy gun for the telegraph cue.

### 6. Viewmodel (`src/weapons/Viewmodel.ts`)

Primitive gun model parented to the camera, positioned lower-right. Idle
weapon-bob driven by movement, recoil kick on fire that lerps back to rest,
and model swap per weapon (pistol / shotgun / rifle).

### 7. Player & bullet fixes

- `Player.update` resolves position against the `CollisionWorld` after movement
  integration (in addition to the existing arena clamp).
- `App.checkHit` refined: compare nearest enemy intersection distance against
  `segmentBlocked` / world geometry; only damage an enemy if it is closer than
  any blocking wall (line-of-sight for the player's shots too).

## Data flow

```
Controls ─▶ Player.update ─▶ CollisionWorld.resolve ─▶ camera follows player
                                   ▲
WaveManager ─▶ Enemy.update(dt, playerPos, world) ─┤ uses segmentBlocked for LOS
                                   │
                            returns EnemyAction
                                   │
App.onUpdate ─▶ apply melee/shoot ─▶ player.takeDamage + tracer + sound + damage indicator
App.onUpdate ─▶ player shoot ─▶ checkHit (enemy vs world LOS) ─▶ damage / impact
Viewmodel parented to camera ─▶ bob + recoil each frame
```

## Error handling / edge cases

- Enemy with no LOS never deals ranged damage (telegraph cancels if LOS lost).
- `resolve` is a no-op when not overlapping any box; safe to call every frame.
- Dead enemies skip AI and collision (death animation only).
- Tracers/flash effects are pooled/auto-expiring like existing particles; no leak.

## Testing (TDD)

Unit tests (vitest):

- **CollisionWorld:** push-out moves an overlapping point outside the box;
  non-overlapping point unchanged; `segmentBlocked` returns a distance when a
  box is between two points and `null` when the path is clear or goes around.
- **Ranged Enemy:** fires only with LOS and within `fireRange`; holds fire when
  `segmentBlocked` reports a wall; respects `telegraphTime` before first shot;
  returns a `shoot` action with correct `from`/`to`.
- **Enemy/WaveManager:** updated for the `THREE.Group` model and new enemy types
  appearing in wave definitions.

Existing e2e (Playwright) must still pass.
