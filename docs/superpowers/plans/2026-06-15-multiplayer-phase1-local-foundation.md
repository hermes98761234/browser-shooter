# Multiplayer Phase 1 — Local Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the inline game loop into a transport-agnostic, host-authoritative `GameSession`, add head/body/legs hitbox damage to bots, a shared zoned `CharacterModel`, Tab weapon cycling, and a B buy-store shell — all testable in single-player.

**Architecture:** A `GameSession` owns the authoritative simulation (player, bots, shooting, pickups) and advances it via `step(dt)`, emitting events for effects/audio/UI. A `Transport` interface sits at its boundary; Phase 1 ships only `LoopbackTransport`. Wire-protocol types are defined now so Phase 2 can add a PeerTransport without touching the simulation. `App.tsx` shrinks to: gather input → `applyInput` → `step` → render the live session state → handle emitted events.

**Tech Stack:** TypeScript 5.6, React 19, Three.js r170, Vite 6, Vitest 3 (jsdom), Playwright.

**Conventions (match existing code):**
- Unit tests live in `__tests__/` next to the module, named `*.test.ts`, using `vitest` (`describe/it/expect`).
- Run a single unit test file: `npm run test -- src/path/__tests__/File.test.ts`
- Run all unit tests: `npm run test`
- Run E2E: `npm run test:e2e`
- Two-space indent, no semicolons (match existing style).
- Commit after each task with a `feat:`/`refactor:`/`test:` message ending with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

---

## File Structure

New files:
- `src/systems/DamageZones.ts` — zone multipliers + `resolveZone(object)`.
- `src/entities/CharacterModel.ts` — shared zoned humanoid builder (`head`/`body`/`legs` via `userData.zone`), tint + optional name tag.
- `src/session/protocol.ts` — wire-protocol types (`PlayerInput`, `EntityState`, `Snapshot`, `HitEvent`, `NetMessage`, `SessionEvent`).
- `src/session/Transport.ts` — `Transport` interface + `LoopbackTransport`.
- `src/session/GameSession.ts` — authoritative simulation.
- `src/ui/BuyMenu.tsx` — B-key buy-store overlay.

Modified files:
- `src/enemies/EnemyModel.ts` — tag soldier parts with `userData.zone`.
- `src/weapons/WeaponManager.ts` — add `cycleNext()`.
- `src/player/Controls.ts` — handle `Tab` (preventDefault + callback) and `KeyB` (callback).
- `src/App.tsx` — drive the loop through `GameSession`; wire BuyMenu + money stub.

---

## Task 1: DamageZones system

**Files:**
- Create: `src/systems/DamageZones.ts`
- Test: `src/systems/__tests__/DamageZones.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/systems/__tests__/DamageZones.test.ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { ZONE_MULTIPLIERS, resolveZone, zonedDamage } from '../DamageZones'

describe('DamageZones', () => {
  it('exposes head/body/legs multipliers', () => {
    expect(ZONE_MULTIPLIERS.head).toBe(4)
    expect(ZONE_MULTIPLIERS.body).toBe(1)
    expect(ZONE_MULTIPLIERS.legs).toBe(0.75)
  })

  it('resolves a tagged mesh to its zone', () => {
    const mesh = new THREE.Mesh()
    mesh.userData.zone = 'head'
    expect(resolveZone(mesh)).toBe('head')
  })

  it('walks up parents to find the zone tag', () => {
    const parent = new THREE.Group()
    parent.userData.zone = 'legs'
    const child = new THREE.Mesh()
    parent.add(child)
    expect(resolveZone(child)).toBe('legs')
  })

  it('defaults to body when no zone tag exists', () => {
    expect(resolveZone(new THREE.Mesh())).toBe('body')
  })

  it('scales weapon damage by the zone multiplier', () => {
    expect(zonedDamage(20, 'head')).toBe(80)
    expect(zonedDamage(20, 'body')).toBe(20)
    expect(zonedDamage(20, 'legs')).toBe(15)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/systems/__tests__/DamageZones.test.ts`
Expected: FAIL — cannot find module `../DamageZones`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/systems/DamageZones.ts
import type { Object3D } from 'three'

export type HitZone = 'head' | 'body' | 'legs'

export const ZONE_MULTIPLIERS: Record<HitZone, number> = {
  head: 4,
  body: 1,
  legs: 0.75,
}

/** Walks up the parent chain to find a `userData.zone`; defaults to 'body'. */
export function resolveZone(object: Object3D | null): HitZone {
  let current: Object3D | null = object
  while (current) {
    const zone = current.userData?.zone
    if (zone === 'head' || zone === 'body' || zone === 'legs') return zone
    current = current.parent
  }
  return 'body'
}

export function zonedDamage(weaponDamage: number, zone: HitZone): number {
  return weaponDamage * ZONE_MULTIPLIERS[zone]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/systems/__tests__/DamageZones.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/DamageZones.ts src/systems/__tests__/DamageZones.test.ts
git commit -m "feat: add head/body/legs damage zone system

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Tag enemy soldier parts with hit zones

The simplest path to zoned bots is to tag the existing `buildSoldier` parts. Head box → `head`, torso/arms/gun → `body`, legs → `legs`.

**Files:**
- Modify: `src/enemies/EnemyModel.ts`
- Test: `src/enemies/__tests__/EnemyModel.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/enemies/__tests__/EnemyModel.test.ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildSoldier } from '../EnemyModel'
import { resolveZone } from '../../systems/DamageZones'

describe('buildSoldier hit zones', () => {
  it('tags a head, body and legs zone', () => {
    const group = buildSoldier('grunt')
    const zones = new Set<string>()
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) zones.add(resolveZone(o))
    })
    expect(zones.has('head')).toBe(true)
    expect(zones.has('body')).toBe(true)
    expect(zones.has('legs')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/enemies/__tests__/EnemyModel.test.ts`
Expected: FAIL — `zones.has('head')` is false (no zone tags yet).

- [ ] **Step 3: Implement — tag each part before adding to the group**

Replace the loop near the end of `buildSoldier` in `src/enemies/EnemyModel.ts`:

```typescript
  // OLD:
  // for (const part of [lLeg, rLeg, torso, head, lArm, rArm, gun]) {
  //   part.castShadow = true
  //   group.add(part)
  // }

  const zoned: [THREE.Mesh, 'head' | 'body' | 'legs'][] = [
    [lLeg, 'legs'],
    [rLeg, 'legs'],
    [torso, 'body'],
    [head, 'head'],
    [lArm, 'body'],
    [rArm, 'body'],
    [gun, 'body'],
  ]
  for (const [part, zone] of zoned) {
    part.userData.zone = zone
    part.castShadow = true
    group.add(part)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/enemies/__tests__/EnemyModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/enemies/EnemyModel.ts src/enemies/__tests__/EnemyModel.test.ts
git commit -m "feat: tag enemy soldier parts with head/body/legs zones

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Shared `CharacterModel` (for remote players in Phase 2)

A reusable zoned humanoid with a tint and optional name tag. Bots keep `buildSoldier`; this is the player-facing variant, built and tested now so Phase 2 can render remote players. It reuses the same zone tags so `resolveZone` works identically.

**Files:**
- Create: `src/entities/CharacterModel.ts`
- Test: `src/entities/__tests__/CharacterModel.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/entities/__tests__/CharacterModel.test.ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildCharacter } from '../CharacterModel'
import { resolveZone } from '../../systems/DamageZones'

