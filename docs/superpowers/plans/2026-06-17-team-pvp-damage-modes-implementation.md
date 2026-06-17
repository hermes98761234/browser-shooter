# Team Selection + PvP Damage Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make team selection a real gameplay mechanic and add host-configurable player-vs-player combat (3 game modes × 3 damage policies) with respawns and team scoring.

**Architecture:** A match-rules layer owned by `GameSession`. Pure, unit-testable modules (`MatchConfig`, `Scoreboard`, `RespawnQueue`, `Spawns`, `PlayerHit`) carry the logic; `GameSession.resolveShot` is extended to hit players via an analytic capsule raycast and apply a pure `canDamage()` rule; the host stays authoritative and ships config + scores in the snapshot. UI is a pure projection of host state.

**Tech Stack:** TypeScript, React 19, Three.js r170, PeerJS (WebRTC), Vitest (unit/integration), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-06-17-team-pvp-damage-modes-design.md`

**Conventions:**
- Unit tests live next to source as `*.test.ts`.
- Type-check with `npx tsc --noEmit`. Run a test file with `npx vitest run <path>`. Run one test with `npx vitest run <path> -t "<name>"`.
- Commit after each task (the final step of each task).

---

## File Structure

**New files:**
- `src/session/MatchConfig.ts` — `MatchConfig`/`DamagePolicy` types, `defaultMatchConfig()`, pure `canDamage()`.
- `src/session/Scoreboard.ts` — per-player K/D + per-team score, frag-limit win detection.
- `src/session/RespawnQueue.ts` — respawn timer bookkeeping.
- `src/session/Spawns.ts` — per-team spawn points + `pickSpawn()`.
- `src/session/PlayerHit.ts` — analytic ray-vs-capsule player hit test (the M2 lag-comp seam).
- `src/ui/MatchSetup.tsx` — host's pre-host mode/policy/frag-limit picker.
- `src/ui/KillFeed.tsx` — transient kill messages.
- `src/ui/RespawnOverlay.tsx` — "respawning in N…" for the local dead player.
- `src/ui/MatchOver.tsx` — win screen.
- Test files alongside each new logic module.

**Modified files:**
- `src/session/protocol.ts` — `GameMode` += `'hybrid'`; `EntityState.team`/`respawnIn`; `Snapshot.scores`; `MatchScores`/`PlayerScore` types; `welcome` carries `config`; `join` carries `team`; new `setTeam` and `start` messages; new PvP `SessionEvent`s.
- `src/systems/HealthSystem.ts` — `revive()`.
- `src/player/Player.ts` — `revive()` delegate.
- `src/session/GameSession.ts` — hold config/scoreboard/respawn queue; `PlayerEntity.team`; team-aware `addPlayer`; respawn processing in `step`; PvP-aware death handling; rewritten `resolveShot` + `resolvePlayerHit`; snapshot carries team/respawnIn/scores.
- `src/net/NetHost.ts` — `MatchConfig` instead of bare mode; team on `addClient`; `setTeam`/`start` handling; pvp wave guard; welcome carries config.
- `src/net/NetClient.ts` — store `config`; expose start callback; welcome stores config.
- `src/ui/Scoreboard.tsx` — show K/D + per-team score using `MatchScores`.
- `src/ui/TeamSelect.tsx` — accept a current selection + roster counts (reused in the MP lobby).
- `src/ui/MultiplayerMenu.tsx` — lobby team pick + rosters.
- `src/net/RemotePlayer.ts` / `CharacterModel.ts` — tint by team.
- `src/App.tsx` — match-config plumbing, lobby team flow, synchronized start, PvP death/respawn/kill-feed/win-screen wiring.
- `src/types.ts` — `GameState` += `'matchover'`.

---

# Phase 1 — Pure logic modules

## Task 1: MatchConfig + canDamage

**Files:**
- Create: `src/session/MatchConfig.ts`
- Test: `src/session/MatchConfig.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/session/MatchConfig.test.ts
import { describe, it, expect } from 'vitest'
import { canDamage, defaultMatchConfig } from './MatchConfig'

describe('canDamage', () => {
  it('team policy: only opposite teams', () => {
    expect(canDamage('ct', 't', 'team')).toBe(true)
    expect(canDamage('ct', 'ct', 'team')).toBe(false)
  })
  it('friendly policy: anyone', () => {
    expect(canDamage('ct', 'ct', 'friendly')).toBe(true)
    expect(canDamage('ct', 't', 'friendly')).toBe(true)
  })
  it('ffa policy: anyone', () => {
    expect(canDamage('t', 't', 'ffa')).toBe(true)
    expect(canDamage('t', 'ct', 'ffa')).toBe(true)
  })
})

