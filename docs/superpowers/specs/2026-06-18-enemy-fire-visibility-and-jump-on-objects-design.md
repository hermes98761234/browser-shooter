# Enemy-fire visibility & jumping onto objects — design

Date: 2026-06-18

Two independent gameplay improvements requested:

1. **"I can't see when the enemy is shooting."** Make enemy fire clearly readable.
2. **"Add the ability to jump onto objects, like small walls."** Let the player land on top of low cover instead of only being shoved sideways.

The user asked to proceed autonomously and push to `main`. This spec records the chosen design; both features are small, additive, and well-bounded.

---

## Feature 1 — Enemy fire visibility

### Current behaviour
- When an enemy fires, `GameSession` emits an `enemyShoot` event (`from`, `to`, `hit`, `damage`, `victimId`).
- `App.tsx` has two event-handling paths:
  - **netClient path** (multiplayer): draws only a faint tracer (`particleSystem.tracer`) + audio. No muzzle flash, no telegraph.
  - **local session path** (single-player / co-op / host): draws a tracer + audio, and on `enemyTelegraph` (aim-start) shows a yellow muzzle flash.
- Problems: the actual *shot* has no flash at the muzzle; the tracer is thin, pale yellow, and lives only 0.12 s. The telegraph flash and (absent) shot flash are easy to miss and indistinguishable.

### Change
Make the moment of firing unmistakable, and visually separate "about to shoot" (warning) from "fired".

- `ParticleSystem.muzzleFlash(position, direction, color?, intensity?, distance?)` — parametrise color/intensity so callers can request a bright shot flash vs. a dim warning flash.
- `ParticleSystem.tracer(from, to, color?, life?)` — parametrise so enemy tracers can be a hot orange, brighter, and longer-lived (~0.2 s).
- On `enemyShoot` (in **both** App handlers): emit a bright muzzle flash at `from` **and** a high-visibility tracer. This is the core fix.
- `enemyTelegraph`: recolour to a red "warning" flash so the tell reads differently from the shot.

No data-model or event-shape changes. Purely presentation in `ParticleSystem` + `App.tsx`. All new params are optional → existing callers unaffected.

---

## Feature 2 — Jump onto objects (2.5D collision)

### Current behaviour
- `Player.update` applies gravity and lands only when `position.y <= EYE_HEIGHT` (the floor). It cannot stand on anything raised.
- `CollisionWorld.resolve(pos, radius)` pushes the player out of a box **horizontally regardless of height** — so even if you jump above a crate, descending over it shoves you off. Standing on cover is impossible.

### Change — height-aware collision
Treat the player as a vertical capsule whose feet are at `feetY = position.y - EYE_HEIGHT`.

- `CollisionWorld.resolve(pos, radius, feetY?)`:
  - When `feetY` is given, **skip horizontal push-out for any box whose top is at or below `feetY + STEP_TOLERANCE`** (the player is standing on / above it) and for any box entirely above the player's head. Otherwise behave as today.
  - When `feetY` is omitted, behaviour is unchanged (enemies and existing tests keep working).
- `CollisionWorld.supportHeight(pos, radius, feetY)`: returns the highest box top the player is standing over (XZ footprint within `radius`) that is at or below `feetY + STEP_TOLERANCE`. Returns `0` (floor) when nothing supports them. This is the surface the player rests on.
- `Player.update(dt, input, arenaSize, world?)`: gains an optional `world`.
  - Horizontal move → height-aware `world.resolve` → gravity → land on `supportHeight + EYE_HEIGHT` instead of always `EYE_HEIGHT`. `isGrounded` reflects resting on any surface (so you can jump again from on top of a wall).
  - Without `world` (e.g. NetClient prediction, existing tests) the floor stays at `EYE_HEIGHT` — unchanged.
- `GameSession` passes its `collisionWorld` into `player.update` and drops the now-redundant external `resolve` call.

`STEP_TOLERANCE ≈ 0.35`: you auto-step tiny ledges but must jump for the ~1.2-high sandbag walls and crates. Tall walls (top far above the feet) are excluded from support, so you never teleport up them — the horizontal block still stops you.

### Why this approach
A full physics engine is overkill (YAGNI). The map is axis-aligned static boxes, so a per-box "is the player's capsule above this top?" test gives believable jump-on-cover with a few lines and no new dependencies.

---

## Testing
- `CollisionWorld`: existing 2-arg `resolve` tests stay green; add tests for `supportHeight` (over a box → top; off to the side → 0; box too high above feet → 0) and height-aware `resolve` (feet above box top → not pushed; feet at body height → pushed).
- `Player`: add tests for landing on a box top via `supportHeight`, being grounded there, and jumping again from on top.
- Visual changes (muzzle flash / tracer styling) are verified by build + existing tests; no unit assertions on colours.

## Out of scope
- Moving/dynamic platforms, slopes, mantling animations, ducking.
- Networked reconciliation of vertical position (prediction stays flat, as today).
