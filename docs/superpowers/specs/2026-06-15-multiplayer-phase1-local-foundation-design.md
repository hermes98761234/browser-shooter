# Multiplayer — Phase 1: Local Foundation (Design Spec)

**Date:** 2026-06-15
**Status:** Approved for planning
**Scope:** Phase 1 of a 4-phase effort to add Counter-Strike-style multiplayer to the browser shooter.

---

## 1. Background & overall vision

The project is a React 19 + Three.js (r170) + Vite single-player, first-person, wave-survival shooter. It has **zero networking** today; the game loop, hit detection, enemy AI, and damage are all inlined in `src/App.tsx`.

The goal is to add a multiplayer mode alongside the existing bot mode, modeled on Counter-Strike:

- **WebRTC multiplayer** via [PlayPeerJS](https://github.com/therealPaulPlay/PlayPeerJS) / PeerJS, **host-authoritative** (one peer holds authoritative state; others are clients). Signaling uses the public PeerJS cloud; a small lobby registry advertises public rooms, and private games join via room code. Lobby size 2–6.
- **Two multiplayer modes:** round-based **PvP** (teams Terrorists vs Counter-Terrorists, money economy, buy phase) and **co-op** vs the existing bot waves.
- **See each other:** third-person character models for remote players.
- **Head / body / legs hitboxes** with damage multipliers, applied to **both players and bots**.
- **B** opens a weapon buy store; **Tab** switches weapons.
- **Start menu** lets the player choose **Bot** (existing single-player) or **Multiplayer**.

### Chosen architecture (Approach A): unified host-authoritative session

All simulation (player movement, bots, shooting, damage, economy, rounds) lives in a transport-agnostic **`GameSession`** that is *always* host-authoritative. Single-player/bot mode is that same session running over a **loopback transport** (a host with zero remote peers). Multiplayer is the same session on the host over a **PlayPeerJS transport**, while joining clients run a thin predict-and-render layer. One simulation runs everywhere — this removes single-player/multiplayer divergence, gives anti-cheat for free (the host runs all damage and economy), and lets hitboxes/economy/rounds be written once.

### Phase decomposition (each phase = its own spec → plan → build)

1. **Phase 1 — Local foundation (this document):** `GameSession` refactor + loopback transport, head/body/legs hitbox zones (players + bots), shared third-person character model, Tab weapon switch, B buy-store UI shell with a local money stub. Fully testable in single-player.
2. **Phase 2 — Networking core:** PlayPeerJS `NetworkManager`/transport, lobby (public list + room codes), start-menu Bot-vs-Multiplayer flow, remote-player replication with interpolation + local prediction, host-authoritative hit validation. Deliverable: a basic shoot-each-other deathmatch.
3. **Phase 3 — PvP rounds + economy + teams:** T/CT assignment, buy phase, money from kills/round wins, round win/loss logic, spectate-on-death; wires the store to a real economy.
4. **Phase 4 — Co-op vs bots:** host-authoritative networked bot spawning/AI and shared waves.

Phases 2–4 are out of scope for this document and will get their own specs. This spec details **Phase 1 only**.

---

## 2. Phase 1 goals & non-goals

### Goals
- Extract the simulation out of `App.tsx` into a testable, transport-agnostic `GameSession` with a loopback transport, preserving existing single-player behavior.
- Define the wire-protocol types (`PlayerInput`, `EntityState`, `Snapshot`, `HitEvent`) now, so Phase 2 can add a `PeerTransport` without touching the simulation.
- Add a head/body/legs hitbox + damage-multiplier system applied to bots now (and ready for players).
- Build a shared, zoned third-person `CharacterModel` used by bots immediately and by remote players in Phase 2.
- Add Tab weapon cycling and a B buy-store overlay backed by a local money stub.

### Non-goals (deferred to later phases)
- No networking, signaling, lobby, or remote players (Phase 2).
- No money earning, rounds, buy-phase gating, teams, or PvP damage (Phase 3).
- No networked/co-op bots (Phase 4).
- No scoreboard UI yet (Phase 3; will use a key other than Tab).

---

## 3. Components & file layout

New / changed modules:

| Path | Purpose |
|------|---------|
| `src/session/GameSession.ts` | **New.** Authoritative simulation: holds state, `applyInput`, `step(dt)`, `getSnapshot`, emits hit/kill/death events. |
| `src/session/protocol.ts` | **New.** Wire-protocol types: `PlayerInput`, `EntityState`, `Snapshot`, `HitEvent`, message envelopes. |
| `src/session/Transport.ts` | **New.** `Transport` interface + `LoopbackTransport` (local, instant delivery). |
| `src/entities/CharacterModel.ts` | **New.** Shared blocky-humanoid `THREE.Group` with zone-tagged child meshes, tint, optional name-tag sprite. |
| `src/systems/DamageZones.ts` | **New.** Zone multipliers and zone-resolution helper. |
| `src/ui/BuyMenu.tsx` | **New.** B-key buy-store overlay (weapons + prices + money). |
| `src/enemies/EnemyModel.ts` | **Changed.** Build bots from/around `CharacterModel` with head/torso/legs zones. |
| `src/weapons/WeaponManager.ts` | **Changed.** Add `cycleNext()` for Tab switching. |
| `src/player/Controls.ts` | **Changed.** Handle `Tab` (preventDefault + cycle) and `B` (toggle store). |
| `src/App.tsx` | **Changed.** Shrinks to: gather input → `applyInput` → `step` → render snapshot → drive HUD; wires BuyMenu. |
| `src/types.ts` | **Changed.** Re-export / extend shared types as needed. |

---

## 4. Detailed design

### 4.1 `GameSession` + transport boundary

`GameSession` owns authoritative state and advances it deterministically:

- `applyInput(playerId: string, input: PlayerInput): void` — queue a player's intent for the next step (movement axes, look, fire, reload, weapon-switch, buy request).
- `step(dt: number): void` — advance the world: apply queued inputs → player movement + collision resolve → bot AI update → resolve shots into damage (with hitbox zones) → pickups → death/spawn handling. `dt` is clamped to a max (preserve current 0.1s clamp).
- `getSnapshot(): Snapshot` — a serializable description of all entities for the renderer.
- Events: `onHit(HitEvent)`, `onKill(...)`, `onDeath(...)` via a small emitter/callback set, consumed by effects/audio/score.

`Transport` interface:

```ts
interface Transport {
  send(msg: NetMessage): void;
  onMessage(cb: (msg: NetMessage) => void): void;
}
```

`LoopbackTransport` delivers messages synchronously to the same process. Phase 1 ships only this transport; the host and the sole player are the same client. The renderer (`GameEngine`, `HUD`, `Minimap`) reads exclusively from `getSnapshot()` and session events — never from internal simulation fields — so Phase 2 can route the same snapshots over the network.

**Refactor discipline:** the extraction must preserve current single-player behavior (movement feel, enemy waves, shooting, pickups, score). This is the largest change in Phase 1 and should be done in small, test-backed steps.

### 4.2 Hitbox zones + shared `CharacterModel`

`CharacterModel` builds a humanoid `THREE.Group` whose child meshes carry `userData.zone`:

- `head` — top segment
- `body` — torso (default / fallback zone)
- `legs` — lower segment

It also accepts a tint color (used as a team color in Phase 3) and an optional name-tag sprite (used for remote players in Phase 2).

`src/systems/DamageZones.ts` is the single source of truth for multipliers:

```ts
export const ZONE_MULTIPLIERS = { head: 4.0, body: 1.0, legs: 0.75 } as const;
export function resolveZone(object: THREE.Object3D): keyof typeof ZONE_MULTIPLIERS {
  // walk up parents to find userData.zone; default 'body'
}
```

Hit resolution (moved out of `App.tsx`'s `checkHit` into the session): raycast as today to find the nearest entity intersection, take `intersects[0].object`, resolve its zone, and compute `damage = weaponDamage × ZONE_MULTIPLIERS[zone]`. Untagged geometry falls back to `body` (1×). The shotgun's 6 rays each resolve their own zone independently. Wall-occlusion check (`CollisionWorld.segmentBlocked`) is unchanged.

**Bots adopt zoned models now** by refactoring `EnemyModel.ts`, so head/body/legs damage is fully exercised in single-player. Non-humanoid enemy types still designate a top segment as `head` so the multiplier always has a sensible target. The player-facing variant of `CharacterModel` (name tag, third-person rendering) is built but only activated for remote players in Phase 2; locally it can be validated with an optional stationary "dummy" target.

### 4.3 Tab weapon switch

`WeaponManager.cycleNext()` advances to the next owned weapon (wrapping). Existing `1/2/3` direct-select keys remain. In `Controls.ts` / the key handler, `Tab` calls `preventDefault()` (otherwise the browser moves focus off the canvas) and triggers `cycleNext()`. The conventional Tab-scoreboard is deferred to Phase 3 and will bind to a different key.

### 4.4 B buy-store shell

`BuyMenu.tsx` is a React overlay toggled by `B`:

- Opening it unlocks the pointer (same handling as the pause menu) and pauses fire input; closing re-locks.
- Lists the existing weapons (pistol, shotgun, rifle) with prices and shows current money.
- In Phase 1, money is a **local stub** (a fixed budget, buyable any time). Selecting a weapon "buys" it into the `WeaponManager` loadout (and grants its ammo).
- Built to later accept Phase 3 rules: round-gated buy phase, real money balance, and team-restricted catalogs.

---

## 5. Data flow

```
keyboard/mouse → Controls → PlayerInput
   → GameSession.applyInput(localPlayerId, input)
   → GameSession.step(dt)            (authoritative: movement, bots, hits w/ zones, pickups)
   → GameSession.getSnapshot()
   → GameEngine renders snapshot; HUD/Minimap read snapshot
   → session events (onHit/onKill/onDeath) → effects + audio + score
B key → BuyMenu overlay → buy request → GameSession (local money stub) → WeaponManager loadout
Tab   → WeaponManager.cycleNext()
```

In Phase 2 the only change is that on a client, `applyInput` sends over a `PeerTransport` and snapshots arrive from the host instead of being produced locally.

---

## 6. Error handling & edge cases

- **Tab focus:** always `preventDefault()` on Tab to keep focus on the canvas.
- **Zone fallback:** untagged/unknown geometry resolves to `body` (1×) so damage is never `NaN`/undefined.
- **Buy menu state:** opening while paused or dead is a no-op (or disabled); fire input is suppressed while open; pointer lock restored on close.
- **dt clamp:** preserve the existing max-dt clamp inside `step` to avoid tunneling on tab-out.
- **Non-humanoid bots:** ensure every bot model exposes a `head` zone segment.

---

## 7. Testing strategy

**Vitest (unit):**
- `resolveZone` returns correct zone for tagged meshes and `body` for untagged.
- Damage = weaponDamage × multiplier for head/body/legs (incl. shotgun multi-ray).
- `GameSession.step` is deterministic for fixed inputs (same inputs → same snapshot).
- `WeaponManager.cycleNext` order and wrap-around.
- Buy-store: buying within budget swaps the loadout; over-budget is rejected (stub rules).

**Playwright (E2E):**
- Headshot on a bot deals more damage than a body shot.
- Tab cycles the active weapon (HUD reflects change) without losing canvas focus.
- B opens and closes the store; buying a weapon makes it active.

**Regression:** existing single-player tests continue to pass — the session refactor must not change observable single-player behavior.

---

## 8. Definition of done (Phase 1)

- Simulation runs through `GameSession` + `LoopbackTransport`; `App.tsx` no longer inlines the loop; existing single-player plays identically.
- Protocol types exist and are used at the session boundary.
- Bots have head/body/legs zones; shooting different zones yields different damage via `DamageZones`.
- `CharacterModel` exists and is used by bots; player variant ready for Phase 2.
- Tab cycles weapons (focus preserved); B opens a working buy-store shell with a money stub.
- All new unit tests and E2E tests pass; existing tests green.