describe('buildCharacter', () => {
  it('builds a group with head/body/legs zones', () => {
    const group = buildCharacter({ tint: 0xff0000 })
    const zones = new Set<string>()
    group.traverse((o) => { if (o instanceof THREE.Mesh) zones.add(resolveZone(o)) })
    expect(zones.has('head')).toBe(true)
    expect(zones.has('body')).toBe(true)
    expect(zones.has('legs')).toBe(true)
  })

  it('applies the tint to the torso material', () => {
    const group = buildCharacter({ tint: 0x00ff00 })
    let found = false
    group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.zone === 'body' &&
          o.material instanceof THREE.MeshStandardMaterial &&
          o.material.color.getHex() === 0x00ff00) found = true
    })
    expect(found).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/entities/__tests__/CharacterModel.test.ts`
Expected: FAIL — cannot find module `../CharacterModel`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/entities/CharacterModel.ts
import * as THREE from 'three'

export interface CharacterOptions {
  tint: number
  name?: string
}

/** A zoned humanoid for remote players. Feet at y=0, faces -Z. */
export function buildCharacter(opts: CharacterOptions): THREE.Group {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: opts.tint, roughness: 0.7, metalness: 0.2 })
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2a679, roughness: 0.8 })

  const legGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25)
  const lLeg = new THREE.Mesh(legGeo, bodyMat); lLeg.position.set(-0.18, 0.45, 0)
  const rLeg = new THREE.Mesh(legGeo, bodyMat); rLeg.position.set(0.18, 0.45, 0)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), bodyMat); torso.position.set(0, 1.3, 0)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat); head.position.set(0, 1.85, 0)
  const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18)
  const lArm = new THREE.Mesh(armGeo, bodyMat); lArm.position.set(-0.45, 1.35, 0)
  const rArm = new THREE.Mesh(armGeo, bodyMat); rArm.position.set(0.45, 1.35, 0)

  const zoned: [THREE.Mesh, 'head' | 'body' | 'legs'][] = [
    [lLeg, 'legs'], [rLeg, 'legs'], [torso, 'body'], [head, 'head'], [lArm, 'body'], [rArm, 'body'],
  ]
  for (const [part, zone] of zoned) {
    part.userData.zone = zone
    part.castShadow = true
    group.add(part)
  }

  if (opts.name) group.add(makeNameTag(opts.name))
  return group
}

function makeNameTag(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(name, 128, 44)
  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
  sprite.position.set(0, 2.4, 0)
  sprite.scale.set(1.5, 0.375, 1)
  return sprite
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/entities/__tests__/CharacterModel.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/CharacterModel.ts src/entities/__tests__/CharacterModel.test.ts
git commit -m "feat: add shared zoned CharacterModel for remote players

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Wire protocol types

Pure type declarations + one helper. No runtime behavior yet; defining these now locks the `GameSession` boundary for Phase 2.

**Files:**
- Create: `src/session/protocol.ts`
- Test: `src/session/__tests__/protocol.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/session/__tests__/protocol.test.ts
import { describe, it, expect } from 'vitest'
import { emptyInput } from '../protocol'

describe('protocol', () => {
  it('emptyInput has all controls cleared', () => {
    const input = emptyInput()
    expect(input.forward).toBe(false)
    expect(input.shoot).toBe(false)
    expect(input.yaw).toBe(0)
    expect(input.pitch).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/session/__tests__/protocol.test.ts`
Expected: FAIL — cannot find module `../protocol`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/session/protocol.ts
import type { Vec3 } from '../types'
import type { HitZone } from '../systems/DamageZones'

export interface PlayerInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
  shoot: boolean
  yaw: number   // absolute look yaw (radians)
  pitch: number // absolute look pitch (radians)
}

export function emptyInput(): PlayerInput {
  return { forward: false, backward: false, left: false, right: false, jump: false, shoot: false, yaw: 0, pitch: 0 }
}

export interface EntityState {
  id: string
  kind: 'player' | 'enemy'
  type: string
  position: Vec3
  rotationY: number
  health: number
  isDead: boolean
}

export interface Snapshot {
  tick: number
  players: EntityState[]
  enemies: EntityState[]
}

export interface HitEvent {
  targetId: string
  zone: HitZone
  damage: number
  killed: boolean
  point: Vec3
}

/** Events the session emits each step for effects/audio/UI to react to. */
export type SessionEvent =
  | { type: 'playerHitEnemy'; hit: HitEvent; enemyType: string }
  | { type: 'wallImpact'; point: Vec3 }
  | { type: 'enemyShoot'; from: Vec3; to: Vec3; hit: boolean; damage: number }
  | { type: 'enemyMelee'; damage: number; enemyPos: Vec3 }
  | { type: 'enemyTelegraph'; enemyPos: Vec3; facing: Vec3 }
  | { type: 'enemyKilled'; enemyType: string; pos: Vec3; scoreValue: number }
  | { type: 'pickup'; pickupType: string; value: number }
  | { type: 'playerDied' }

/** Network envelope — unused in Phase 1, consumed by PeerTransport in Phase 2. */
export type NetMessage =
  | { type: 'input'; playerId: string; input: PlayerInput }
  | { type: 'snapshot'; snapshot: Snapshot }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/session/__tests__/protocol.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session/protocol.ts src/session/__tests__/protocol.test.ts
git commit -m "feat: define session wire-protocol types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Transport interface + LoopbackTransport

**Files:**
- Create: `src/session/Transport.ts`
- Test: `src/session/__tests__/Transport.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/session/__tests__/Transport.test.ts
import { describe, it, expect, vi } from 'vitest'
import { LoopbackTransport } from '../Transport'

describe('LoopbackTransport', () => {
  it('delivers sent messages to registered handlers', () => {
    const t = new LoopbackTransport()
    const handler = vi.fn()
    t.onMessage(handler)
    t.send({ type: 'input', playerId: 'p1', input: { forward: true } as any })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].playerId).toBe('p1')
  })

  it('supports multiple handlers', () => {
    const t = new LoopbackTransport()
    const a = vi.fn(); const b = vi.fn()
    t.onMessage(a); t.onMessage(b)
    t.send({ type: 'snapshot', snapshot: { tick: 0, players: [], enemies: [] } })
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/session/__tests__/Transport.test.ts`
Expected: FAIL — cannot find module `../Transport`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/session/Transport.ts
import type { NetMessage } from './protocol'

export interface Transport {
  send(msg: NetMessage): void
  onMessage(cb: (msg: NetMessage) => void): void
}

/** Single-process transport: delivers messages synchronously to all handlers. */
export class LoopbackTransport implements Transport {
  private handlers: ((msg: NetMessage) => void)[] = []

  send(msg: NetMessage): void {
    for (const h of this.handlers) h(msg)
  }

  onMessage(cb: (msg: NetMessage) => void): void {
    this.handlers.push(cb)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/session/__tests__/Transport.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/session/Transport.ts src/session/__tests__/Transport.test.ts
git commit -m "feat: add Transport interface and LoopbackTransport

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: GameSession skeleton — state, input, snapshot

`GameSession` owns the authoritative state objects (player, weaponManager, enemies, waveManager, pickups, collisionWorld) and exposes `applyInput`, `getSnapshot`, and an event sink. `step` arrives in Tasks 7–8. It does NOT touch THREE.Scene, React, audio, or particles — those stay in `App.tsx`, driven by the emitted events.

**Files:**
- Create: `src/session/GameSession.ts`
- Test: `src/session/__tests__/GameSession.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/session/__tests__/GameSession.test.ts
import { describe, it, expect } from 'vitest'
import { GameSession } from '../GameSession'
import { emptyInput } from '../protocol'

describe('GameSession skeleton', () => {
  it('starts with one local player and no enemies', () => {
    const s = new GameSession()
    const snap = s.getSnapshot()
    expect(snap.players).toHaveLength(1)
    expect(snap.players[0].id).toBe('local')
    expect(snap.enemies).toHaveLength(0)
    expect(snap.players[0].health).toBe(100)
  })

  it('stores the latest input for a player', () => {
    const s = new GameSession()
    const input = { ...emptyInput(), forward: true, yaw: 1.2 }
    s.applyInput('local', input)
    expect(s.getInput('local').forward).toBe(true)
    expect(s.getInput('local').yaw).toBe(1.2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/session/__tests__/GameSession.test.ts`
Expected: FAIL — cannot find module `../GameSession`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/session/GameSession.ts
import * as THREE from 'three'
import { Player } from '../player/Player'
import { WeaponManager } from '../weapons/WeaponManager'
import { Enemy } from '../enemies/Enemy'
import { WaveManager } from '../enemies/WaveManager'
import { Pickup } from '../systems/Pickup'
import { ScoreSystem } from '../systems/ScoreSystem'
import type { CollisionWorld } from '../engine/CollisionWorld'
import { emptyInput, type PlayerInput, type Snapshot, type SessionEvent, type EntityState } from './protocol'
import type { Vec3 } from '../types'

export const ARENA_SIZE = 30
const LOCAL_ID = 'local'

function toVec3(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z }
}

export class GameSession {
  readonly localId = LOCAL_ID
  player = new Player()
  weaponManager = new WeaponManager()
  enemies: Enemy[] = []
  waveManager = new WaveManager()
  scoreSystem = new ScoreSystem()
  pickups: Pickup[] = []
  collisionWorld: CollisionWorld | null = null
  tick = 0

  private inputs = new Map<string, PlayerInput>([[LOCAL_ID, emptyInput()]])

  applyInput(playerId: string, input: PlayerInput): void {
    this.inputs.set(playerId, input)
  }

  getInput(playerId: string): PlayerInput {
    return this.inputs.get(playerId) ?? emptyInput()
  }

  getSnapshot(): Snapshot {
    const players: EntityState[] = [{
      id: LOCAL_ID,
      kind: 'player',
      type: 'player',
      position: toVec3(this.player.position),
      rotationY: this.player.rotation.y,
      health: this.player.health,
      isDead: this.player.isDead,
    }]
    const enemies: EntityState[] = this.enemies.map((e, i) => ({
      id: `enemy-${i}`,
      kind: 'enemy',
      type: e.type,
      position: toVec3(e.mesh.position),
      rotationY: e.mesh.rotation.y,
      health: e.health,
      isDead: e.isDead,
    }))
    return { tick: this.tick, players, enemies }
  }

  // step(dt) added in Tasks 7-8.
  step(_dt: number): SessionEvent[] {
    return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/session/__tests__/GameSession.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/session/GameSession.ts src/session/__tests__/GameSession.test.ts
git commit -m "feat: add GameSession skeleton with input and snapshot

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: GameSession.step — movement, bots, pickups, events

Move the per-frame simulation out of `App.tsx`'s `onUpdate` into `step(dt)`. It applies the local input to the player, ticks weapons, updates the wave manager and enemies, processes enemy actions into events, resolves pickups, and returns the event list. Shooting/hit-resolution is added in Task 8 (`step` calls a `private fireLocalWeapon` stub here, implemented next).

**Files:**
- Modify: `src/session/GameSession.ts`
- Test: `src/session/__tests__/GameSession.step.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/session/__tests__/GameSession.step.test.ts
import { describe, it, expect } from 'vitest'
import { GameSession } from '../GameSession'
import { emptyInput } from '../protocol'

describe('GameSession.step', () => {
  it('moves the player forward when input.forward is set', () => {
    const s = new GameSession()
    s.applyInput('local', { ...emptyInput(), forward: true })
    const z0 = s.player.position.z
    s.step(0.1)
    expect(s.player.position.z).toBeLessThan(z0) // -Z is forward
  })

  it('increments the tick each step', () => {
    const s = new GameSession()
    s.step(0.016)
    s.step(0.016)
    expect(s.tick).toBe(2)
  })

  it('is deterministic for identical inputs', () => {
    const run = () => {
      const s = new GameSession()
      s.applyInput('local', { ...emptyInput(), forward: true, right: true })
      for (let i = 0; i < 10; i++) s.step(0.016)
      return s.player.position.clone()
    }
    const a = run(); const b = run()
    expect(a.x).toBeCloseTo(b.x, 10)
    expect(a.z).toBeCloseTo(b.z, 10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/session/__tests__/GameSession.step.test.ts`
Expected: FAIL — `step` is a no-op, player does not move / tick stays 0.

- [ ] **Step 3: Implement `step` (replace the stub)**

In `src/session/GameSession.ts`, add imports at the top:

```typescript
import { zonedDamage, resolveZone } from '../systems/DamageZones'
```

Replace the `step` stub with:

```typescript
  step(dt: number): SessionEvent[] {
    const events: SessionEvent[] = []
    this.tick++
    const input = this.getInput(LOCAL_ID)
    const player = this.player

    // Look (yaw/pitch are absolute, set by the input producer).
    player.rotation.y = input.yaw
    player.rotation.x = THREE.MathUtils.clamp(input.pitch, -Math.PI / 2, Math.PI / 2)

    // Movement + collision.
    player.update(dt, input, ARENA_SIZE)
    if (this.collisionWorld) this.collisionWorld.resolve(player.position, 0.5)

    // Weapons.
    this.weaponManager.update(dt)
    if (input.shoot && this.weaponManager.current.canShoot()) {
      this.weaponManager.current.shoot()
      this.fireLocalWeapon(events)
    }

    // Waves + enemies.
    this.waveManager.update(dt, ARENA_SIZE)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      const action = enemy.update(dt, player.position, this.collisionWorld ?? undefined)

      if (enemy.isDead) {
        if (enemy.deathTimer <= 0) this.enemies.splice(i, 1) // App removes/disposes the mesh
        continue
      }

      if (enemy.telegraphCue) {
        events.push({
          type: 'enemyTelegraph',
          enemyPos: toVec3(enemy.mesh.position),
          facing: toVec3(new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.mesh.quaternion)),
        })
      }

      if (action) {
        if (action.type === 'shoot') {
          if (action.hit) player.takeDamage(action.damage)
          events.push({
            type: 'enemyShoot',
            from: toVec3(action.from),
            to: action.hit ? toVec3(player.position) : toVec3(action.to),
            hit: action.hit,
            damage: action.damage,
          })
        } else {
          player.takeDamage(action.damage)
          events.push({ type: 'enemyMelee', damage: action.damage, enemyPos: toVec3(enemy.mesh.position) })
        }
        if (player.isDead) {
          events.push({ type: 'playerDied' })
          return events
        }
      }
    }

    // Pickups.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i]
      pickup.update(dt, this.tick * dt)
      if (pickup.checkCollision(player.position)) {
        if (pickup.type === 'health') player.heal(pickup.value)
        else this.weaponManager.addAmmo(this.weaponManager.current.type, pickup.value)
        events.push({ type: 'pickup', pickupType: pickup.type, value: pickup.value })
        this.pickups.splice(i, 1) // App removes/disposes the mesh
      }
    }

    return events
  }

  private fireLocalWeapon(_events: SessionEvent[]): void {
    // Implemented in Task 8.
  }
```

> Note: `App.tsx` is still responsible for adding/removing/disposing meshes from the scene in response to the session's enemy/pickup arrays shrinking and to `enemyKilled`/`pickup` events (handled in Task 9). The session only mutates simulation state.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/session/__tests__/GameSession.step.test.ts`
Expected: PASS (3 tests). Also run `npm run test -- src/session/` to confirm earlier session tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/session/GameSession.ts src/session/__tests__/GameSession.step.test.ts
git commit -m "feat: implement GameSession.step simulation and events

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: GameSession hit resolution with hitbox zones

Implement `fireLocalWeapon`: raycast against enemy meshes (handling the shotgun's 6 pellets), resolve the hit zone, scale damage, apply it, and emit `playerHitEnemy` / `enemyKilled` / `wallImpact` events. This replaces the old `checkHit` in `App.tsx`.

**Files:**
- Modify: `src/session/GameSession.ts`
- Test: `src/session/__tests__/GameSession.fire.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/session/__tests__/GameSession.fire.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { GameSession } from '../GameSession'
import { Enemy } from '../../enemies/Enemy'
import { emptyInput } from '../protocol'

function placeEnemyInFront(s: GameSession, atZone: 'head' | 'body') {
  // Player sits at (0,2,0) facing -Z. Put an enemy ahead on -Z.
  const enemy = new Enemy('grunt', new THREE.Vector3(0, 0, -5))
  s.enemies.push(enemy)
  // Aim straight at the head (~y 1.85) or body (~y 1.3) of the enemy.
  const targetY = atZone === 'head' ? 1.85 : 1.3
  const dir = new THREE.Vector3(0, targetY - 2, -5).normalize()
  s.player.rotation.y = Math.atan2(dir.x, -dir.z)
  s.player.rotation.x = Math.asin(dir.y)
  return enemy
}

describe('GameSession hit zones', () => {
  // Neutralize weapon spread so the pellet flies dead straight (deterministic zone hits).
  beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0.5) })
  afterEach(() => { vi.restoreAllMocks() })

  // Read damage from the emitted event (NOT health delta) so the enemy's HP cap
  // can't clamp a one-shot headshot and hide the 4x multiplier.
  function fireDamage(zone: 'head' | 'body'): number {
    const s = new GameSession()
    placeEnemyInFront(s, zone)
    s.applyInput('local', { ...emptyInput(), yaw: s.player.rotation.y, pitch: s.player.rotation.x, shoot: true })
    const events = s.step(0.016)
    const hit = events.find((e) => e.type === 'playerHitEnemy') as any
    return hit ? hit.hit.damage : 0
  }

  it('a headshot deals 4x the body damage', () => {
    const head = fireDamage('head')
    const body = fireDamage('body')
    expect(body).toBeGreaterThan(0)
    expect(head).toBeCloseTo(body * 4, 5)
  })

  it('emits a playerHitEnemy event with the resolved zone', () => {
    const s = new GameSession()
    placeEnemyInFront(s, 'head')
    s.applyInput('local', { ...emptyInput(), yaw: s.player.rotation.y, pitch: s.player.rotation.x, shoot: true })
    const events = s.step(0.016)
    const hit = events.find((e) => e.type === 'playerHitEnemy')
    expect(hit).toBeTruthy()
    expect((hit as any).hit.zone).toBe('head')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/session/__tests__/GameSession.fire.test.ts`
Expected: FAIL — `fireLocalWeapon` is a stub; enemy health unchanged, no event.

- [ ] **Step 3: Implement `fireLocalWeapon` (replace the stub from Task 7)**

Add a reusable raycaster field to the class (near the other fields):

```typescript
  private shootRaycaster = new THREE.Raycaster()
  private cameraQuat = new THREE.Quaternion()
```

Replace `fireLocalWeapon`:

```typescript
  private fireLocalWeapon(events: SessionEvent[]): void {
    const weapon = this.weaponManager.current
    // Forward from the player's full orientation (yaw + pitch), matching the camera.
    this.cameraQuat.setFromEuler(this.player.rotation)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraQuat)
    const pellets = weapon.type === 'shotgun' ? 6 : 1
    for (let p = 0; p < pellets; p++) {
      const dir = weapon.getSpreadDirection(forward)
      this.resolveShot(this.player.position, dir, weapon.def.range, weapon.def.damage, events)
    }
  }

  private resolveShot(origin: THREE.Vector3, direction: THREE.Vector3, range: number, baseDamage: number, events: SessionEvent[]): void {
    this.shootRaycaster.set(origin, direction)
    this.shootRaycaster.far = range

    let nearest: Enemy | null = null
    let nearestDist = Infinity
    let hitObject: THREE.Object3D | null = null
    let hitPoint: THREE.Vector3 | null = null

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      const hits = this.shootRaycaster.intersectObject(enemy.mesh, true)
      if (hits.length > 0 && hits[0].distance < nearestDist) {
        nearestDist = hits[0].distance
        nearest = enemy
        hitObject = hits[0].object
        hitPoint = hits[0].point
      }
    }

    const wallDist = this.collisionWorld
      ? this.collisionWorld.segmentBlocked(origin, origin.clone().addScaledVector(direction, range))
      : null

    if (nearest && hitPoint && (wallDist === null || nearestDist < wallDist)) {
      const zone = resolveZone(hitObject)
      const damage = zonedDamage(baseDamage, zone)
      const killed = nearest.takeDamage(damage)
      events.push({
        type: 'playerHitEnemy',
        enemyType: nearest.type,
        hit: { targetId: nearest.type, zone, damage, killed, point: toVec3(hitPoint) },
      })
      if (killed) {
        this.scoreSystem.addKill(nearest.def.scoreValue)
        this.waveManager.onEnemyKilled()
        events.push({ type: 'enemyKilled', enemyType: nearest.type, pos: toVec3(nearest.mesh.position), scoreValue: nearest.def.scoreValue })
      }
      return
    }

    if (wallDist !== null) {
      events.push({ type: 'wallImpact', point: toVec3(origin.clone().addScaledVector(direction, wallDist)) })
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/session/__tests__/GameSession.fire.test.ts`
Expected: PASS (2 tests). Run `npm run test -- src/session/` to confirm all session tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/session/GameSession.ts src/session/__tests__/GameSession.fire.test.ts
git commit -m "feat: resolve shots with hitbox zones in GameSession

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Wire GameSession into App.tsx

Replace the inline `onUpdate` simulation with: build input from `Controls`, `applyInput`, `step`, then react to the returned events (effects/audio/score/React state) and sync the scene to the session's enemy/pickup arrays. This is a refactor — behavior should stay identical to today's single-player.

**Files:**
- Modify: `src/App.tsx`

**Key mechanics to preserve:**
- `Controls` no longer mutates player rotation directly; instead `App` accumulates yaw/pitch from `onMouseMove` and feeds them into the input as `yaw`/`pitch`.
- The session owns `player`, `weaponManager`, `enemies`, `waveManager`, `scoreSystem`, `pickups`, `collisionWorld`. `App` keeps references to scene/particles/audio/viewmodel and the React setState calls.
- When the session removes an enemy/pickup from its array, `App` must remove+dispose the corresponding mesh. Easiest: after `step`, reconcile the scene by tracking which meshes are present.

- [ ] **Step 1: Add session state to the data ref and a look accumulator**

In `App.tsx`, replace the `gameDataRef` initializer and add a `lookRef`:

```typescript
  const lookRef = useRef({ yaw: 0, pitch: 0 })

  const gameDataRef = useRef({
    session: new GameSession(),
    controls: null as Controls | null,
    particleSystem: null as ParticleSystem | null,
    viewmodel: null as Viewmodel | null,
    audio: new SoundEffects(new AudioManager()),
    damageIndicator: createDamageIndicatorState(),
    money: 800, // local stub for the buy store (Phase 3 makes this real)
  })
```

Add the import near the others:

```typescript
import { GameSession, ARENA_SIZE } from './session/GameSession'
import { emptyInput } from './session/protocol'
```

Remove the old local `const ARENA_SIZE = 30` (now imported) and the standalone `Player`/`WeaponManager`/`WaveManager`/`ScoreSystem`/`Pickup` field references — those live on `session`. Keep the `Pickup`/`Enemy`/`PickupType` imports (still used for typing and for the wave/pickup callbacks below).

- [ ] **Step 2: Point onMouseMove at the look accumulator**

Replace `onMouseMove`:

```typescript
    function onMouseMove(e: MouseEvent) {
      const look = lookRef.current
      look.yaw -= e.movementX * 0.002
      look.pitch -= e.movementY * 0.002
      look.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, look.pitch))
    }
```

- [ ] **Step 3: Rewire the wave/pickup callbacks onto the session**

In the `useEffect`, after `data.session.collisionWorld = createArena(engine.scene)` (see Step 5), set:

```typescript
    const session = data.session
    session.collisionWorld = createArena(engine.scene)

    session.waveManager.onEnemySpawned = (enemy) => {
      session.enemies.push(enemy)
      engine.scene.add(enemy.mesh)
    }

    session.waveManager.onWaveComplete = () => {
      session.scoreSystem.completeWave()
      setWave(session.scoreSystem.wave)
      setScore(session.scoreSystem.score)
      const pickupTypes: PickupType[] = ['health', 'ammo']
      for (let i = 0; i < 3; i++) {
        const type = pickupTypes[Math.floor(Math.random() * pickupTypes.length)]
        const pos = new THREE.Vector3((Math.random() - 0.5) * ARENA_SIZE * 1.5, 0, (Math.random() - 0.5) * ARENA_SIZE * 1.5)
        const pickup = new Pickup(type, pos)
        session.pickups.push(pickup)
        engine.scene.add(pickup.mesh)
      }
      data.audio.playWaveStart()
    }
```

- [ ] **Step 4: Replace the body of `engine.onUpdate` with session-driven flow**

```typescript
    engine.onUpdate((dt) => {
      const session = data.session
      const controls = data.controls
      const particleSystem = data.particleSystem!
      if (!controls) return

      const m = controls.getMovement()
      const input = {
        ...emptyInput(),
        forward: m.forward, backward: m.backward, left: m.left, right: m.right, jump: m.jump,
        shoot: controls.shoot,
        yaw: lookRef.current.yaw,
        pitch: lookRef.current.pitch,
      }
      session.applyInput(session.localId, input)

      const enemiesBefore = new Set(session.enemies)
      const pickupsBefore = new Set(session.pickups)

      const events = session.step(dt)

      // Camera + viewmodel + audio listener follow the player.
      engine.camera.position.copy(session.player.position)
      engine.camera.rotation.copy(session.player.rotation)
      data.audio.updateListenerPosition(session.player.position.x, session.player.position.y, session.player.position.z)
      const isMoving = m.forward || m.backward || m.left || m.right
      data.viewmodel?.update(dt, isMoving)

      for (const ev of events) {
        switch (ev.type) {
          case 'playerHitEnemy': {
            const p = ev.hit.point
            const point = new THREE.Vector3(p.x, p.y, p.z)
            if (ev.hit.killed) {
              data.particleSystem!.explosion(point, ev.enemyType)
              data.audio.playEnemyDeath(point)
            } else {
              data.particleSystem!.bloodSplatter(point)
              data.audio.playEnemyHit(point)
            }
            break
          }
          case 'enemyKilled':
            setScore(session.scoreSystem.score)
            break
          case 'wallImpact':
            data.particleSystem!.bulletImpact(new THREE.Vector3(ev.point.x, ev.point.y, ev.point.z))
            break
          case 'enemyShoot': {
            const from = new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z)
            const to = new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z)
            data.audio.playWeaponShoot('rifle', from)
            particleSystem.tracer(from, to)
            if (ev.hit) {
              data.audio.playPlayerHit()
              setHealth(session.player.health)
              data.damageIndicator = triggerDamage(from.clone(), session.player.position.clone(), session.player.rotation.y)
              setDamageIndicator({ ...data.damageIndicator })
            }
            break
          }
          case 'enemyMelee':
            data.audio.playPlayerHit()
            setHealth(session.player.health)
            data.damageIndicator = triggerDamage(
              new THREE.Vector3(ev.enemyPos.x, ev.enemyPos.y, ev.enemyPos.z), session.player.position.clone(), session.player.rotation.y)
            setDamageIndicator({ ...data.damageIndicator })
            break
          case 'enemyTelegraph':
            particleSystem.muzzleFlash(
              new THREE.Vector3(ev.enemyPos.x, 1.35, ev.enemyPos.z),
              new THREE.Vector3(ev.facing.x, ev.facing.y, ev.facing.z))
            break
          case 'pickup':
            if (ev.pickupType === 'health') setHealth(session.player.health)
            data.audio.playPickup()
            break
          case 'playerDied':
            document.exitPointerLock()
            data.audio.playPlayerDeath()
            session.scoreSystem.saveHighScore()
            setHighScore(session.scoreSystem.highScore)
            engine.stop()
            updateGameState('gameover')
            return
        }
      }

      // Player fire feedback (muzzle flash + recoil + sound) — fired this frame iff fireTimer was just reset.
      if (controls.shoot && session.weaponManager.current.fireTimer > session.weaponManager.current.def.fireRate - dt) {
        data.viewmodel?.fire()
        data.audio.playWeaponShoot(session.weaponManager.current.type, session.player.position)
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(engine.camera.quaternion)
        particleSystem.muzzleFlash(session.player.position.clone().add(fwd), fwd)
      }

      // Reconcile removed enemies/pickups → dispose their meshes.
      for (const e of enemiesBefore) {
        if (!session.enemies.includes(e)) { engine.scene.remove(e.mesh); e.dispose() }
      }
      for (const pk of pickupsBefore) {
        if (!session.pickups.includes(pk)) { engine.scene.remove(pk.mesh); pk.dispose() }
      }

      // React HUD state.
      setAmmo(session.weaponManager.current.ammo)
      setWeaponName(session.weaponManager.current.def.name)
      setWaveActive(session.waveManager.waveActive)
      setWave(session.waveManager.currentWave)
      setEnemiesRemaining(session.waveManager.enemiesRemaining)
      if (session.waveManager.currentWave > lastWaveRef.current) {
        lastWaveRef.current = session.waveManager.currentWave
        setShowWaveAnnounce(true)
        setTimeout(() => setShowWaveAnnounce(false), 2600)
      }
      setEnemyPositions(session.enemies.map(e => e.mesh.position.clone()))
      setPlayerPos(session.player.position.clone())
      setPlayerRot(session.player.rotation.y)

      particleSystem.update(dt)
      data.damageIndicator = updateDamageIndicator(data.damageIndicator, dt)
      if (data.damageIndicator.active) setDamageIndicator({ ...data.damageIndicator })
      else if (damageIndicator !== null) setDamageIndicator(null)
    })
```

> The "player fire feedback" heuristic (`fireTimer >= fireRate - dt`) detects that the weapon fired this frame because `step` set `fireTimer = def.fireRate` during this tick. Delete the old inline `checkHit` function and its `shootRaycaster` — hit resolution now lives in `GameSession`.

- [ ] **Step 5: Update `startGame` to reset the session**

Replace the body of `startGame` to rebuild the session and reset look:

```typescript
  const startGame = useCallback(() => {
    const data = gameDataRef.current
    const scene = engineRef.current?.scene
    for (const enemy of data.session.enemies) { scene?.remove(enemy.mesh); enemy.dispose() }
    for (const pickup of data.session.pickups) { scene?.remove(pickup.mesh); pickup.dispose() }

    const fresh = new GameSession()
    fresh.collisionWorld = data.session.collisionWorld
    fresh.waveManager.onEnemySpawned = data.session.waveManager.onEnemySpawned
    fresh.waveManager.onWaveComplete = data.session.waveManager.onWaveComplete
    fresh.waveManager.wavePauseTimer = 2 // 2s grace before wave 1 (WaveManager defaults this to 0)
    data.session = fresh
    lookRef.current = { yaw: 0, pitch: 0 }
    data.money = 800

    if (data.particleSystem) data.particleSystem.clear()
    data.damageIndicator = createDamageIndicatorState()

    setScore(0); setWave(0); setHealth(100); setAmmo(60); setWeaponName('Pistol')
    data.viewmodel?.setWeapon('pistol')
    setWaveActive(false); setEnemiesRemaining(0); setEnemyPositions([]); setDamageIndicator(null)

    engineRef.current?.start()
    data.audio.init(); data.audio.loadSounds()
    updateGameState('playing')
  }, [updateGameState])
```

> Because the callbacks capture the wrong `session` after a restart, also update the two `onEnemySpawned`/`onWaveComplete` closures (Step 3) to reference `data.session` dynamically instead of a captured `session` const. Change them to `gameDataRef.current.session` inside the callback bodies, e.g. `gameDataRef.current.session.enemies.push(enemy)`.

- [ ] **Step 6: Update HUD `maxAmmo` reference**

In the JSX, change `gameDataRef.current.weaponManager.current.def.maxAmmo` to `gameDataRef.current.session.weaponManager.current.def.maxAmmo`.

- [ ] **Step 7: Type-check and run the full unit suite**

Run: `npm run build`
Expected: `tsc -b` passes with no type errors.

Run: `npm run test`
Expected: all unit tests PASS.

- [ ] **Step 8: Run the existing E2E regression suite**

Run: `npm run test:e2e`
Expected: existing `e2e/game.spec.ts` tests PASS (menu loads, start, HUD, minimap, pause/resume/menu) — single-player behavior unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: drive the game loop through GameSession

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Tab weapon switch

Add `cycleNext()` to `WeaponManager`, a `Tab` handler in `Controls` that calls `preventDefault()`, and wire it in `App`.

**Files:**
- Modify: `src/weapons/WeaponManager.ts`
- Modify: `src/player/Controls.ts`
- Modify: `src/App.tsx`
- Test: `src/weapons/__tests__/WeaponManager.cycle.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/weapons/__tests__/WeaponManager.cycle.test.ts
import { describe, it, expect } from 'vitest'
import { WeaponManager } from '../WeaponManager'

describe('WeaponManager.cycleNext', () => {
  it('advances to the next weapon and wraps around', () => {
    const m = new WeaponManager()
    expect(m.current.type).toBe('pistol')
    m.cycleNext(); expect(m.current.type).toBe('shotgun')
    m.cycleNext(); expect(m.current.type).toBe('rifle')
    m.cycleNext(); expect(m.current.type).toBe('pistol')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/weapons/__tests__/WeaponManager.cycle.test.ts`
Expected: FAIL — `cycleNext` is not a function.

- [ ] **Step 3: Implement `cycleNext`**

In `src/weapons/WeaponManager.ts`, add the method:

```typescript
  cycleNext() {
    this.currentIndex = (this.currentIndex + 1) % this.weapons.length
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/weapons/__tests__/WeaponManager.cycle.test.ts`
Expected: PASS.

- [ ] **Step 5: Add Tab + B callbacks to Controls**

In `src/player/Controls.ts`, add public callback fields near `onMouseMove`:

```typescript
  onCycleWeapon: (() => void) | null = null
  onToggleStore: (() => void) | null = null
```

Extend `onKeyDown` with Tab and B (both `preventDefault` to stop browser focus/quick-find):

```typescript
  private onKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW': this.forward = true; break
      case 'KeyS': this.backward = true; break
      case 'KeyA': this.left = true; break
      case 'KeyD': this.right = true; break
      case 'Space': this.jump = true; break
      case 'Tab': e.preventDefault(); this.onCycleWeapon?.(); break
      case 'KeyB': e.preventDefault(); this.onToggleStore?.(); break
    }
  }
```

- [ ] **Step 6: Wire the Tab callback in App**

In `App.tsx`, where `data.controls` is created in the `useEffect`, after `data.controls.onMouseMove = onMouseMove`, add:

```typescript
    data.controls.onCycleWeapon = () => {
      if (gameStateRef.current !== 'playing') return
      const wm = gameDataRef.current.session.weaponManager
      wm.cycleNext()
      setWeaponName(wm.current.def.name)
      setAmmo(wm.current.ammo)
      gameDataRef.current.viewmodel?.setWeapon(wm.current.type)
    }
```

- [ ] **Step 7: Add a Playwright test for Tab cycling**

```typescript
// e2e/weapon-switch.spec.ts
import { test, expect } from '@playwright/test'

test('Tab cycles the active weapon', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'START GAME' }).click()
  await expect(page.getByText('Pistol')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByText('Shotgun')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByText('Rifle')).toBeVisible()
})
```

- [ ] **Step 8: Run tests**

Run: `npm run test -- src/weapons/__tests__/WeaponManager.cycle.test.ts`
Expected: PASS.
Run: `npm run test:e2e -- weapon-switch`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/weapons/WeaponManager.ts src/player/Controls.ts src/App.tsx src/weapons/__tests__/WeaponManager.cycle.test.ts e2e/weapon-switch.spec.ts
git commit -m "feat: cycle weapons with Tab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: B buy-store overlay with local money stub

A React overlay listing the three weapons with prices and the player's money. Opening it (B) unlocks the pointer and suppresses fire; buying within budget switches to that weapon and deducts money. Round-gating + real economy are Phase 3.

**Files:**
- Create: `src/ui/BuyMenu.tsx`
- Create: `src/weapons/StoreCatalog.ts`
- Modify: `src/App.tsx`
- Test: `src/weapons/__tests__/StoreCatalog.test.ts`

- [ ] **Step 1: Write the failing test for the buy logic**

```typescript
// src/weapons/__tests__/StoreCatalog.test.ts
import { describe, it, expect } from 'vitest'
import { STORE_CATALOG, canAfford } from '../StoreCatalog'

describe('StoreCatalog', () => {
  it('lists the three weapons with prices', () => {
    const types = STORE_CATALOG.map((i) => i.type)
    expect(types).toEqual(['pistol', 'shotgun', 'rifle'])
    for (const item of STORE_CATALOG) expect(item.price).toBeGreaterThan(0)
  })

  it('canAfford compares money to price', () => {
    expect(canAfford(800, 'rifle')).toBe(true)
    expect(canAfford(100, 'rifle')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/weapons/__tests__/StoreCatalog.test.ts`
Expected: FAIL — cannot find module `../StoreCatalog`.

- [ ] **Step 3: Implement the catalog**

```typescript
// src/weapons/StoreCatalog.ts
import type { WeaponType } from '../types'
import { WEAPON_DEFS } from './WeaponDefs'

export interface StoreItem {
  type: WeaponType
  name: string
  price: number
}

export const STORE_CATALOG: StoreItem[] = [
  { type: 'pistol', name: WEAPON_DEFS.pistol.name, price: 200 },
  { type: 'shotgun', name: WEAPON_DEFS.shotgun.name, price: 1200 },
  { type: 'rifle', name: WEAPON_DEFS.rifle.name, price: 2700 },
]

export function canAfford(money: number, type: WeaponType): boolean {
  const item = STORE_CATALOG.find((i) => i.type === type)
  return !!item && money >= item.price
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/weapons/__tests__/StoreCatalog.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the BuyMenu component**

```tsx
// src/ui/BuyMenu.tsx
import { STORE_CATALOG, canAfford } from '../weapons/StoreCatalog'
import type { WeaponType } from '../types'

interface BuyMenuProps {
  money: number
  onBuy: (type: WeaponType) => void
  onClose: () => void
}

export function BuyMenu({ money, onBuy, onClose }: BuyMenuProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', zIndex: 50, fontFamily: 'monospace', color: '#fff',
    }}>
      <div style={{ background: '#15151f', border: '1px solid #3a3a55', padding: 24, minWidth: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>BUY MENU</h2>
          <span>${money}</span>
        </div>
        {STORE_CATALOG.map((item) => {
          const affordable = canAfford(money, item.type)
          return (
            <button
              key={item.type}
              disabled={!affordable}
              onClick={() => onBuy(item.type)}
              style={{
                display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 14px',
                margin: '6px 0', background: affordable ? '#23233a' : '#1a1a24',
                color: affordable ? '#fff' : '#666', border: '1px solid #3a3a55', cursor: affordable ? 'pointer' : 'not-allowed',
              }}
            >
              <span>{item.name}</span>
              <span>${item.price}</span>
            </button>
          )
        })}
        <button onClick={onClose} style={{ marginTop: 16, width: '100%', padding: 10, background: '#3a3a55', color: '#fff', border: 'none', cursor: 'pointer' }}>
          CLOSE (B)
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Wire BuyMenu into App**

In `App.tsx` add state and the toggle/buy handlers. Add near the other `useState` calls:

```typescript
  const [storeOpen, setStoreOpen] = useState(false)
  const [money, setMoney] = useState(16000)
```

(The Phase-1 money stub is 16000 — CS max money — so every weapon in the catalog is affordable for the demo. The round-gated real economy in Phase 3 replaces this.)

After `data.controls.onCycleWeapon = ...` (Task 10, Step 6), add the store toggle:

```typescript
    data.controls.onToggleStore = () => {
      if (gameStateRef.current !== 'playing') return
      setStoreOpen((open) => {
        const next = !open
        if (next) document.exitPointerLock()
        return next
      })
    }
```

While the store is open, fire must be suppressed. In the `onUpdate` input assembly (Task 9, Step 4), gate `shoot`:

```typescript
        shoot: controls.shoot && !storeOpenRef.current,
```

Add a ref mirroring `storeOpen` (state isn't readable inside the stable `onUpdate` closure):

```typescript
  const storeOpenRef = useRef(false)
```

And keep it in sync — add an effect:

```typescript
  useEffect(() => { storeOpenRef.current = storeOpen }, [storeOpen])
```

Render the overlay in the `playing` block of the JSX:

```tsx
      {gameState === 'playing' && storeOpen && (
        <BuyMenu
          money={money}
          onBuy={(type) => {
            const data = gameDataRef.current
            const item = STORE_CATALOG.find(i => i.type === type)!
            if (data.money >= item.price) {
              data.money -= item.price
              setMoney(data.money)
              data.session.weaponManager.switchTo(type)
              setWeaponName(data.session.weaponManager.current.def.name)
              setAmmo(data.session.weaponManager.current.ammo)
              data.viewmodel?.setWeapon(type)
            }
            setStoreOpen(false)
          }}
          onClose={() => setStoreOpen(false)}
        />
      )}
```

Add imports:

```typescript
import { BuyMenu } from './ui/BuyMenu'
import { STORE_CATALOG } from './weapons/StoreCatalog'
```

Reset money in `startGame` (Task 9, Step 5): change the existing `data.money = 800` line to `data.money = 16000`, and add `setMoney(16000)` and `setStoreOpen(false)` alongside the other resets. (Also update the `money: 800` field in the `gameDataRef` initializer to `money: 16000` for consistency.)

- [ ] **Step 7: Add a Playwright test for the store**

```typescript
// e2e/buy-menu.spec.ts
import { test, expect } from '@playwright/test'

test('B opens the buy menu and buying switches weapon', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'START GAME' }).click()
  await expect(page.getByText('Pistol')).toBeVisible()
  await page.keyboard.press('b')
  await expect(page.getByText('BUY MENU')).toBeVisible()
  await page.getByRole('button', { name: /Rifle/ }).click()
  await expect(page.getByText('BUY MENU')).not.toBeVisible()
  await expect(page.getByText('Rifle')).toBeVisible()
})

test('B closes the buy menu again', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'START GAME' }).click()
  await page.keyboard.press('b')
  await expect(page.getByText('BUY MENU')).toBeVisible()
  await page.keyboard.press('b')
  await expect(page.getByText('BUY MENU')).not.toBeVisible()
})
```

- [ ] **Step 8: Run tests and type-check**

Run: `npm run test`
Expected: all unit tests PASS.
Run: `npm run build`
Expected: no type errors.
Run: `npm run test:e2e -- buy-menu`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ui/BuyMenu.tsx src/weapons/StoreCatalog.ts src/weapons/__tests__/StoreCatalog.test.ts src/App.tsx e2e/buy-menu.spec.ts
git commit -m "feat: add B buy-store overlay with local money stub

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] Run the full unit suite: `npm run test` — all green.
- [ ] Type-check/build: `npm run build` — no errors.
- [ ] Run all E2E: `npm run test:e2e` — existing + new specs green.
- [ ] Manual smoke (`npm run dev`): start game, shoot a bot in the head (more damage / faster kill than body shots), press Tab to cycle Pistol→Shotgun→Rifle, press B to open/buy/close the store, confirm focus stays on the canvas (Tab doesn't move focus).

---

## Spec coverage check

- GameSession + loopback transport + protocol → Tasks 4–9. ✅
- Head/body/legs zones on bots + damage multipliers → Tasks 1, 2, 8. ✅
- Shared zoned CharacterModel (player variant for Phase 2) → Task 3. ✅
- Tab weapon switch (with preventDefault) → Task 10. ✅
- B buy-store shell + local money stub → Task 11. ✅
- Existing single-player behavior preserved → Task 9 Steps 7–8 (build + E2E regression). ✅
- Non-goals (networking, rounds, teams, earning money, co-op bots) → not implemented, deferred. ✅