describe('defaultMatchConfig', () => {
  it('defaults to coop / team / 30', () => {
    expect(defaultMatchConfig()).toEqual({ mode: 'coop', damagePolicy: 'team', fragLimit: 30 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/MatchConfig.test.ts`
Expected: FAIL — cannot find module `./MatchConfig`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/session/MatchConfig.ts
import type { Team } from '../types'
import type { GameMode } from './protocol'

export type DamagePolicy = 'team' | 'friendly' | 'ffa'

export interface MatchConfig {
  mode: GameMode
  damagePolicy: DamagePolicy
  fragLimit: number // team score to win; 0 = endless
}

export function defaultMatchConfig(): MatchConfig {
  return { mode: 'coop', damagePolicy: 'team', fragLimit: 30 }
}

/** Can `attacker`'s team damage `target`'s team under `policy`? Pure. */
export function canDamage(attacker: Team, target: Team, policy: DamagePolicy): boolean {
  if (policy === 'ffa') return true
  if (policy === 'friendly') return true
  return attacker !== target // 'team': opposite only
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/MatchConfig.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/session/MatchConfig.ts src/session/MatchConfig.test.ts
git commit -m "feat(pvp): add MatchConfig + canDamage rule"
```

---

## Task 2: Scoreboard

**Files:**
- Create: `src/session/Scoreboard.ts`
- Test: `src/session/Scoreboard.test.ts`
- Depends on `MatchScores`/`PlayerScore` types — defined in Task 6 (protocol). To keep this task self-contained, define the return shape locally and re-export from protocol in Task 6. Use the inline interfaces below.

- [ ] **Step 1: Write the failing test**

```ts
// src/session/Scoreboard.test.ts
import { describe, it, expect } from 'vitest'
import { Scoreboard } from './Scoreboard'

describe('Scoreboard', () => {
  it('enemy-team kill credits attacker and team', () => {
    const s = new Scoreboard(0)
    s.recordKill('a', 'ct', 'b', 't', 'team')
    const snap = s.snapshot()
    expect(snap.players.a.kills).toBe(1)
    expect(snap.players.b.deaths).toBe(1)
    expect(snap.teams.ct).toBe(1)
  })

  it('teamkill under friendly penalizes attacker, no team score', () => {
    const s = new Scoreboard(0)
    s.recordKill('a', 'ct', 'b', 'ct', 'friendly')
    const snap = s.snapshot()
    expect(snap.players.a.kills).toBe(-1)
    expect(snap.players.b.deaths).toBe(1)
    expect(snap.teams.ct).toBe(0)
  })

  it('ffa same-team kill scores normally', () => {
    const s = new Scoreboard(0)
    s.recordKill('a', 't', 'b', 't', 'ffa')
    expect(s.snapshot().teams.t).toBe(1)
  })

  it('suicide records a death but no kill credit', () => {
    const s = new Scoreboard(0)
    s.recordKill('a', 'ct', 'a', 'ct', 'team')
    const snap = s.snapshot()
    expect(snap.players.a.deaths).toBe(1)
    expect(snap.players.a.kills ?? 0).toBe(0)
  })

  it('recordDeath increments deaths with no killer', () => {
    const s = new Scoreboard(0)
    s.recordDeath('b')
    expect(s.snapshot().players.b.deaths).toBe(1)
  })

  it('reaching frag limit sets matchOver + winningTeam', () => {
    const s = new Scoreboard(2)
    s.recordKill('a', 'ct', 'b', 't', 'team')
    expect(s.snapshot().matchOver).toBe(false)
    s.recordKill('a', 'ct', 'b', 't', 'team')
    const snap = s.snapshot()
    expect(snap.matchOver).toBe(true)
    expect(snap.winningTeam).toBe('ct')
  })

  it('ignores kills after matchOver', () => {
    const s = new Scoreboard(1)
    s.recordKill('a', 'ct', 'b', 't', 'team')
    s.recordKill('x', 't', 'y', 'ct', 'team')
    expect(s.snapshot().teams.t).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/Scoreboard.test.ts`
Expected: FAIL — cannot find module `./Scoreboard`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/session/Scoreboard.ts
import type { Team } from '../types'
import type { DamagePolicy } from './MatchConfig'

export interface PlayerScore { kills: number; deaths: number }
export interface MatchScores {
  teams: { ct: number; t: number }
  players: Record<string, PlayerScore>
  matchOver: boolean
  winningTeam: Team | null
}

export class Scoreboard {
  private teams = { ct: 0, t: 0 }
  private players = new Map<string, PlayerScore>()
  matchOver = false
  winningTeam: Team | null = null

  constructor(private fragLimit = 0) {}

  private ensure(id: string): PlayerScore {
    let s = this.players.get(id)
    if (!s) { s = { kills: 0, deaths: 0 }; this.players.set(id, s) }
    return s
  }

  recordKill(attackerId: string, attackerTeam: Team, victimId: string, victimTeam: Team, policy: DamagePolicy): void {
    if (this.matchOver) return
    this.ensure(victimId).deaths++
    if (attackerId === victimId) return // suicide: no credit
    const attacker = this.ensure(attackerId)
    const sameTeam = attackerTeam === victimTeam
    if (policy === 'friendly' && sameTeam) {
      attacker.kills-- // teamkill penalty, no team score
    } else {
      attacker.kills++
      this.teams[attackerTeam]++
    }
    if (this.fragLimit > 0 && this.teams[attackerTeam] >= this.fragLimit) {
      this.matchOver = true
      this.winningTeam = attackerTeam
    }
  }

  recordDeath(victimId: string): void {
    if (this.matchOver) return
    this.ensure(victimId).deaths++
  }

  snapshot(): MatchScores {
    return {
      teams: { ...this.teams },
      players: Object.fromEntries([...this.players].map(([id, s]) => [id, { ...s }])),
      matchOver: this.matchOver,
      winningTeam: this.winningTeam,
    }
  }

  reset(): void {
    this.teams = { ct: 0, t: 0 }
    this.players.clear()
    this.matchOver = false
    this.winningTeam = null
  }
}
```

Note: `MatchScores`/`PlayerScore` are defined here and re-exported from `protocol.ts` in Task 6 so the snapshot type can reference them without a runtime import cycle.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/Scoreboard.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/session/Scoreboard.ts src/session/Scoreboard.test.ts
git commit -m "feat(pvp): add Scoreboard with team scoring + win detection"
```

---

## Task 3: RespawnQueue

**Files:**
- Create: `src/session/RespawnQueue.ts`
- Test: `src/session/RespawnQueue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/session/RespawnQueue.test.ts
import { describe, it, expect } from 'vitest'
import { RespawnQueue } from './RespawnQueue'

describe('RespawnQueue', () => {
  it('emits an id once its timer elapses', () => {
    const q = new RespawnQueue()
    q.enqueue('p', 1)
    expect(q.update(0.5)).toEqual([])
    expect(q.isPending('p')).toBe(true)
    expect(q.update(0.6)).toEqual(['p'])
    expect(q.isPending('p')).toBe(false)
  })

  it('reports remaining time', () => {
    const q = new RespawnQueue()
    q.enqueue('p', 3)
    q.update(1)
    expect(q.remaining('p')).toBeCloseTo(2)
  })

  it('remove() drops a pending entry', () => {
    const q = new RespawnQueue()
    q.enqueue('p', 3)
    q.remove('p')
    expect(q.isPending('p')).toBe(false)
    expect(q.update(5)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/RespawnQueue.test.ts`
Expected: FAIL — cannot find module `./RespawnQueue`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/session/RespawnQueue.ts
export class RespawnQueue {
  private timers = new Map<string, number>()

  enqueue(playerId: string, delay: number): void { this.timers.set(playerId, delay) }
  isPending(playerId: string): boolean { return this.timers.has(playerId) }
  remaining(playerId: string): number { return this.timers.get(playerId) ?? 0 }
  remove(playerId: string): void { this.timers.delete(playerId) }

  /** Decrement timers; return ids whose timer reached zero (and remove them). */
  update(dt: number): string[] {
    const ready: string[] = []
    for (const [id, t] of this.timers) {
      const next = t - dt
      if (next <= 0) { ready.push(id); this.timers.delete(id) }
      else this.timers.set(id, next)
    }
    return ready
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/RespawnQueue.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/session/RespawnQueue.ts src/session/RespawnQueue.test.ts
git commit -m "feat(pvp): add RespawnQueue timer bookkeeping"
```

---

## Task 4: Spawns

**Files:**
- Create: `src/session/Spawns.ts`
- Test: `src/session/Spawns.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/session/Spawns.test.ts
import { describe, it, expect } from 'vitest'
import { pickSpawn } from './Spawns'

describe('pickSpawn', () => {
  it('returns distinct spawn regions per team at eye height', () => {
    const ct = pickSpawn('ct', 0)
    const t = pickSpawn('t', 0)
    expect(ct.y).toBe(2)
    expect(t.y).toBe(2)
    // teams spawn on opposite sides
    expect(Math.sign(ct.x)).not.toBe(Math.sign(t.x))
  })

  it('cycles through a team\'s spawn list by index', () => {
    const a = pickSpawn('ct', 0)
    const b = pickSpawn('ct', 1)
    expect(a.equals(b)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/Spawns.test.ts`
Expected: FAIL — cannot find module `./Spawns`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/session/Spawns.ts
import * as THREE from 'three'
import type { Team } from '../types'

const EYE = 2 // matches Player EYE_HEIGHT
const CT_SPAWNS: [number, number][] = [[-20, -20], [-24, -16], [-16, -24], [-20, -12]]
const T_SPAWNS: [number, number][] = [[20, 20], [24, 16], [16, 24], [20, 12]]

/** A spawn position for `team`. Falls back to a small random offset if no points are defined. */
export function pickSpawn(team: Team, index = 0): THREE.Vector3 {
  const list = team === 'ct' ? CT_SPAWNS : T_SPAWNS
  if (list.length === 0) {
    return new THREE.Vector3((Math.random() - 0.5) * 10, EYE, (Math.random() - 0.5) * 10)
  }
  const [x, z] = list[index % list.length]
  return new THREE.Vector3(x, EYE, z)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/Spawns.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/session/Spawns.ts src/session/Spawns.test.ts
git commit -m "feat(pvp): add per-team spawn points"
```

---

## Task 5: PlayerHit (ray-vs-capsule)

**Files:**
- Create: `src/session/PlayerHit.ts`
- Test: `src/session/PlayerHit.test.ts`

The session has no 3D mesh for players (only `Player.position`), so PvP hits use an analytic ray-vs-vertical-capsule test. Zone comes from the hit height. This is the M2 lag-compensation seam.

- [ ] **Step 1: Write the failing test**

```ts
// src/session/PlayerHit.test.ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { raycastPlayerCapsule, zoneForHeight } from './PlayerHit'

describe('zoneForHeight', () => {
  it('maps height to zone', () => {
    expect(zoneForHeight(1.9)).toBe('head')
    expect(zoneForHeight(1.2)).toBe('body')
    expect(zoneForHeight(0.4)).toBe('legs')
  })
})

describe('raycastPlayerCapsule', () => {
  const eye = new THREE.Vector3(0, 2, -10) // target standing at x0,z-10

  it('hits a target dead ahead and reports body zone', () => {
    const origin = new THREE.Vector3(0, 1.2, 0)
    const dir = new THREE.Vector3(0, 0, -1)
    const hit = raycastPlayerCapsule(origin, dir, 50, eye)
    expect(hit).not.toBeNull()
    expect(hit!.zone).toBe('body')
    expect(hit!.distance).toBeGreaterThan(9)
    expect(hit!.distance).toBeLessThan(11)
  })

  it('misses when aimed wide', () => {
    const origin = new THREE.Vector3(0, 1.2, 0)
    const dir = new THREE.Vector3(1, 0, 0) // perpendicular, away from target
    expect(raycastPlayerCapsule(origin, dir, 50, eye)).toBeNull()
  })

  it('misses when the target is beyond range', () => {
    const origin = new THREE.Vector3(0, 1.2, 0)
    const dir = new THREE.Vector3(0, 0, -1)
    expect(raycastPlayerCapsule(origin, dir, 5, eye)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/PlayerHit.test.ts`
Expected: FAIL — cannot find module `./PlayerHit`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/session/PlayerHit.ts
import * as THREE from 'three'
import type { Vec3 } from '../types'
import type { HitZone } from '../systems/DamageZones'

export const PLAYER_RADIUS = 0.5
export const PLAYER_HEIGHT = 2.2 // feet (y=0) to head top
const FEET_Y = 0

export interface CapsuleHit { distance: number; point: Vec3; zone: HitZone }

export function zoneForHeight(y: number): HitZone {
  if (y >= 1.6) return 'head'
  if (y <= 0.9) return 'legs'
  return 'body'
}

/**
 * Ray (origin + dir*t, t in [0, range]) vs a vertical capsule at the target's
 * column. `playerEye` is the target's eye position; feet are assumed at y=0.
 */
export function raycastPlayerCapsule(
  origin: THREE.Vector3, dir: THREE.Vector3, range: number, playerEye: THREE.Vector3,
): CapsuleHit | null {
  const a0 = origin.clone()
  const a1 = origin.clone().addScaledVector(dir, range)
  const b0 = new THREE.Vector3(playerEye.x, FEET_Y, playerEye.z)
  const b1 = new THREE.Vector3(playerEye.x, FEET_Y + PLAYER_HEIGHT, playerEye.z)
  const { pA, pB, distSq } = closestPtSegmentSegment(a0, a1, b0, b1)
  if (distSq > PLAYER_RADIUS * PLAYER_RADIUS) return null
  return {
    distance: origin.distanceTo(pA),
    point: { x: pA.x, y: pA.y, z: pA.z },
    zone: zoneForHeight(pB.y),
  }
}

/** Closest points between segments p1->q1 and p2->q2 (Ericson, RTCD §5.1.9). */
function closestPtSegmentSegment(
  p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3,
): { pA: THREE.Vector3; pB: THREE.Vector3; distSq: number } {
  const d1 = q1.clone().sub(p1)
  const d2 = q2.clone().sub(p2)
  const r = p1.clone().sub(p2)
  const a = d1.dot(d1)
  const e = d2.dot(d2)
  const f = d2.dot(r)
  const EPS = 1e-9
  let s = 0, t = 0
  if (a <= EPS && e <= EPS) {
    // both segments are points
  } else if (a <= EPS) {
    t = clamp01(f / e)
  } else {
    const c = d1.dot(r)
    if (e <= EPS) {
      s = clamp01(-c / a)
    } else {
      const b = d1.dot(d2)
      const denom = a * e - b * b
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0
      t = (b * s + f) / e
      if (t < 0) { t = 0; s = clamp01(-c / a) }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a) }
    }
  }
  const pA = p1.clone().addScaledVector(d1, s)
  const pB = p2.clone().addScaledVector(d2, t)
  return { pA, pB, distSq: pA.distanceToSquared(pB) }
}

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/PlayerHit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/session/PlayerHit.ts src/session/PlayerHit.test.ts
git commit -m "feat(pvp): add analytic ray-vs-capsule player hit test"
```

---

# Phase 2 — Protocol + GameSession integration

## Task 6: Protocol changes

**Files:**
- Modify: `src/session/protocol.ts`

- [ ] **Step 1: Extend GameMode + re-export score types**

Replace the top of `src/session/protocol.ts` (lines 1–5) with:

```ts
import type { Vec3, Team } from '../types'
import type { HitZone } from '../systems/DamageZones'
import type { MatchConfig } from './MatchConfig'
import type { MatchScores } from './Scoreboard'

export type GameMode = 'coop' | 'pvp' | 'hybrid'
export const GAME_MODES: readonly GameMode[] = ['coop', 'pvp', 'hybrid'] as const

export type { MatchScores, PlayerScore } from './Scoreboard'
```

- [ ] **Step 2: Add team + respawnIn to EntityState**

In `EntityState` (after the `name?` line) add:

```ts
  team?: Team          // players only
  respawnIn?: number   // players only; seconds until respawn (omitted if alive)
```

- [ ] **Step 3: Add scores to Snapshot**

Change the `Snapshot` interface to add a `scores` field:

```ts
export interface Snapshot {
  tick: number
  seq: number
  ack: Record<string, number>
  players: EntityState[]
  enemies: EntityState[]
  events: SessionEvent[]
  scores: MatchScores
}
```

- [ ] **Step 4: Add the new PvP session events**

Append these members to the `SessionEvent` union (after `playerDied`):

```ts
  | { type: 'playerHitPlayer'; hit: HitEvent; victimId: string }
  | { type: 'playerKilledPlayer'; attackerId: string; victimId: string; victimTeam: Team; teamkill: boolean }
  | { type: 'playerRespawned'; playerId: string }
  | { type: 'matchOver'; winningTeam: Team }
```

- [ ] **Step 5: Extend net messages (welcome/join + setTeam/start)**

In the `NetMessage` union, change the `join` and `welcome` lines and add two messages:

```ts
  | { type: 'join'; name: string; team?: Team }
  | { type: 'welcome'; playerId: string; mode: GameMode; config: MatchConfig }
  | { type: 'setTeam'; playerId: string; team: Team }
  | { type: 'start' }
```

(Keep all other existing message variants unchanged.)

- [ ] **Step 6: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `GameSession.ts`, `NetHost.ts`, `NetClient.ts`, `App.tsx` about the missing `scores`/`config` fields and the changed constructor — these are fixed in later tasks. No errors inside `protocol.ts` itself.

- [ ] **Step 7: Commit**

```bash
git add src/session/protocol.ts
git commit -m "feat(pvp): extend protocol with team, scores, config, PvP events"
```

---

## Task 7: HealthSystem.revive + Player.revive

**Files:**
- Modify: `src/systems/HealthSystem.ts`, `src/player/Player.ts`
- Test: `src/systems/HealthSystem.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/HealthSystem.test.ts
import { describe, it, expect } from 'vitest'
import { HealthSystem } from './HealthSystem'

describe('HealthSystem.revive', () => {
  it('restores full health, clears death, grants brief i-frames', () => {
    const h = new HealthSystem(100)
    h.takeDamage(100)
    expect(h.isDead).toBe(true)
    h.revive()
    expect(h.isDead).toBe(false)
    expect(h.health).toBe(100)
    expect(h.armor).toBe(0)
    expect(h.invincibleTimer).toBeGreaterThan(0)
  })

  it('keeps a raised maxHealth on revive', () => {
    const h = new HealthSystem(100)
    h.addMaxHealth(50) // now 150
    h.takeDamage(150)
    h.revive()
    expect(h.health).toBe(150)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/HealthSystem.test.ts`
Expected: FAIL — `revive` is not a function.

- [ ] **Step 3: Implement revive in HealthSystem**

Add to `HealthSystem` (after `reset()`):

```ts
  /** Respawn: full health, clear death, brief spawn protection. Keeps maxHealth. */
  revive() {
    this.health = this.maxHealth
    this.armor = 0
    this.isDead = false
    this.invincibleTimer = 1
  }
```

- [ ] **Step 4: Delegate from Player**

Add to `src/player/Player.ts` (after `resetHealth()`):

```ts
  revive() {
    this.healthSystem.revive()
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/systems/HealthSystem.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/systems/HealthSystem.ts src/systems/HealthSystem.test.ts src/player/Player.ts
git commit -m "feat(pvp): add revive() for respawns"
```

---

## Task 8: GameSession — team, config, snapshot fields

**Files:**
- Modify: `src/session/GameSession.ts`
- Test: `src/session/GameSession.pvp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/session/GameSession.pvp.test.ts
import { describe, it, expect } from 'vitest'
import { GameSession } from './GameSession'

describe('GameSession team + scores in snapshot', () => {
  it('defaults to coop config and tags the local player with a team', () => {
    const s = new GameSession()
    const snap = s.getSnapshot()
    expect(snap.players[0].team).toBe('ct')
    expect(snap.scores).toEqual({ teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null })
  })

  it('addPlayer stores the chosen team', () => {
    const s = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    s.addPlayer('p2', 'Bob', 't')
    const snap = s.getSnapshot()
    expect(snap.players.find(p => p.id === 'p2')!.team).toBe('t')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/GameSession.pvp.test.ts`
Expected: FAIL — `team` undefined / constructor signature mismatch.

- [ ] **Step 3: Add imports**

At the top of `src/session/GameSession.ts`, after the existing imports add:

```ts
import type { Team } from '../types'
import { type MatchConfig, defaultMatchConfig, canDamage } from './MatchConfig'
import type { DamagePolicy } from './MatchConfig'
import { Scoreboard } from './Scoreboard'
import { RespawnQueue } from './RespawnQueue'
import { pickSpawn } from './Spawns'
import { raycastPlayerCapsule } from './PlayerHit'
import type { HitZone } from '../systems/DamageZones'
```

(`Vec3` is already imported on line 10. Keep it.)

- [ ] **Step 4: Add a RESPAWN_DELAY constant + extend PlayerEntity**

Below `const LOCAL_ID = 'local'` add:

```ts
export const RESPAWN_DELAY = 3 // seconds
```

Change `PlayerEntity` to:

```ts
export interface PlayerEntity {
  id: string
  name: string
  team: Team
  player: Player
  weapons: WeaponManager
}
```

- [ ] **Step 5: Add config/scoreboard/respawnQueue fields + constructor**

Replace the field block + constructor (current lines 28–43) with:

```ts
  readonly localId = LOCAL_ID
  private playerMap = new Map<string, PlayerEntity>()
  enemies: Enemy[] = []
  waveManager = new WaveManager()
  scoreSystem = new ScoreSystem()
  pickups: Pickup[] = []
  collisionWorld: CollisionWorld | null = null
  tick = 0

  config: MatchConfig
  scoreboard: Scoreboard
  respawnQueue = new RespawnQueue()

  private shootRaycaster = new THREE.Raycaster()
  private cameraQuat = new THREE.Quaternion()
  private inputs = new Map<string, PlayerInput>()

  constructor(config: MatchConfig = defaultMatchConfig()) {
    this.config = config
    this.scoreboard = new Scoreboard(config.fragLimit)
    this.addPlayer(LOCAL_ID, 'You', 'ct')
  }
```

- [ ] **Step 6: Team-aware addPlayer**

Replace `addPlayer` with:

```ts
  addPlayer(id: string, name: string, team: Team = 'ct'): PlayerEntity {
    const index = this.playerMap.size // 0 = host/local, kept at origin
    const entity: PlayerEntity = { id, name, team, player: new Player(), weapons: new WeaponManager() }
    entity.player.position.copy(this.spawnPosition(index))
    this.playerMap.set(id, entity)
    this.inputs.set(id, emptyInput())
    return entity
  }
```

- [ ] **Step 7: Snapshot carries team, respawnIn, scores**

In `getSnapshot`, change the players map to include `team` and `respawnIn`, and the return to include `scores`:

```ts
    const players: EntityState[] = [...this.playerMap.values()].map((e) => ({
      id: e.id,
      kind: 'player',
      type: 'player',
      position: toVec3(e.player.position),
      rotationY: e.player.rotation.y,
      rotationX: e.player.rotation.x,
      health: e.player.health,
      isDead: e.player.isDead,
      weaponType: e.weapons.current.type,
      name: e.name,
      team: e.team,
      respawnIn: this.respawnQueue.isPending(e.id) ? this.respawnQueue.remaining(e.id) : undefined,
    }))
```

and:

```ts
    return { tick: this.tick, seq: 0, ack: {}, players, enemies, events: [], scores: this.scoreboard.snapshot() }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/session/GameSession.pvp.test.ts`
Expected: PASS (2 tests). `resolveShot` still type-checks because `fireWeapon` is updated in Task 9 — if `tsc` complains about an unused `canDamage`/`raycastPlayerCapsule`/`pickSpawn`/`HitZone`/`DamagePolicy` import here, that's expected and resolved in Tasks 9–10. To keep this commit green, proceed directly to Task 9 before running a full `tsc`.

- [ ] **Step 9: Commit**

```bash
git add src/session/GameSession.ts src/session/GameSession.pvp.test.ts
git commit -m "feat(pvp): GameSession holds match config, team, scoreboard, respawns"
```

---

## Task 9: GameSession — PvP hit resolution

**Files:**
- Modify: `src/session/GameSession.ts`
- Test: `src/session/GameSession.pvp.test.ts` (add cases)

- [ ] **Step 1: Add failing tests**

Append to `src/session/GameSession.pvp.test.ts`:

```ts
import * as THREE from 'three'

function aimAt(shooter: { player: { position: THREE.Vector3; rotation: THREE.Euler } }, target: THREE.Vector3) {
  const from = shooter.player.position
  const dx = target.x - from.x
  const dz = target.z - from.z
  shooter.player.rotation.y = Math.atan2(dx, -dz) // yaw so -Z forward points at target
  shooter.player.rotation.x = 0
}

describe('GameSession PvP damage', () => {
  function twoPlayers(config: any) {
    const s = new GameSession(config)
    const a = s.getPlayer(s.localId)!
    a.team = 'ct'
    a.player.position.set(0, 2, 0)
    const b = s.addPlayer('b', 'Bob', 't')
    b.player.position.set(0, 2, -8)
    aimAt(a, b.player.position)
    return { s, a, b }
  }

  it('opposite-team shot damages the target', () => {
    const { s, a, b } = twoPlayers({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    s.applyInput(a.id, { ...emptyInputForShoot() })
    s.step(1 / 30)
    expect(b.player.health).toBeLessThan(100)
  })

  it('same-team shot does no damage under team policy', () => {
    const { s, a, b } = twoPlayers({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    b.team = 'ct' // same team as a
    s.applyInput(a.id, { ...emptyInputForShoot() })
    s.step(1 / 30)
    expect(b.player.health).toBe(100)
  })

  it('same-team shot damages under friendly policy', () => {
    const { s, a, b } = twoPlayers({ mode: 'pvp', damagePolicy: 'friendly', fragLimit: 0 })
    b.team = 'ct'
    s.applyInput(a.id, { ...emptyInputForShoot() })
    s.step(1 / 30)
    expect(b.player.health).toBeLessThan(100)
  })

  it('coop mode never applies PvP damage', () => {
    const { s, a, b } = twoPlayers({ mode: 'coop', damagePolicy: 'team', fragLimit: 0 })
    s.applyInput(a.id, { ...emptyInputForShoot() })
    s.step(1 / 30)
    expect(b.player.health).toBe(100)
  })
})

function emptyInputForShoot() {
  return { forward: false, backward: false, left: false, right: false, jump: false, shoot: true, yaw: 0, pitch: 0, seq: 0, renderTime: 0 }
}
```

Note: `emptyInput` is already imported at the top of the test file via `GameSession`? It is not — add `import { emptyInput } from './protocol'` if needed; the helper above avoids it. Keep `aimAt` setting yaw directly; `step()` overwrites `rotation.y` from `input.yaw`, so set `input.yaw` too. Update `emptyInputForShoot` calls to pass yaw: in each `applyInput`, use `{ ...emptyInputForShoot(), yaw: a.player.rotation.y }`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/session/GameSession.pvp.test.ts`
Expected: FAIL — `b.player.health` stays 100 (no PvP path yet).

- [ ] **Step 3: Pass shooter into fireWeapon/resolveShot**

Change `fireWeapon` to pass the shooting entity into `resolveShot`:

```ts
  private fireWeapon(entity: PlayerEntity, events: SessionEvent[]): void {
    const weapon = entity.weapons.current
    this.cameraQuat.setFromEuler(entity.player.rotation)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraQuat)
    const pellets = weapon.type === 'shotgun' ? 6 : 1
    for (let p = 0; p < pellets; p++) {
      const dir = weapon.getSpreadDirection(forward)
      this.resolveShot(entity, entity.player.position, dir, weapon.def.range, weapon.def.damage, events)
    }
  }
```

- [ ] **Step 4: Rewrite resolveShot + add resolvePlayerHit**

Replace the whole `resolveShot` method with:

```ts
  private resolveShot(shooter: PlayerEntity, origin: THREE.Vector3, direction: THREE.Vector3, range: number, baseDamage: number, events: SessionEvent[]): void {
    this.shootRaycaster.set(origin, direction)
    this.shootRaycaster.far = range

    let nearestEnemy: Enemy | null = null
    let enemyDist = Infinity
    let enemyObj: THREE.Object3D | null = null
    let enemyPoint: THREE.Vector3 | null = null
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      enemy.mesh.updateMatrixWorld(true)
      const hits = this.shootRaycaster.intersectObject(enemy.mesh, true)
      if (hits.length > 0 && hits[0].distance < enemyDist) {
        enemyDist = hits[0].distance; nearestEnemy = enemy; enemyObj = hits[0].object; enemyPoint = hits[0].point
      }
    }

    const playerHit = this.config.mode === 'coop' ? null : this.resolvePlayerHit(shooter, origin, direction, range)

    const wallDist = this.collisionWorld
      ? this.collisionWorld.segmentBlocked(origin, origin.clone().addScaledVector(direction, range))
      : null

    const enemyValid = !!(nearestEnemy && enemyPoint && (wallDist === null || enemyDist < wallDist))
    const playerValid = !!(playerHit && (wallDist === null || playerHit.distance < wallDist))

    if (playerValid && (!enemyValid || playerHit!.distance <= enemyDist)) {
      const zone = playerHit!.zone
      const damage = zonedDamage(baseDamage, zone)
      const target = playerHit!.entity
      const killed = target.player.takeDamage(damage)
      events.push({ type: 'playerHitPlayer', victimId: target.id, hit: { targetId: target.id, zone, damage, killed, point: playerHit!.point } })
      if (killed) {
        this.scoreboard.recordKill(shooter.id, shooter.team, target.id, target.team, this.config.damagePolicy)
        this.respawnQueue.enqueue(target.id, RESPAWN_DELAY)
        events.push({ type: 'playerKilledPlayer', attackerId: shooter.id, victimId: target.id, victimTeam: target.team, teamkill: shooter.team === target.team })
        events.push({ type: 'playerDied', playerId: target.id })
        if (this.scoreboard.matchOver) events.push({ type: 'matchOver', winningTeam: this.scoreboard.winningTeam! })
      }
      return
    }

    if (enemyValid) {
      const zone = resolveZone(enemyObj)
      const damage = zonedDamage(baseDamage, zone)
      const killed = nearestEnemy!.takeDamage(damage)
      events.push({
        type: 'playerHitEnemy',
        enemyType: nearestEnemy!.type,
        hit: { targetId: nearestEnemy!.type, zone, damage, killed, point: toVec3(enemyPoint!) },
      })
      if (killed) {
        this.scoreSystem.addKill(nearestEnemy!.def.scoreValue)
        this.waveManager.onEnemyKilled()
        events.push({ type: 'enemyKilled', enemyType: nearestEnemy!.type, pos: toVec3(nearestEnemy!.mesh.position), scoreValue: nearestEnemy!.def.scoreValue })
      }
      return
    }

    if (wallDist !== null) {
      events.push({ type: 'wallImpact', point: toVec3(origin.clone().addScaledVector(direction, wallDist)) })
    }
  }

  /** Nearest living, damageable other player along the ray (M2 lag-comp seam). */
  private resolvePlayerHit(
    shooter: PlayerEntity, origin: THREE.Vector3, direction: THREE.Vector3, range: number,
  ): { entity: PlayerEntity; distance: number; point: Vec3; zone: HitZone } | null {
    let best: { entity: PlayerEntity; distance: number; point: Vec3; zone: HitZone } | null = null
    let bestDist = Infinity
    for (const entity of this.playerMap.values()) {
      if (entity.id === shooter.id || entity.player.isDead) continue
      if (!canDamage(shooter.team, entity.team, this.config.damagePolicy)) continue
      const hit = raycastPlayerCapsule(origin, direction, range, entity.player.position)
      if (hit && hit.distance < bestDist) {
        bestDist = hit.distance
        best = { entity, distance: hit.distance, point: hit.point, zone: hit.zone }
      }
    }
    return best
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/session/GameSession.pvp.test.ts`
Expected: PASS (all PvP cases). Remember each shooting `applyInput` must pass `yaw: a.player.rotation.y` (see Step 1 note) so `step()` aims correctly.

- [ ] **Step 6: Type-check the whole project so far**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `NetHost.ts`, `NetClient.ts`, `App.tsx` (constructor/snapshot field changes), fixed in Phase 3 + Phase 5.

- [ ] **Step 7: Commit**

```bash
git add src/session/GameSession.ts src/session/GameSession.pvp.test.ts
git commit -m "feat(pvp): resolve player-vs-player hits with team damage policy"
```

---

## Task 10: GameSession — respawn processing + PvP death handling

**Files:**
- Modify: `src/session/GameSession.ts`
- Test: `src/session/GameSession.pvp.test.ts` (add cases)

- [ ] **Step 1: Add failing tests**

Append to `src/session/GameSession.pvp.test.ts`:

```ts
describe('GameSession respawn', () => {
  it('respawns a killed player after the delay at a team spawn', () => {
    const s = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    const b = s.addPlayer('b', 'Bob', 't')
    b.player.position.set(0, 2, -8)
    // Kill b directly
    b.player.takeDamage(1000)
    expect(b.player.isDead).toBe(true)
    s.respawnQueue.enqueue('b', 3)
    // advance time past the delay
    for (let i = 0; i < 100; i++) s.step(1 / 30)
    expect(b.player.isDead).toBe(false)
    expect(b.player.health).toBe(100)
    // moved to t-side spawn (positive x region per Spawns)
    expect(b.player.position.x).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/session/GameSession.pvp.test.ts -t "respawns a killed player"`
Expected: FAIL — `b` stays dead (no respawn processing in `step`).

- [ ] **Step 3: Process respawns at the top of step**

In `step(dt)`, immediately after `this.tick++` add:

```ts
    // Respawn any players whose timer elapsed.
    for (const id of this.respawnQueue.update(dt)) {
      const entity = this.playerMap.get(id)
      if (!entity) continue
      entity.player.position.copy(pickSpawn(entity.team))
      entity.player.revive()
      events.push({ type: 'playerRespawned', playerId: id })
    }
```

- [ ] **Step 4: PvP-aware death from enemies**

In the enemy AI block, replace the death handling (current lines 184–187):

```ts
        if (targetPlayer.isDead) {
          events.push({ type: 'playerDied', playerId: target.id })
          if (target.id === this.localId) return events
        }
```

with:

```ts
        if (targetPlayer.isDead) {
          events.push({ type: 'playerDied', playerId: target.id })
          if (this.config.mode === 'coop') {
            if (target.id === this.localId) return events
          } else {
            this.scoreboard.recordDeath(target.id)
            this.respawnQueue.enqueue(target.id, RESPAWN_DELAY)
          }
        }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/session/GameSession.pvp.test.ts`
Expected: PASS (all cases including respawn).

- [ ] **Step 6: Commit**

```bash
git add src/session/GameSession.ts src/session/GameSession.pvp.test.ts
git commit -m "feat(pvp): respawn processing + non-coop death handling"
```

---

# Phase 3 — Netcode

## Task 11: NetHost — config, team, setTeam, start, wave guard

**Files:**
- Modify: `src/net/NetHost.ts`
- Test: `src/net/NetHost.pvp.test.ts`

Note: the existing `NetHost` constructor takes `(session, mode: GameMode)`. We change it to `(session, config: MatchConfig)`. Existing tests/`App.tsx` that pass `'coop'` must be updated (Task 11 Step 5 + Phase 5). Search first: `git grep -n "new NetHost"`.

- [ ] **Step 1: Write the failing test**

```ts
// src/net/NetHost.pvp.test.ts
import { describe, it, expect, vi } from 'vitest'
import { NetHost } from './NetHost'
import { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { NetMessage } from '../session/protocol'

function fakeTransport() {
  let handler: ((m: NetMessage) => void) | null = null
  const sent: NetMessage[] = []
  const t: Transport = {
    send: (m: NetMessage) => { sent.push(m) },
    onMessage: (cb: (m: NetMessage) => void) => { handler = cb },
  } as unknown as Transport
  return { t, sent, deliver: (m: NetMessage) => handler?.(m) }
}

describe('NetHost PvP', () => {
  it('welcome carries the match config', () => {
    const session = new GameSession({ mode: 'pvp', damagePolicy: 'ffa', fragLimit: 10 })
    const host = new NetHost(session, session.config)
    const { t, sent } = fakeTransport()
    host.addClient('p1', 'Ann', t, 't')
    const welcome = sent.find(m => m.type === 'welcome')
    expect(welcome).toMatchObject({ type: 'welcome', playerId: 'p1', config: { mode: 'pvp', damagePolicy: 'ffa', fragLimit: 10 } })
    expect(session.getPlayer('p1')!.team).toBe('t')
  })

  it('setTeam updates the player team', () => {
    const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    const host = new NetHost(session, session.config)
    const { t, deliver } = fakeTransport()
    host.addClient('p1', 'Ann', t, 'ct')
    deliver({ type: 'setTeam', playerId: 'p1', team: 't' })
    expect(session.getPlayer('p1')!.team).toBe('t')
  })

  it('startWave is ignored in pvp mode', () => {
    const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    const spy = vi.spyOn(session.waveManager, 'spawnNextWave')
    const host = new NetHost(session, session.config)
    const { t, deliver } = fakeTransport()
    host.addClient('p1', 'Ann', t, 'ct')
    deliver({ type: 'startWave', playerId: 'p1' })
    expect(spy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/NetHost.pvp.test.ts`
Expected: FAIL — constructor type / `config` not on welcome / `addClient` arity.

- [ ] **Step 3: Update NetHost**

Change the import line for protocol to include `MatchConfig`:

```ts
import type { GameMode, NetMessage, SessionEvent, Snapshot } from '../session/protocol'
import type { MatchConfig } from '../session/MatchConfig'
import type { Team } from '../types'
```

(`GameMode` may now be unused — remove it from the import if `tsc` flags it.)

Change the constructor:

```ts
  constructor(private session: GameSession, private config: MatchConfig) {}
```

Change `addClient` signature + body. Replace the whole method with:

```ts
  addClient(playerId: string, name: string, transport: Transport, team: Team = 'ct'): void {
    this.session.addPlayer(playerId, name, team)
    this.lastSeq.set(playerId, 0)
    transport.onMessage((msg) => {
      if (msg.type === 'input' && msg.playerId === playerId) {
        this.session.applyInput(playerId, msg.input)
        this.lastSeq.set(playerId, msg.input.seq)
      } else if (msg.type === 'pong') {
        this.pings.set(playerId, Math.round(performance.now() - msg.t))
      } else if (msg.type === 'buy' && msg.playerId === playerId) {
        const entity = this.session.getPlayer(playerId)
        const item = findItem(msg.item)
        if (entity && item) applyItem(item, entity.player, entity.weapons)
      } else if (msg.type === 'startWave' && msg.playerId === playerId) {
        if (this.config.mode !== 'pvp') this.session.waveManager.spawnNextWave()
      } else if (msg.type === 'setTeam' && msg.playerId === playerId) {
        const entity = this.session.getPlayer(playerId)
        if (entity && (msg.team === 'ct' || msg.team === 't')) entity.team = msg.team
      }
    })
    transport.send({ type: 'welcome', playerId, mode: this.config.mode, config: this.config })
    this.links.push({ playerId, transport })
    this.broadcast({ type: 'playerJoined', playerId, name })
  }
```

Add a method to broadcast match start (used by App when the host clicks Start):

```ts
  /** Tell every client to leave the lobby and begin the match. */
  startMatch(): void {
    this.broadcast({ type: 'start' })
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/NetHost.pvp.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Update any other NetHost constructor callers in tests**

Run: `git grep -n "new NetHost(" -- '*.test.ts'`
For each existing test that passes a bare mode string (e.g. `new NetHost(session, 'coop')`), change it to a config: `new NetHost(session, { mode: 'coop', damagePolicy: 'team', fragLimit: 0 })`. Re-run the full net test suite:
Run: `npx vitest run src/net`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/net/NetHost.ts src/net/NetHost.pvp.test.ts
git commit -m "feat(pvp): NetHost carries MatchConfig, team, setTeam, start, wave guard"
```

---

## Task 12: NetClient — store config + start callback

**Files:**
- Modify: `src/net/NetClient.ts`
- Test: `src/net/NetClient.pvp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/net/NetClient.pvp.test.ts
import { describe, it, expect } from 'vitest'
import { NetClient } from './NetClient'
import type { NetMessage } from '../session/protocol'
import type { Transport } from '../session/Transport'

function fakeTransport() {
  let handler: ((m: NetMessage) => void) | null = null
  const t: Transport = {
    send: () => {},
    onMessage: (cb: (m: NetMessage) => void) => { handler = cb },
  } as unknown as Transport
  return { t, deliver: (m: NetMessage) => handler?.(m) }
}

describe('NetClient PvP', () => {
  it('stores match config from welcome', () => {
    const { t, deliver } = fakeTransport()
    const c = new NetClient(t)
    deliver({ type: 'welcome', playerId: 'p1', mode: 'pvp', config: { mode: 'pvp', damagePolicy: 'ffa', fragLimit: 5 } })
    expect(c.config).toEqual({ mode: 'pvp', damagePolicy: 'ffa', fragLimit: 5 })
    expect(c.mode).toBe('pvp')
  })

  it('fires onStart when the host starts the match', () => {
    const { t, deliver } = fakeTransport()
    const c = new NetClient(t)
    let started = false
    c.onStart(() => { started = true })
    deliver({ type: 'start' })
    expect(started).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/NetClient.pvp.test.ts`
Expected: FAIL — `config` / `onStart` missing.

- [ ] **Step 3: Update NetClient**

Add the import:

```ts
import type { MatchConfig } from '../session/MatchConfig'
```

Add fields near the top of the class (after `mode`):

```ts
  config: MatchConfig | null = null
```

Add a start callback field next to the other `*Cb` fields:

```ts
  private startCb: (() => void) | null = null
```

Add the registration method next to `onWelcome`:

```ts
  onStart(cb: () => void): void { this.startCb = cb }
```

In `handle`, extend the `welcome` branch and add a `start` branch:

```ts
    if (msg.type === 'welcome') {
      this.playerId = msg.playerId
      this.config = msg.config
      this.mode = msg.config.mode
      this.welcomeCb?.(msg.playerId, msg.config.mode)
    } else if (msg.type === 'start') {
      this.startCb?.()
    } else if (msg.type === 'snapshot') {
```

(Leave the rest of `handle` unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/NetClient.pvp.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/net/NetClient.ts src/net/NetClient.pvp.test.ts
git commit -m "feat(pvp): NetClient stores match config + start callback"
```

---

# Phase 4 — Integration test

## Task 13: End-to-end PvP over loopback

**Files:**
- Test: `src/net/pvp.integration.test.ts`

Use the existing loopback `Transport` pattern from the current M-series integration tests. Run `git grep -ln "loopback\|LoopbackTransport\|integration" -- src` first and mirror how those tests construct a host+client pair. The test below assumes a `makePair()` helper returning two linked transports; if the repo already exposes one, import it instead of redefining.

- [ ] **Step 1: Write the failing test**

```ts
// src/net/pvp.integration.test.ts
import { describe, it, expect } from 'vitest'
import { NetHost } from './NetHost'
import { NetClient } from './NetClient'
import { GameSession } from '../session/GameSession'
import type { NetMessage } from '../session/protocol'
import type { Transport } from '../session/Transport'

/** Two transports wired directly to each other (synchronous loopback). */
function makePair(): [Transport, Transport] {
  let aCb: ((m: NetMessage) => void) | null = null
  let bCb: ((m: NetMessage) => void) | null = null
  const a: Transport = { send: (m: NetMessage) => bCb?.(m), onMessage: (cb) => { aCb = cb } } as unknown as Transport
  const b: Transport = { send: (m: NetMessage) => aCb?.(m), onMessage: (cb) => { bCb = cb } } as unknown as Transport
  return [a, b]
}

describe('PvP integration', () => {
  it('opposite-team client shot reduces the host player health in the snapshot', () => {
    const config = { mode: 'pvp' as const, damagePolicy: 'team' as const, fragLimit: 0 }
    const session = new GameSession(config)
    // Host player on CT at origin.
    session.getPlayer(session.localId)!.team = 'ct'
    session.getPlayer(session.localId)!.player.position.set(0, 2, 0)

    const host = new NetHost(session, config)
    const [hostSide, clientSide] = makePair()

    const client = new NetClient(clientSide)
    let latestHealth = 100
    client.onSnapshot((s) => {
      const me = s.players.find(p => p.id === session.localId)
      if (me) latestHealth = me.health
    })

    host.addClient('p1', 'Ann', hostSide, 't')
    // Place the client player so it can see the host, and aim at it.
    const shooter = session.getPlayer('p1')!
    shooter.player.position.set(0, 2, -8)
    const yaw = 0 // facing -Z toward host at origin
    client.sendInput({ forward: false, backward: false, left: false, right: false, jump: false, shoot: true, yaw, pitch: 0, seq: 0, renderTime: 0 })

    host.tick(1 / 30)
    expect(latestHealth).toBeLessThan(100)
  })

  it('same-team shot under team policy does no damage', () => {
    const config = { mode: 'pvp' as const, damagePolicy: 'team' as const, fragLimit: 0 }
    const session = new GameSession(config)
    session.getPlayer(session.localId)!.team = 'ct'
    session.getPlayer(session.localId)!.player.position.set(0, 2, 0)
    const host = new NetHost(session, config)
    const [hostSide, clientSide] = makePair()
    const client = new NetClient(clientSide)
    let latestHealth = 100
    client.onSnapshot((s) => {
      const me = s.players.find(p => p.id === session.localId)
      if (me) latestHealth = me.health
    })
    host.addClient('p1', 'Ann', hostSide, 'ct') // same team as host
    session.getPlayer('p1')!.player.position.set(0, 2, -8)
    client.sendInput({ forward: false, backward: false, left: false, right: false, jump: false, shoot: true, yaw: 0, pitch: 0, seq: 0, renderTime: 0 })
    host.tick(1 / 30)
    expect(latestHealth).toBe(100)
  })

  it('welcome propagates config to the client', () => {
    const config = { mode: 'hybrid' as const, damagePolicy: 'ffa' as const, fragLimit: 7 }
    const session = new GameSession(config)
    const host = new NetHost(session, config)
    const [hostSide, clientSide] = makePair()
    const client = new NetClient(clientSide)
    host.addClient('p1', 'Ann', hostSide, 't')
    expect(client.config).toEqual(config)
  })
})
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run src/net/pvp.integration.test.ts`
Expected: PASS if Phases 1–3 are correct. If the first case fails because the client weapon can't fire on tick 1, give the shooter a couple of host ticks: call `host.tick(1/30)` twice and assert after. (The client's `sendInput` queues the input; the host applies it on the next `tick`.)

- [ ] **Step 3: Commit**

```bash
git add src/net/pvp.integration.test.ts
git commit -m "test(pvp): end-to-end team damage over loopback transport"
```

- [ ] **Step 4: Full suite + type-check checkpoint**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All unit/integration tests PASS. The ONLY remaining `tsc` errors are in `src/App.tsx` (constructor + snapshot usages), fixed in Phase 5.

---

# Phase 5 — UI & match flow

> These tasks are integration/visual. Where a pure function exists, it is unit-tested; otherwise verification is `npx tsc --noEmit`, `npm run build`, and a manual smoke test. Run `npm run build` after each task to catch type/JSX errors.

## Task 14: GameState + MatchSetup component

**Files:**
- Modify: `src/types.ts`
- Create: `src/ui/MatchSetup.tsx`

- [ ] **Step 1: Extend GameState**

In `src/types.ts`, change the `GameState` union to add `'matchover'`:

```ts
export type GameState = 'menu' | 'mpmenu' | 'settings' | 'teamselect' | 'playing' | 'paused' | 'gameover' | 'matchover'
```

- [ ] **Step 2: Create the MatchSetup component**

```tsx
// src/ui/MatchSetup.tsx
import { useState } from 'react'
import type { MatchConfig, DamagePolicy } from '../session/MatchConfig'
import type { GameMode } from '../session/protocol'

const MODES: { value: GameMode; label: string }[] = [
  { value: 'coop', label: 'Co-op (vs AI)' },
  { value: 'pvp', label: 'Team PvP (no AI)' },
  { value: 'hybrid', label: 'Hybrid (teams + AI)' },
]
const POLICIES: { value: DamagePolicy; label: string }[] = [
  { value: 'team', label: 'Opposite team only' },
  { value: 'friendly', label: 'Friendly fire ON' },
  { value: 'ffa', label: 'Free-for-all' },
]
const FRAG_LIMITS = [10, 30, 50, 0]

const btn = (active: boolean): React.CSSProperties => ({
  padding: '10px 16px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 14,
  background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
  border: '1px solid #3a3a55',
})

export function MatchSetup({ onConfirm, onBack }: { onConfirm: (c: MatchConfig) => void; onBack: () => void }) {
  const [mode, setMode] = useState<GameMode>('pvp')
  const [policy, setPolicy] = useState<DamagePolicy>('team')
  const [frag, setFrag] = useState(30)

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, background: '#0d0d14',
      fontFamily: 'monospace', color: '#fff', zIndex: 50 }}>
      <h2 style={{ margin: 0 }}>MATCH SETUP</h2>

      <div><div style={{ opacity: 0.6, marginBottom: 6 }}>MODE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {MODES.map(m => <button key={m.value} style={btn(mode === m.value)} onClick={() => setMode(m.value)}>{m.label}</button>)}
        </div>
      </div>

      {mode !== 'coop' && (
        <div><div style={{ opacity: 0.6, marginBottom: 6 }}>DAMAGE POLICY</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {POLICIES.map(p => <button key={p.value} style={btn(policy === p.value)} onClick={() => setPolicy(p.value)}>{p.label}</button>)}
          </div>
        </div>
      )}

      {mode !== 'coop' && (
        <div><div style={{ opacity: 0.6, marginBottom: 6 }}>FRAG LIMIT</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {FRAG_LIMITS.map(f => <button key={f} style={btn(frag === f)} onClick={() => setFrag(f)}>{f === 0 ? 'Endless' : f}</button>)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button style={btn(false)} onClick={onBack}>Back</button>
        <button style={btn(true)} onClick={() => onConfirm({ mode, damagePolicy: policy, fragLimit: frag })}>Create Room</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no NEW errors in `MatchSetup.tsx` / `types.ts` (App.tsx errors still present).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/ui/MatchSetup.tsx
git commit -m "feat(pvp): MatchSetup screen + matchover game state"
```

---

## Task 15: Lobby team selection + rosters

**Files:**
- Modify: `src/ui/TeamSelect.tsx`, `src/ui/MultiplayerMenu.tsx`

Goal: in the multiplayer lobby, both host and joined clients can pick CT/T and see who is on each team. `git grep -n "MultiplayerMenu" src/App.tsx` and read `src/ui/MultiplayerMenu.tsx` first to match its existing prop shape.

- [ ] **Step 1: Make TeamSelect show the current pick + counts**

Replace `src/ui/TeamSelect.tsx` with a version that accepts an optional current selection and per-team counts (backward compatible — `selected`/`counts` are optional):

```tsx
// src/ui/TeamSelect.tsx
import type { Team } from '../types'

interface TeamSelectProps {
  onSelect: (team: Team) => void
  selected?: Team
  counts?: { ct: number; t: number }
}

export function TeamSelect({ onSelect, selected, counts }: TeamSelectProps) {
  const card = (team: Team, label: string, bg: string, border: string) => (
    <button
      onClick={() => onSelect(team)}
      style={{
        padding: '20px 32px', background: bg, color: '#fff',
        border: selected === team ? '3px solid #fff' : `1px solid ${border}`,
        cursor: 'pointer', fontSize: 16, minWidth: 200,
      }}
    >
      <div>{label}</div>
      {counts && <div style={{ opacity: 0.7, fontSize: 13, marginTop: 6 }}>{team === 'ct' ? counts.ct : counts.t} players</div>}
    </button>
  )

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#0d0d14', fontFamily: 'monospace', color: '#fff', zIndex: 50,
    }}>
      <h2 style={{ margin: 0 }}>CHOOSE YOUR SIDE</h2>
      <div style={{ display: 'flex', gap: 24 }}>
        {card('ct', 'Counter-Terrorist', '#1d3a5f', '#3a6ea5')}
        {card('t', 'Terrorist', '#5f3a1d', '#a5703a')}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add team controls to the lobby**

In `src/ui/MultiplayerMenu.tsx`, add optional props for the lobby team UI and render CT/T buttons + rosters when in a room. The exact JSX placement follows the existing lobby block; add this props extension and a roster panel:

```tsx
// add to MultiplayerMenu's props interface:
  myTeam?: import('../types').Team
  onSelectTeam?: (team: import('../types').Team) => void
  roster?: { ct: string[]; t: string[] }
```

And, inside the lobby view (where `roomCode`/players are shown), render:

```tsx
{onSelectTeam && (
  <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
    <button onClick={() => onSelectTeam('ct')}
      style={{ padding: '8px 16px', background: myTeam === 'ct' ? '#3a6ea5' : '#1d3a5f', color: '#fff', border: '1px solid #3a6ea5', cursor: 'pointer' }}>
      CT{roster ? ` (${roster.ct.length})` : ''}
    </button>
    <button onClick={() => onSelectTeam('t')}
      style={{ padding: '8px 16px', background: myTeam === 't' ? '#a5703a' : '#5f3a1d', color: '#fff', border: '1px solid #a5703a', cursor: 'pointer' }}>
      T{roster ? ` (${roster.t.length})` : ''}
    </button>
  </div>
)}
{roster && (
  <div style={{ display: 'flex', gap: 40, marginTop: 12, fontFamily: 'monospace' }}>
    <div><div style={{ color: '#3a6ea5' }}>COUNTER-TERRORISTS</div>{roster.ct.map((n, i) => <div key={i}>{n}</div>)}</div>
    <div><div style={{ color: '#a5703a' }}>TERRORISTS</div>{roster.t.map((n, i) => <div key={i}>{n}</div>)}</div>
  </div>
)}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no NEW errors in these two files (App.tsx wiring still pending in Task 18).

- [ ] **Step 4: Commit**

```bash
git add src/ui/TeamSelect.tsx src/ui/MultiplayerMenu.tsx
git commit -m "feat(pvp): lobby team selection + team rosters"
```

---

## Task 16: KillFeed, RespawnOverlay, MatchOver components + Scoreboard upgrade

**Files:**
- Create: `src/ui/KillFeed.tsx`, `src/ui/RespawnOverlay.tsx`, `src/ui/MatchOver.tsx`
- Modify: `src/ui/Scoreboard.tsx`

- [ ] **Step 1: KillFeed component**

```tsx
// src/ui/KillFeed.tsx
import React from 'react'

export interface KillLine { id: number; attacker: string; victim: string; teamkill: boolean }

export const KillFeed: React.FC<{ lines: KillLine[] }> = ({ lines }) => (
  <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column',
    gap: 4, fontFamily: 'monospace', fontSize: 14, zIndex: 55, pointerEvents: 'none' }}>
    {lines.map(l => (
      <div key={l.id} style={{ background: 'rgba(0,0,0,0.5)', padding: '3px 8px', color: l.teamkill ? '#ff5544' : '#fff' }}>
        {l.attacker} <span style={{ opacity: 0.6 }}>{l.teamkill ? '[TK] ✖' : '✖'}</span> {l.victim}
      </div>
    ))}
  </div>
)
```

- [ ] **Step 2: RespawnOverlay component**

```tsx
// src/ui/RespawnOverlay.tsx
import React from 'react'

export const RespawnOverlay: React.FC<{ seconds: number }> = ({ seconds }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)',
    color: '#fff', fontFamily: 'monospace', zIndex: 58, pointerEvents: 'none' }}>
    <div style={{ fontSize: 28, color: '#ff5544' }}>YOU DIED</div>
    <div style={{ fontSize: 18, marginTop: 8 }}>Respawning in {Math.ceil(seconds)}…</div>
  </div>
)
```

- [ ] **Step 3: MatchOver component**

```tsx
// src/ui/MatchOver.tsx
import React from 'react'
import type { Team } from '../types'
import type { MatchScores } from '../session/protocol'

export const MatchOver: React.FC<{ winningTeam: Team | null; scores: MatchScores; onBackToLobby: () => void }>
  = ({ winningTeam, scores, onBackToLobby }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0d0d14',
    color: '#fff', fontFamily: 'monospace', zIndex: 60 }}>
    <h1 style={{ margin: 0, color: winningTeam === 'ct' ? '#3a6ea5' : '#a5703a' }}>
      {winningTeam ? `${winningTeam === 'ct' ? 'COUNTER-TERRORISTS' : 'TERRORISTS'} WIN` : 'MATCH OVER'}
    </h1>
    <div style={{ display: 'flex', gap: 40 }}>
      <div><div style={{ color: '#3a6ea5' }}>CT</div><div style={{ fontSize: 32 }}>{scores.teams.ct}</div></div>
      <div><div style={{ color: '#a5703a' }}>T</div><div style={{ fontSize: 32 }}>{scores.teams.t}</div></div>
    </div>
    <button onClick={onBackToLobby} style={{ padding: '12px 24px', background: '#ff6600', color: '#000',
      border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 16 }}>Back to Lobby</button>
  </div>
)
```

- [ ] **Step 4: Upgrade Scoreboard to show K/D + team scores**

Add an optional `scores?: MatchScores` prop to `src/ui/Scoreboard.tsx` and render team totals + per-player K/D. Replace the component with:

```tsx
import React from 'react'
import type { EntityState, MatchScores } from '../session/protocol'

interface ScoreboardProps {
  players: EntityState[]
  roomCode?: string | null
  scores?: MatchScores
}

const overlay: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  pointerEvents: 'none', zIndex: 60, fontFamily: 'monospace',
}
const panel: React.CSSProperties = {
  minWidth: 480, maxWidth: '90%', background: 'rgba(10,10,25,0.92)', border: '1px solid #2a2a3f',
  borderRadius: 12, padding: 24, color: '#e0e0f0', boxShadow: '0 0 40px rgba(0,0,0,0.6)',
}
function pingColor(ping: number): string {
  if (ping < 60) return '#00ff88'
  if (ping < 120) return '#ffcc33'
  return '#ff5544'
}
const teamColor = (t?: string) => (t === 'ct' ? '#3a6ea5' : t === 't' ? '#a5703a' : '#8888aa')

export const Scoreboard: React.FC<ScoreboardProps> = ({ players, roomCode, scores }) => {
  const rows = [...players].sort((a, b) => {
    const ka = scores?.players[a.id]?.kills ?? 0
    const kb = scores?.players[b.id]?.kills ?? 0
    return kb - ka
  })
  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          borderBottom: '1px solid #2a2a3f', paddingBottom: 10, marginBottom: 10 }}>
          <h2 style={{ margin: 0, color: '#ff6600', fontSize: 22 }}>SCOREBOARD</h2>
          {scores && <span style={{ fontSize: 18 }}>
            <span style={{ color: '#3a6ea5' }}>CT {scores.teams.ct}</span>
            {'  :  '}
            <span style={{ color: '#a5703a' }}>{scores.teams.t} T</span>
          </span>}
          {roomCode && <span style={{ opacity: 0.5, fontSize: 13 }}>Room {roomCode}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '6px 24px',
          fontSize: 13, opacity: 0.5, marginBottom: 6 }}>
          <span>PLAYER</span><span>K</span><span>D</span><span>STATUS</span><span style={{ textAlign: 'right' }}>PING</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '8px 24px', fontSize: 16 }}>
          {rows.map((p) => {
            const ps = scores?.players[p.id]
            return (
              <React.Fragment key={p.id}>
                <span style={{ opacity: p.isDead ? 0.45 : 1, color: teamColor(p.team) }}>{p.name ?? p.id}</span>
                <span>{ps?.kills ?? 0}</span>
                <span>{ps?.deaths ?? 0}</span>
                <span style={{ color: p.isDead ? '#ff5544' : '#8888aa' }}>{p.isDead ? 'DEAD' : 'ALIVE'}</span>
                <span style={{ textAlign: 'right', color: pingColor(p.ping ?? 0) }}>{p.ping ?? 0} ms</span>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no NEW errors in the four UI files.

- [ ] **Step 6: Commit**

```bash
git add src/ui/KillFeed.tsx src/ui/RespawnOverlay.tsx src/ui/MatchOver.tsx src/ui/Scoreboard.tsx
git commit -m "feat(pvp): kill feed, respawn overlay, win screen, K/D scoreboard"
```

---

## Task 17: Team colors on remote players

**Files:**
- Modify: `src/net/RemotePlayer.ts` (and `src/entities/CharacterModel.ts` if needed)

`git grep -n "pushState\|new CharacterModel\|setColor\|material" src/net/RemotePlayer.ts src/entities/CharacterModel.ts` first to see the model's color hooks.

- [ ] **Step 1: Tint the model by team**

In `RemotePlayer.pushState(state: EntityState)`, when the model is created or when `state.team` changes, set a team tint. Add a helper and apply it. Concretely, add near the top of `RemotePlayer.ts`:

```ts
const TEAM_COLOR = { ct: 0x3a6ea5, t: 0xa5703a } as const
```

and in `pushState`, after the existing state handling:

```ts
    if (state.team && state.team !== this.team) {
      this.team = state.team
      this.applyTeamColor(TEAM_COLOR[state.team])
    }
```

Add a `private team: Team | null = null` field and an `applyTeamColor(color: number)` method that traverses `this.group` and sets each `MeshStandardMaterial.color` (clone materials first if they're shared). If `CharacterModel` already exposes a `setTint`/`setColor`, call that instead. Import `Team` from `../types`.

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/net/RemotePlayer.ts src/entities/CharacterModel.ts
git commit -m "feat(pvp): tint remote players by team"
```

---

## Task 18: App.tsx — wire config, lobby flow, PvP death/respawn/feed/win

**Files:**
- Modify: `src/App.tsx`

This is the integration glue. Make the edits below in order; after all of them run `npx tsc --noEmit && npm run build`.

- [ ] **Step 1: Imports + state**

Add imports:

```tsx
import { MatchSetup } from './ui/MatchSetup'
import { KillFeed, type KillLine } from './ui/KillFeed'
import { RespawnOverlay } from './ui/RespawnOverlay'
import { MatchOver } from './ui/MatchOver'
import { defaultMatchConfig, type MatchConfig } from './session/MatchConfig'
import type { MatchScores } from './session/protocol'
```

Add React state (near the other `useState`s):

```tsx
  const [matchConfig, setMatchConfig] = useState<MatchConfig>(defaultMatchConfig())
  const [showMatchSetup, setShowMatchSetup] = useState(false)
  const [myTeam, setMyTeam] = useState<Team>('ct')
  const [roster, setRoster] = useState<{ ct: string[]; t: string[] }>({ ct: [], t: [] })
  const [killFeed, setKillFeed] = useState<KillLine[]>([])
  const [respawnIn, setRespawnIn] = useState<number | null>(null)
  const [matchScores, setMatchScores] = useState<MatchScores | null>(null)
```

Add to `gameDataRef.current` initial object: `matchConfig: defaultMatchConfig() as MatchConfig,` and `killSeq: 0,`.

Add a helper to push a kill-feed line (inside the component, before the effect):

```tsx
  const pushKill = useCallback((attacker: string, victim: string, teamkill: boolean) => {
    const id = gameDataRef.current.killSeq++
    setKillFeed((prev) => [...prev.slice(-4), { id, attacker, victim, teamkill }])
    setTimeout(() => setKillFeed((prev) => prev.filter(l => l.id !== id)), 5000)
  }, [])
```

- [ ] **Step 2: Host uses the chosen config**

Change `hostGame` to accept a config and use it. Replace the `const netHost = new NetHost(data.session, 'coop')` line and the session construction so the host session is built from the config:

```tsx
  const hostGame = useCallback(async (config: MatchConfig) => {
    const data = gameDataRef.current
    data.role = 'host'
    data.matchConfig = config
    setMatchConfig(config)
    setIsHost(true)
    const peerHost = new PeerHost()
    data.peerHost = peerHost
    // Rebuild the session with the chosen rules (replaces the menu-time session).
    const scene = engineRef.current?.scene
    for (const enemy of data.session.enemies) { scene?.remove(enemy.mesh); enemy.dispose() }
    const fresh = new GameSession(config)
    fresh.collisionWorld = data.session.collisionWorld
    fresh.waveManager.onEnemySpawned = data.session.waveManager.onEnemySpawned
    fresh.waveManager.onWaveComplete = data.session.waveManager.onWaveComplete
    fresh.getPlayer(fresh.localId)!.name = settingsRef.current.playerName
    fresh.getPlayer(fresh.localId)!.team = myTeam
    data.session = fresh
    const netHost = new NetHost(fresh, config)
    data.netHost = netHost
    fresh.waveManager.auto = false
    setLobbyPlayers([settingsRef.current.playerName])
    setRoster({ ct: myTeam === 'ct' ? [settingsRef.current.playerName] : [], t: myTeam === 't' ? [settingsRef.current.playerName] : [] })
    peerHost.onClientConnect((transport) => {
      transport.onMessage((msg) => {
        if (msg.type === 'join') {
          const id = 'player-' + (data.nextClientNum++)
          const joinTeam = msg.team === 't' ? 't' : 'ct'
          netHost.addClient(id, msg.name, transport, joinTeam)
          setLobbyPlayers((prev) => {
            const next = [...prev, msg.name]
            data.hostDirectory?.setPlayers(next.length)
            return next
          })
          setRoster((prev) => ({ ...prev, [joinTeam]: [...prev[joinTeam], msg.name] }))
        } else if (msg.type === 'probe') {
          transport.send({ type: 'probeAck', t: msg.t })
        }
      })
    })
    const code = await peerHost.start()
    setRoomCode(code)
    const hostDirectory = new HostDirectory()
    data.hostDirectory = hostDirectory
    await hostDirectory.start({ roomCode: code, hostName: settingsRef.current.playerName, players: 1, maxPlayers: 8, status: 'lobby' })
  }, [myTeam])
```

- [ ] **Step 3: MultiplayerMenu "Host" opens MatchSetup first**

In the render, change the `MultiplayerMenu`'s `onHost` to open the setup screen instead of hosting directly, and render `MatchSetup`:

```tsx
        onHost={() => setShowMatchSetup(true)}
```

and add, alongside the other game-state blocks:

```tsx
      {gameState === 'mpmenu' && showMatchSetup && (
        <MatchSetup
          onBack={() => setShowMatchSetup(false)}
          onConfirm={(c) => { setShowMatchSetup(false); void hostGame(c) }}
        />
      )}
```

- [ ] **Step 4: Host start broadcasts to clients**

Change `MultiplayerMenu`'s `onStart` to also broadcast start and require both that the host began and clients receive it:

```tsx
        onStart={() => {
          gameDataRef.current.hostDirectory?.setStatus('in-progress')
          gameDataRef.current.netHost?.startMatch()
          startNetGame('host')
        }}
```

Pass the new lobby props to `MultiplayerMenu`:

```tsx
        myTeam={myTeam}
        onSelectTeam={(t) => {
          setMyTeam(t)
          const data = gameDataRef.current
          if (data.role === 'host') {
            const me = data.session.getPlayer(data.session.localId)
            if (me) me.team = t
            setRoster((prev) => moveToTeam(prev, settingsRef.current.playerName, t))
          } else if (data.netClient) {
            data.netClient.transport.send({ type: 'setTeam', playerId: data.netClient.playerId!, team: t })
          }
        }}
        roster={roster}
```

Add a small pure helper near the top of the file (module scope, outside the component):

```tsx
function moveToTeam(roster: { ct: string[]; t: string[] }, name: string, team: 'ct' | 't') {
  const ct = roster.ct.filter(n => n !== name)
  const t = roster.t.filter(n => n !== name)
  if (team === 'ct') ct.push(name); else t.push(name)
  return { ct, t }
}
```

- [ ] **Step 5: Client stays in lobby until host starts**

In `joinGame`, send the chosen team on join, store config on welcome, and begin only on `start`:

Change `client.onWelcome(() => startNetGame('client'))` and `client.join(...)` to:

```tsx
    client.onWelcome((_, mode) => {
      const data = gameDataRef.current
      if (data.netClient?.config) { data.matchConfig = data.netClient.config; setMatchConfig(data.netClient.config) }
      void mode
    })
    client.onStart(() => startNetGame('client'))
    client.join(settingsRef.current.playerName /* name */)
    // include team:
    client.transport.send({ type: 'setTeam', playerId: '', team: myTeam }) // no-op until welcome assigns id
```

Better: send team inside `join`. Replace `client.join(...)` with a direct message so the host's `addClient` receives the team:

```tsx
    client.transport.send({ type: 'join', name: settingsRef.current.playerName, team: myTeam })
```

(Keep `NetClient.join` for compatibility, but here we send the richer join directly.)

- [ ] **Step 6: PvP death/respawn/kill-feed/match-over event handling (host loop)**

In the host render-loop event `switch` (the block starting around line 418), update `playerDied` and add the new event cases:

```tsx
          case 'playerDied':
            if (session.config.mode === 'coop') {
              document.exitPointerLock()
              data.audio.playPlayerDeath()
              session.scoreSystem.saveHighScore()
              setHighScore(session.scoreSystem.highScore)
              engine.stop()
              updateGameState('gameover')
              return
            }
            if (ev.playerId === session.localId) data.audio.playPlayerDeath()
            break
          case 'playerHitPlayer': {
            const pt = ev.hit.point
            const point = new THREE.Vector3(pt.x, pt.y, pt.z)
            if (ev.hit.killed) data.particleSystem!.explosion(point, 'player')
            else data.particleSystem!.bloodSplatter(point)
            if (ev.victimId === session.localId) { data.audio.playPlayerHit(); setHealth(session.player.health) }
            break
          }
          case 'playerKilledPlayer': {
            const a = session.getPlayer(ev.attackerId)?.name ?? ev.attackerId
            const v = session.getPlayer(ev.victimId)?.name ?? ev.victimId
            pushKill(a, v, ev.teamkill)
            break
          }
          case 'matchOver':
            setMatchScores(session.scoreboard.snapshot())
            document.exitPointerLock()
            engine.stop()
            updateGameState('matchover')
            return
```

After the event loop, drive the local respawn overlay + live scores from the session each host frame (near where `setPlayerPos` is called):

```tsx
      setRespawnIn(session.respawnQueue.isPending(session.localId) ? session.respawnQueue.remaining(session.localId) : null)
      if (session.config.mode !== 'coop') setMatchScores(session.scoreboard.snapshot())
```

- [ ] **Step 7: PvP event handling (client `onEvent`)**

In `joinGame`'s `client.onEvent` switch, mirror the host: update `playerDied` to not force game-over in non-coop, and add `playerHitPlayer` / `playerKilledPlayer` / `matchOver` cases. Use `data.session` lookups for names where available, else the id. For the local respawn overlay and scores on the client, read from the snapshot in `updateClient`:

In `updateClient`, after `setHealth(...)`, add:

```tsx
      const meState = snap.players.find(p => p.id === client.playerId)
      setRespawnIn(meState?.respawnIn ?? null)
      setMatchScores(snap.scores)
      if (snap.scores.matchOver && gameStateRef.current === 'playing') {
        document.exitPointerLock()
        updateGameState('matchover')
      }
```

Client `onEvent` additions:

```tsx
        case 'playerDied':
          if (data.session.config.mode === 'coop' && ev.playerId === data.netClient?.playerId) {
            document.exitPointerLock(); data.audio.playPlayerDeath()
            data.session.scoreSystem.saveHighScore(); setHighScore(data.session.scoreSystem.highScore)
            engineRef.current?.stop(); updateGameState('gameover')
          } else if (ev.playerId === data.netClient?.playerId) {
            data.audio.playPlayerDeath()
          }
          break
        case 'playerHitPlayer': {
          const p = ev.hit.point; const point = new THREE.Vector3(p.x, p.y, p.z)
          if (ev.hit.killed) data.particleSystem!.explosion(point, 'player')
          else data.particleSystem!.bloodSplatter(point)
          if (ev.victimId === data.netClient?.playerId) data.audio.playPlayerHit()
          break
        }
        case 'playerKilledPlayer':
          pushKill(ev.attackerId, ev.victimId, ev.teamkill)
          break
        case 'matchOver':
          break // handled via snapshot.scores in updateClient
```

Note: `data.session` on the client mirrors player names only partially; using ids in the client kill feed is acceptable. Prefer `data.lastPlayers.find(p => p.id === id)?.name ?? id` for nicer names.

- [ ] **Step 8: Render the new in-match UI + match-over screen**

In the `gameState === 'playing'` block, add (after `<DamageOverlay .../>`):

```tsx
          <KillFeed lines={killFeed} />
          {respawnIn !== null && <RespawnOverlay seconds={respawnIn} />}
```

Pass `scores={matchScores ?? undefined}` to the existing `<Scoreboard .../>`.

Add a new top-level block:

```tsx
      {gameState === 'matchover' && (
        <MatchOver
          winningTeam={matchScores?.winningTeam ?? null}
          scores={matchScores ?? { teams: { ct: 0, t: 0 }, players: {}, matchOver: true, winningTeam: null }}
          onBackToLobby={() => {
            engineRef.current?.stop()
            setKillFeed([]); setRespawnIn(null)
            updateGameState('mpmenu')
          }}
        />
      )}
```

- [ ] **Step 9: Guard the host G-key wave spawn in pvp**

In `handleKeyDown`, change the host branch of the `KeyG` handler:

```tsx
        if (data.role === 'host') {
          if (data.session.config.mode !== 'pvp') data.session.waveManager.spawnNextWave()
        } else if (data.role === 'client' && data.netClient) {
```

- [ ] **Step 10: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build, zero type errors across the project.

- [ ] **Step 11: Full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 12: Commit**

```bash
git add src/App.tsx
git commit -m "feat(pvp): wire match setup, lobby teams, synchronized start, PvP HUD"
```

---

## Task 19: Manual smoke test + e2e check

**Files:** none (verification only)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 2: Manual two-window smoke test**

Run: `npm run dev`. In two browser windows:
1. Window A: Multiplayer → Host → choose **Team PvP / Opposite-team / 10** → Create Room → pick CT.
2. Window B: Multiplayer → join the room code → pick T. Confirm A's roster shows both players on the correct teams.
3. In A, click **Start**. Both windows enter the match.
4. Shoot the other player: health drops, a kill (after enough damage) shows in the kill feed, the victim sees the respawn overlay and respawns at a spawn point. Tab shows K/D + team score.
5. Reach the frag limit: both see the win screen; "Back to Lobby" returns to the MP menu.
6. Repeat hosting with **Co-op** mode: confirm AI waves spawn (press G as host) and players cannot damage each other (verify health unchanged when shooting an ally).

Document any deviation as a bug to fix before merge.

- [ ] **Step 3: Run the existing e2e suite**

Run: `git grep -l "test(" e2e tests 2>/dev/null; npx playwright test` (use the repo's actual e2e command if different — check `package.json` scripts).
Expected: existing MP e2e tests still pass (they skip without WebRTC per the recent commit). Fix any regressions.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(pvp): smoke-test fixes"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** modes (Tasks 8–11, 14, 18) · damage policies (Tasks 1, 9) · team picking lobby (Tasks 15, 18) · PvP damage (Tasks 5, 9, 13) · respawn (Tasks 3, 7, 10) · team score + frag limit + win/reset (Tasks 2, 16, 18) · late joiners get config via welcome (Tasks 11, 12) · coop safety (Tasks 9, 10, 18) · spawn fallback (Task 4).
- **Type consistency:** `MatchConfig`/`DamagePolicy` from `MatchConfig.ts`; `GameMode` from `protocol.ts`; `MatchScores`/`PlayerScore` defined in `Scoreboard.ts`, re-exported by `protocol.ts`. `canDamage`, `recordKill`, `pickSpawn`, `raycastPlayerCapsule`, `revive`, `startMatch`, `onStart` names are used identically across tasks.
- **Known follow-ups (out of scope):** M2 lag-compensation wraps `resolvePlayerHit`; auto-balance; per-map spawn authoring; automatic round restarts.
