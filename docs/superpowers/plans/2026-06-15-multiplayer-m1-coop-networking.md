# Multiplayer M1 — Co-op Networking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two players host/join a room by code over WebRTC and play co-op against the existing bot waves, seeing each other in-world; clients render authoritative host snapshots (interpolation only, no prediction yet).

**Architecture:** The host runs the single authoritative `GameSession`, extended to simulate multiple players. A `PeerTransport` (built on `peerjs`) carries `NetMessage`s; `NetHost` ingests client input + broadcasts snapshots, `NetClient` sends input + applies snapshots. The whole `NetHost`+`NetClient` loop is tested in-process over a linked loopback transport pair — no real WebRTC in CI. Single-player keeps running the same `GameSession` locally (one player), unchanged.

**Tech Stack:** React 19, Three.js r170, TypeScript 5.6, Vite 6, Vitest 3, Playwright, `peerjs`.

**Reference spec:** `docs/superpowers/specs/2026-06-15-multiplayer-networking-design.md` (Milestone M1).

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `src/session/protocol.ts` | **Modify.** Add `GameMode`; extend `EntityState` (pitch/weaponType/name); add `join`/`welcome`/`playerJoined`/`playerLeft` to `NetMessage`. |
| `src/session/Transport.ts` | **Modify.** Add `createLinkedTransports()` — a cross-wired pair (no self-echo) for testing host↔client. |
| `src/session/GameSession.ts` | **Modify.** Multiple players via a `players` map + `addPlayer`/`removePlayer`; per-player movement/shooting; enemies target nearest living player; snapshot emits all players with pitch/weapon/name. Backward-compatible `player`/`weaponManager` getters keep single-player identical. |
| `src/net/NetHost.ts` | **Create.** Owns a `GameSession`; registers client links; ingests input; `tick(dt)` steps + broadcasts snapshot; handles join/leave. |
| `src/net/NetClient.ts` | **Create.** Joins, sends input, receives `welcome`/`snapshot`; exposes `playerId` + latest snapshot. |
| `src/net/PeerConnection.ts` | **Create.** Wraps a single `peerjs` `DataConnection` as a `Transport`. |
| `src/net/PeerHost.ts`, `src/net/PeerClient.ts` | **Create.** PeerJS `Peer` lifecycle: host advertises room code + emits per-client transports; client dials a code and resolves a transport. |
| `src/net/RemotePlayer.ts` | **Create.** Renders one remote player (`buildCharacter`) with position/yaw interpolation between snapshots. |
| `src/net/RemotePlayerManager.ts` | **Create.** Reconciles a snapshot's player list against live `RemotePlayer` meshes (add/update/remove). |
| `src/ui/MainMenu.tsx` | **Modify.** Singleplayer vs Multiplayer choice. |
| `src/ui/MultiplayerMenu.tsx` | **Create.** Host (show/copy room code) or Join (enter code) → lobby (player list) → host Start. |
| `src/App.tsx` | **Modify.** Orchestrate three roles (singleplayer / host / client); render remote players from snapshots. |
| `e2e/multiplayer.spec.ts` | **Create.** Two browser contexts: join by code, see each other move. |

---

## Task 1: Add `peerjs` dependency + `GameMode` type

**Files:**
- Modify: `package.json`
- Modify: `src/session/protocol.ts`
- Test: `src/session/__tests__/protocol.test.ts`

- [ ] **Step 1: Install peerjs**

Run:
```bash
npm install peerjs@^1.5.4
```
Expected: `package.json` `dependencies` gains `"peerjs": "^1.5.4"`; `package-lock.json` updates; exit 0.

- [ ] **Step 2: Write the failing test for `GameMode`**

Append to `src/session/__tests__/protocol.test.ts`:
```ts
import { GAME_MODES } from '../protocol'

describe('GameMode', () => {
  it('lists coop and pvp', () => {
    expect(GAME_MODES).toEqual(['coop', 'pvp'])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/protocol.test.ts`
Expected: FAIL — `GAME_MODES` is not exported.

- [ ] **Step 4: Add the type + constant**

In `src/session/protocol.ts`, after the imports:
```ts
export type GameMode = 'coop' | 'pvp'
export const GAME_MODES: readonly GameMode[] = ['coop', 'pvp'] as const
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/protocol.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/session/protocol.ts src/session/__tests__/protocol.test.ts
git commit -m "feat: add peerjs dependency and GameMode type"
```

---

## Task 2: Extend protocol wire types

**Files:**
- Modify: `src/session/protocol.ts`
- Test: `src/session/__tests__/protocol.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/session/__tests__/protocol.test.ts`:
```ts
import type { EntityState, NetMessage } from '../protocol'

describe('extended protocol', () => {
  it('EntityState carries optional pitch/weapon/name', () => {
    const s: EntityState = {
      id: 'player-1', kind: 'player', type: 'player',
      position: { x: 0, y: 2, z: 0 }, rotationY: 0,
      rotationX: 0.2, weaponType: 'rifle', name: 'Ann',
      health: 100, isDead: false,
    }
    expect(s.weaponType).toBe('rifle')
    expect(s.name).toBe('Ann')
  })

  it('NetMessage includes join/welcome/playerJoined/playerLeft', () => {
    const msgs: NetMessage[] = [
      { type: 'join', name: 'Ann' },
      { type: 'welcome', playerId: 'player-1', mode: 'coop' },
      { type: 'playerJoined', playerId: 'player-1', name: 'Ann' },
      { type: 'playerLeft', playerId: 'player-1' },
    ]
    expect(msgs).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/protocol.test.ts`
Expected: FAIL — TypeScript type errors (extra properties / unknown message types).

- [ ] **Step 3: Extend `EntityState` and `NetMessage`**

In `src/session/protocol.ts`, replace the `EntityState` interface with:
```ts
export interface EntityState {
  id: string
  kind: 'player' | 'enemy'
  type: string
  position: Vec3
  rotationY: number
  rotationX?: number   // pitch (players only; remote aim)
  health: number
  isDead: boolean
  weaponType?: string  // players only; for remote weapon model
  name?: string        // players only; nameplate
}
```

Replace the `NetMessage` union with:
```ts
/** Network envelope carried by Transport. */
export type NetMessage =
  | { type: 'input'; playerId: string; input: PlayerInput }
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'join'; name: string }
  | { type: 'welcome'; playerId: string; mode: GameMode }
  | { type: 'playerJoined'; playerId: string; name: string }
  | { type: 'playerLeft'; playerId: string }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/protocol.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session/protocol.ts src/session/__tests__/protocol.test.ts
git commit -m "feat: extend protocol with player aim/weapon/name and lobby messages"
```

---

## Task 3: `GameSession` — internal players map with backward-compatible getters

This refactor must NOT change single-player behavior. `player` and `weaponManager` become getters onto the local player entity.

**Files:**
- Modify: `src/session/GameSession.ts`
- Test: `src/session/__tests__/GameSession.players.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/session/__tests__/GameSession.players.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { GameSession } from '../GameSession'

describe('GameSession players map', () => {
  it('seeds exactly the local player', () => {
    const s = new GameSession()
    expect(s.playerIds()).toEqual([s.localId])
  })

  it('player/weaponManager getters point at the local entity', () => {
    const s = new GameSession()
    expect(s.player).toBe(s.getPlayer(s.localId)!.player)
    expect(s.weaponManager).toBe(s.getPlayer(s.localId)!.weapons)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/GameSession.players.test.ts`
Expected: FAIL — `playerIds`/`getPlayer` not defined.

- [ ] **Step 3: Introduce the players map + getters**

In `src/session/GameSession.ts`, replace the top of the class (the `player`/`weaponManager` fields and the `inputs` map line) with:
```ts
export interface PlayerEntity {
  id: string
  name: string
  player: Player
  weapons: WeaponManager
}

export class GameSession {
  readonly localId = LOCAL_ID
  private playerMap = new Map<string, PlayerEntity>()
  enemies: Enemy[] = []
  waveManager = new WaveManager()
  scoreSystem = new ScoreSystem()
  pickups: Pickup[] = []
  collisionWorld: CollisionWorld | null = null
  tick = 0

  private shootRaycaster = new THREE.Raycaster()
  private cameraQuat = new THREE.Quaternion()
  private inputs = new Map<string, PlayerInput>()

  constructor() {
    this.addPlayer(LOCAL_ID, 'You')
  }

  addPlayer(id: string, name: string): PlayerEntity {
    const entity: PlayerEntity = { id, name, player: new Player(), weapons: new WeaponManager() }
    this.playerMap.set(id, entity)
    this.inputs.set(id, emptyInput())
    return entity
  }

  removePlayer(id: string): void {
    this.playerMap.delete(id)
    this.inputs.delete(id)
  }

  getPlayer(id: string): PlayerEntity | undefined {
    return this.playerMap.get(id)
  }

  playerIds(): string[] {
    return [...this.playerMap.keys()]
  }

  /** Backward-compatible accessors for the local player (single-player code paths). */
  get player(): Player {
    return this.playerMap.get(LOCAL_ID)!.player
  }

  get weaponManager(): WeaponManager {
    return this.playerMap.get(LOCAL_ID)!.weapons
  }
```

Remove the old field declarations `player = new Player()` and `weaponManager = new WeaponManager()` and the old inline `inputs = new Map(...)` initializer (now set in the constructor / `addPlayer`).

- [ ] **Step 4: Run the test + the full suite**

Run: `npx vitest run src/session/__tests__/GameSession.players.test.ts && npx vitest run`
Expected: the new test PASSES, and **all existing tests still pass** (single-player behavior is preserved by the getters). If any existing test references `session.player =` (assignment), convert it to mutate `session.player.position`/`.rotation` instead — assignment to the getter is no longer valid.

- [ ] **Step 5: Commit**

```bash
git add src/session/GameSession.ts src/session/__tests__/GameSession.players.test.ts
git commit -m "refactor: GameSession holds players in a map with local-player getters"
```

---

## Task 4: `GameSession.step` — simulate every player's movement

**Files:**
- Modify: `src/session/GameSession.ts`
- Test: `src/session/__tests__/GameSession.players.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/session/__tests__/GameSession.players.test.ts`:
```ts
import { emptyInput } from '../protocol'

describe('GameSession multi-player movement', () => {
  it('moves a second player independently of the local player', () => {
    const s = new GameSession()
    s.addPlayer('player-2', 'Bob')
    const before = s.getPlayer('player-2')!.player.position.z

    // player-2 holds forward; local player holds nothing.
    s.applyInput('player-2', { ...emptyInput(), forward: true })
    s.step(0.1)

    const after = s.getPlayer('player-2')!.player.position.z
    expect(after).toBeLessThan(before)            // moved along -Z (forward)
    expect(s.player.position.z).toBeCloseTo(2 < 0 ? 0 : s.player.position.z) // local unchanged on z by input
    expect(s.player.position.x).toBeCloseTo(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/GameSession.players.test.ts`
Expected: FAIL — `step` only moves the single local player.

- [ ] **Step 3: Loop player movement over all entities**

In `src/session/GameSession.ts`, replace the player look/movement/weapon block at the start of `step` (the lines from `const input = this.getInput(LOCAL_ID)` through the `fireLocalWeapon(events)` call) with a per-player loop:
```ts
    // Advance every player: look, movement+collision, weapons, shooting.
    for (const entity of this.playerMap.values()) {
      const input = this.getInput(entity.id)
      const player = entity.player
      player.rotation.y = input.yaw
      player.rotation.x = THREE.MathUtils.clamp(input.pitch, -Math.PI / 2, Math.PI / 2)
      player.update(dt, input, ARENA_SIZE)
      if (this.collisionWorld) this.collisionWorld.resolve(player.position, 0.5)

      entity.weapons.update(dt)
      if (input.shoot && entity.weapons.current.canShoot()) {
        entity.weapons.current.shoot()
        this.fireWeapon(entity, events)
      }
    }
```

Rename `fireLocalWeapon` to `fireWeapon(entity: PlayerEntity, events: SessionEvent[])` and update its body to use the entity:
```ts
  private fireWeapon(entity: PlayerEntity, events: SessionEvent[]): void {
    const weapon = entity.weapons.current
    this.cameraQuat.setFromEuler(entity.player.rotation)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraQuat)
    const pellets = weapon.type === 'shotgun' ? 6 : 1
    for (let p = 0; p < pellets; p++) {
      const dir = weapon.getSpreadDirection(forward)
      this.resolveShot(entity.player.position, dir, weapon.def.range, weapon.def.damage, events)
    }
  }
```

- [ ] **Step 4: Run the test + full suite**

Run: `npx vitest run src/session/__tests__/GameSession.players.test.ts && npx vitest run`
Expected: new test PASSES; existing fire/step tests still PASS (local player still simulated, now via the loop).

- [ ] **Step 5: Commit**

```bash
git add src/session/GameSession.ts src/session/__tests__/GameSession.players.test.ts
git commit -m "feat: GameSession steps every player's movement and shooting"
```

---

## Task 5: Enemies target nearest living player; snapshot emits all players

**Files:**
- Modify: `src/session/GameSession.ts`
- Test: `src/session/__tests__/GameSession.players.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/session/__tests__/GameSession.players.test.ts`:
```ts
describe('GameSession multi-player snapshot + targeting', () => {
  it('snapshot lists every player with pitch, weapon and name', () => {
    const s = new GameSession()
    s.addPlayer('player-2', 'Bob')
    s.applyInput('player-2', { ...emptyInput(), yaw: 1, pitch: 0.3 })
    s.step(0.016)

    const snap = s.getSnapshot()
    const ids = snap.players.map(p => p.id).sort()
    expect(ids).toEqual([s.localId, 'player-2'])
    const bob = snap.players.find(p => p.id === 'player-2')!
    expect(bob.name).toBe('Bob')
    expect(bob.weaponType).toBe(s.getPlayer('player-2')!.weapons.current.type)
    expect(bob.rotationX).toBeCloseTo(0.3, 5)
  })

  it('nearestPlayer returns the closest living player to a point', () => {
    const s = new GameSession()
    s.addPlayer('player-2', 'Bob')
    s.getPlayer('player-2')!.player.position.set(10, 2, 0)
    const near = s.nearestPlayer(new THREE.Vector3(9, 2, 0))
    expect(near?.id).toBe('player-2')
  })
})
```
(Add `import * as THREE from 'three'` at the top of the test file if not present.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/GameSession.players.test.ts`
Expected: FAIL — `getSnapshot` emits only the local player; `nearestPlayer` undefined.

- [ ] **Step 3: Add `nearestPlayer`, update `getSnapshot`, retarget enemies**

In `src/session/GameSession.ts`, add the helper:
```ts
  nearestPlayer(point: THREE.Vector3): PlayerEntity | null {
    let best: PlayerEntity | null = null
    let bestDist = Infinity
    for (const entity of this.playerMap.values()) {
      if (entity.player.isDead) continue
      const d = entity.player.position.distanceToSquared(point)
      if (d < bestDist) { bestDist = d; best = entity }
    }
    return best
  }
```

Replace the `players` array build in `getSnapshot` with:
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
    }))
```

In `step`, the enemy loop currently uses `player.position` / `player.takeDamage`. Replace those references inside the enemy loop so each enemy targets the nearest player:
```ts
      const target = this.nearestPlayer(enemy.mesh.position)
      if (!target) break
      const targetPlayer = target.player
      const action = enemy.update(dt, targetPlayer.position, this.collisionWorld ?? undefined)
```
and within the same loop replace the three `player.takeDamage(...)`/`player.position`/`player.isDead` usages with `targetPlayer.*`. For the death event, only end the run when the **local** player dies:
```ts
        if (targetPlayer.isDead) {
          if (target.id === this.localId) {
            events.push({ type: 'playerDied' })
            return events
          }
        }
```
Replace the pickups loop's `player` references with the local player (`const localPlayer = this.player`) — pickups remain local-player-only in M1.

- [ ] **Step 4: Run the test + full suite**

Run: `npx vitest run src/session/__tests__/GameSession.players.test.ts && npx vitest run`
Expected: new tests PASS; existing tests PASS (single player ⇒ nearest is always local).

- [ ] **Step 5: Commit**

```bash
git add src/session/GameSession.ts src/session/__tests__/GameSession.players.test.ts
git commit -m "feat: enemies target nearest player; snapshot emits all players"
```

---

## Task 6: Linked transport pair for testing

**Files:**
- Modify: `src/session/Transport.ts`
- Test: `src/session/__tests__/Transport.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/session/__tests__/Transport.test.ts`:
```ts
import { createLinkedTransports } from '../Transport'

describe('createLinkedTransports', () => {
  it('delivers a.send to b only (no self-echo)', () => {
    const [a, b] = createLinkedTransports()
    const aGot: unknown[] = []
    const bGot: unknown[] = []
    a.onMessage(m => aGot.push(m))
    b.onMessage(m => bGot.push(m))

    a.send({ type: 'join', name: 'Ann' })
    expect(bGot).toEqual([{ type: 'join', name: 'Ann' }])
    expect(aGot).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/Transport.test.ts`
Expected: FAIL — `createLinkedTransports` not exported.

- [ ] **Step 3: Implement the linked pair**

In `src/session/Transport.ts`, add:
```ts
/** Two cross-wired endpoints: each one's send() reaches only the other's handlers. */
export function createLinkedTransports(): [Transport, Transport] {
  const aHandlers: ((msg: NetMessage) => void)[] = []
  const bHandlers: ((msg: NetMessage) => void)[] = []
  const a: Transport = {
    send: (msg) => bHandlers.forEach(h => h(msg)),
    onMessage: (cb) => { aHandlers.push(cb) },
  }
  const b: Transport = {
    send: (msg) => aHandlers.forEach(h => h(msg)),
    onMessage: (cb) => { bHandlers.push(cb) },
  }
  return [a, b]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/Transport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session/Transport.ts src/session/__tests__/Transport.test.ts
git commit -m "test: add createLinkedTransports for host/client tests"
```

---

## Task 7: `NetHost`

**Files:**
- Create: `src/net/NetHost.ts`
- Test: `src/net/__tests__/NetHost.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/net/__tests__/NetHost.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { GameSession } from '../../session/GameSession'
import { createLinkedTransports } from '../../session/Transport'
import { emptyInput, type NetMessage } from '../../session/protocol'
import { NetHost } from '../NetHost'

describe('NetHost', () => {
  it('registers a client, sends welcome, and applies its input', () => {
    const session = new GameSession()
    const host = new NetHost(session, 'coop')
    const [hostSide, clientSide] = createLinkedTransports()
    const got: NetMessage[] = []
    clientSide.onMessage(m => got.push(m))

    host.addClient('player-2', 'Bob', hostSide)
    expect(got).toContainEqual({ type: 'welcome', playerId: 'player-2', mode: 'coop' })
    expect(session.playerIds()).toContain('player-2')

    clientSide.send({ type: 'input', playerId: 'player-2', input: { ...emptyInput(), forward: true } })
    const z0 = session.getPlayer('player-2')!.player.position.z
    host.tick(0.1)
    expect(session.getPlayer('player-2')!.player.position.z).toBeLessThan(z0)
  })

  it('tick broadcasts a snapshot to clients', () => {
    const session = new GameSession()
    const host = new NetHost(session, 'coop')
    const [hostSide, clientSide] = createLinkedTransports()
    const got: NetMessage[] = []
    clientSide.onMessage(m => got.push(m))
    host.addClient('player-2', 'Bob', hostSide)

    host.tick(0.016)
    expect(got.some(m => m.type === 'snapshot')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/NetHost.test.ts`
Expected: FAIL — module `../NetHost` not found.

- [ ] **Step 3: Implement `NetHost`**

Create `src/net/NetHost.ts`:
```ts
import type { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { GameMode, NetMessage, SessionEvent } from '../session/protocol'

interface ClientLink { playerId: string; transport: Transport }

/** Host-authoritative driver: owns the session, ingests client input, broadcasts snapshots. */
export class NetHost {
  private links: ClientLink[] = []

  constructor(private session: GameSession, private mode: GameMode) {}

  addClient(playerId: string, name: string, transport: Transport): void {
    this.session.addPlayer(playerId, name)
    transport.onMessage((msg) => {
      if (msg.type === 'input' && msg.playerId === playerId) {
        this.session.applyInput(playerId, msg.input)
      }
    })
    transport.send({ type: 'welcome', playerId, mode: this.mode })
    this.links.push({ playerId, transport })
    this.broadcast({ type: 'playerJoined', playerId, name })
  }

  removeClient(playerId: string): void {
    this.links = this.links.filter(l => l.playerId !== playerId)
    this.session.removePlayer(playerId)
    this.broadcast({ type: 'playerLeft', playerId })
  }

  /** Advance the authoritative sim one step and broadcast the resulting snapshot. */
  tick(dt: number): SessionEvent[] {
    const events = this.session.step(dt)
    const snapshot = this.session.getSnapshot()
    this.broadcast({ type: 'snapshot', snapshot })
    return events
  }

  private broadcast(msg: NetMessage): void {
    for (const link of this.links) link.transport.send(msg)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/NetHost.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/net/NetHost.ts src/net/__tests__/NetHost.test.ts
git commit -m "feat: add NetHost — authoritative input ingest + snapshot broadcast"
```

---

## Task 8: `NetClient`

**Files:**
- Create: `src/net/NetClient.ts`
- Test: `src/net/__tests__/NetClient.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/net/__tests__/NetClient.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createLinkedTransports } from '../../session/Transport'
import { emptyInput, type NetMessage, type Snapshot } from '../../session/protocol'
import { NetClient } from '../NetClient'

describe('NetClient', () => {
  it('join sends a join message and welcome sets playerId', () => {
    const [clientSide, hostSide] = createLinkedTransports()
    const hostGot: NetMessage[] = []
    hostSide.onMessage(m => hostGot.push(m))

    const client = new NetClient(clientSide)
    client.join('Ann')
    expect(hostGot).toContainEqual({ type: 'join', name: 'Ann' })

    hostSide.send({ type: 'welcome', playerId: 'player-2', mode: 'coop' })
    expect(client.playerId).toBe('player-2')
    expect(client.mode).toBe('coop')
  })

  it('stores the latest snapshot and tags input with playerId', () => {
    const [clientSide, hostSide] = createLinkedTransports()
    const hostGot: NetMessage[] = []
    hostSide.onMessage(m => hostGot.push(m))
    const client = new NetClient(clientSide)
    client.join('Ann')
    hostSide.send({ type: 'welcome', playerId: 'player-2', mode: 'coop' })

    const snap: Snapshot = { tick: 5, players: [], enemies: [] }
    hostSide.send({ type: 'snapshot', snapshot: snap })
    expect(client.latestSnapshot?.tick).toBe(5)

    client.sendInput({ ...emptyInput(), shoot: true })
    expect(hostGot).toContainEqual({ type: 'input', playerId: 'player-2', input: { ...emptyInput(), shoot: true } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/NetClient.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `NetClient`**

Create `src/net/NetClient.ts`:
```ts
import type { Transport } from '../session/Transport'
import type { GameMode, NetMessage, PlayerInput, Snapshot } from '../session/protocol'

/** Client-side driver: joins, forwards input, tracks the latest authoritative snapshot. */
export class NetClient {
  playerId: string | null = null
  mode: GameMode | null = null
  latestSnapshot: Snapshot | null = null

  private snapshotCb: ((s: Snapshot) => void) | null = null
  private welcomeCb: ((playerId: string, mode: GameMode) => void) | null = null

  constructor(private transport: Transport) {
    this.transport.onMessage((msg: NetMessage) => this.handle(msg))
  }

  join(name: string): void {
    this.transport.send({ type: 'join', name })
  }

  sendInput(input: PlayerInput): void {
    if (!this.playerId) return
    this.transport.send({ type: 'input', playerId: this.playerId, input })
  }

  onSnapshot(cb: (s: Snapshot) => void): void { this.snapshotCb = cb }
  onWelcome(cb: (playerId: string, mode: GameMode) => void): void { this.welcomeCb = cb }

  private handle(msg: NetMessage): void {
    if (msg.type === 'welcome') {
      this.playerId = msg.playerId
      this.mode = msg.mode
      this.welcomeCb?.(msg.playerId, msg.mode)
    } else if (msg.type === 'snapshot') {
      this.latestSnapshot = msg.snapshot
      this.snapshotCb?.(msg.snapshot)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/NetClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/net/NetClient.ts src/net/__tests__/NetClient.test.ts
git commit -m "feat: add NetClient — join, input forwarding, snapshot tracking"
```

---

## Task 9: Host↔client integration over linked transports

**Files:**
- Test: `src/net/__tests__/NetLoop.integration.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/net/__tests__/NetLoop.integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { GameSession } from '../../session/GameSession'
import { createLinkedTransports } from '../../session/Transport'
import { emptyInput } from '../../session/protocol'
import { NetHost } from '../NetHost'
import { NetClient } from '../NetClient'

describe('NetHost + NetClient integration', () => {
  it("a client's movement appears in the snapshot it receives", () => {
    const session = new GameSession()
    const host = new NetHost(session, 'coop')
    const [hostSide, clientSide] = createLinkedTransports()

    const client = new NetClient(clientSide)
    client.join('Bob')
    host.addClient('player-2', 'Bob', hostSide) // host assigns id after join (orchestrator does this live)
    expect(client.playerId).toBe('player-2')

    // Client presses forward for several authoritative ticks.
    for (let i = 0; i < 10; i++) {
      client.sendInput({ ...emptyInput(), forward: true })
      host.tick(1 / 30)
    }

    const me = client.latestSnapshot!.players.find(p => p.id === 'player-2')!
    expect(me.position.z).toBeLessThan(0) // moved forward (-Z) on the authoritative host
    expect(me.name).toBe('Bob')
  })
})
```

- [ ] **Step 2: Run test to verify it fails (or passes)**

Run: `npx vitest run src/net/__tests__/NetLoop.integration.test.ts`
Expected: PASS if Tasks 3–8 are correct. If it FAILS, the failure pinpoints which layer regressed — fix there before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/net/__tests__/NetLoop.integration.test.ts
git commit -m "test: end-to-end NetHost+NetClient over linked transport"
```

---

## Task 10: `PeerConnection` — wrap a peerjs DataConnection as Transport

**Files:**
- Create: `src/net/PeerConnection.ts`
- Test: `src/net/__tests__/PeerConnection.test.ts`

- [ ] **Step 1: Write the failing test (with a fake DataConnection)**

Create `src/net/__tests__/PeerConnection.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { PeerConnection } from '../PeerConnection'
import type { NetMessage } from '../../session/protocol'

function fakeConn() {
  const dataHandlers: ((d: unknown) => void)[] = []
  return {
    send: vi.fn(),
    on: (event: string, cb: (d: unknown) => void) => { if (event === 'data') dataHandlers.push(cb) },
    emitData: (d: unknown) => dataHandlers.forEach(h => h(d)),
  }
}

describe('PeerConnection', () => {
  it('send() forwards to conn.send', () => {
    const conn = fakeConn()
    const t = new PeerConnection(conn as any)
    const msg: NetMessage = { type: 'join', name: 'Ann' }
    t.send(msg)
    expect(conn.send).toHaveBeenCalledWith(msg)
  })

  it('onMessage() receives conn "data" events', () => {
    const conn = fakeConn()
    const t = new PeerConnection(conn as any)
    const got: NetMessage[] = []
    t.onMessage(m => got.push(m))
    conn.emitData({ type: 'welcome', playerId: 'player-2', mode: 'coop' })
    expect(got).toEqual([{ type: 'welcome', playerId: 'player-2', mode: 'coop' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/PeerConnection.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `PeerConnection`**

Create `src/net/PeerConnection.ts`:
```ts
import type { DataConnection } from 'peerjs'
import type { Transport } from '../session/Transport'
import type { NetMessage } from '../session/protocol'

/** Adapts a single peerjs DataConnection to the Transport interface. */
export class PeerConnection implements Transport {
  constructor(private conn: DataConnection) {}

  send(msg: NetMessage): void {
    this.conn.send(msg)
  }

  onMessage(cb: (msg: NetMessage) => void): void {
    this.conn.on('data', (data) => cb(data as NetMessage))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/PeerConnection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/net/PeerConnection.ts src/net/__tests__/PeerConnection.test.ts
git commit -m "feat: PeerConnection adapts a peerjs DataConnection to Transport"
```

---

## Task 11: `PeerHost` + `PeerClient` — peerjs lifecycle

**Files:**
- Create: `src/net/PeerHost.ts`
- Create: `src/net/PeerClient.ts`
- Test: `src/net/__tests__/PeerHost.test.ts`

- [ ] **Step 1: Write the failing test (mock peerjs `Peer`)**

Create `src/net/__tests__/PeerHost.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'

const handlers: Record<string, ((arg: unknown) => void)[]> = {}
const fakePeer = {
  id: 'ROOM42',
  on: (event: string, cb: (arg: unknown) => void) => { (handlers[event] ??= []).push(cb) },
  destroy: vi.fn(),
}
vi.mock('peerjs', () => ({ default: vi.fn(() => fakePeer) }))

import { PeerHost } from '../PeerHost'

describe('PeerHost', () => {
  it('resolves a room code when the peer opens', async () => {
    const host = new PeerHost()
    const codePromise = host.start()
    handlers['open']?.forEach(h => h('ROOM42'))
    await expect(codePromise).resolves.toBe('ROOM42')
  })

  it('emits a transport for each incoming connection that opens', () => {
    const host = new PeerHost()
    host.start()
    handlers['open']?.forEach(h => h('ROOM42'))

    const got: unknown[] = []
    host.onClientConnect(t => got.push(t))

    const connHandlers: Record<string, ((a: unknown) => void)[]> = {}
    const fakeConn = { on: (e: string, cb: (a: unknown) => void) => { (connHandlers[e] ??= []).push(cb) }, send: vi.fn() }
    handlers['connection']?.forEach(h => h(fakeConn))
    connHandlers['open']?.forEach(h => h(undefined))

    expect(got).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/PeerHost.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `PeerHost`**

Create `src/net/PeerHost.ts`:
```ts
import Peer, { type DataConnection } from 'peerjs'
import { PeerConnection } from './PeerConnection'
import type { Transport } from '../session/Transport'

/** Host peer: advertises a room code and emits a Transport per joined client. */
export class PeerHost {
  private peer: Peer | null = null
  private connectCb: ((t: Transport) => void) | null = null

  /** Resolves with the room code (this peer's id). */
  start(): Promise<string> {
    this.peer = new Peer()
    return new Promise((resolve, reject) => {
      this.peer!.on('open', (id: string) => resolve(id))
      this.peer!.on('error', (err) => reject(err))
      this.peer!.on('connection', (conn: DataConnection) => {
        conn.on('open', () => this.connectCb?.(new PeerConnection(conn)))
      })
    })
  }

  onClientConnect(cb: (t: Transport) => void): void { this.connectCb = cb }

  stop(): void { this.peer?.destroy(); this.peer = null }
}
```

- [ ] **Step 4: Implement `PeerClient`**

Create `src/net/PeerClient.ts`:
```ts
import Peer, { type DataConnection } from 'peerjs'
import { PeerConnection } from './PeerConnection'
import type { Transport } from '../session/Transport'

/** Client peer: dials a room code and resolves a Transport once the channel opens. */
export class PeerClient {
  private peer: Peer | null = null

  connect(roomCode: string): Promise<Transport> {
    this.peer = new Peer()
    return new Promise((resolve, reject) => {
      this.peer!.on('open', () => {
        const conn = this.peer!.connect(roomCode, { reliable: true })
        conn.on('open', () => resolve(new PeerConnection(conn as DataConnection)))
        conn.on('error', (err) => reject(err))
      })
      this.peer!.on('error', (err) => reject(err))
    })
  }

  stop(): void { this.peer?.destroy(); this.peer = null }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/PeerHost.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/net/PeerHost.ts src/net/PeerClient.ts src/net/__tests__/PeerHost.test.ts
git commit -m "feat: PeerHost/PeerClient manage peerjs connection lifecycle"
```

---

## Task 12: `RemotePlayer` + `RemotePlayerManager` (seeing each other)

**Files:**
- Create: `src/net/RemotePlayer.ts`
- Create: `src/net/RemotePlayerManager.ts`
- Test: `src/net/__tests__/RemotePlayer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/net/__tests__/RemotePlayer.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { RemotePlayer } from '../RemotePlayer'
import { RemotePlayerManager } from '../RemotePlayerManager'
import type { EntityState } from '../../session/protocol'

function state(id: string, x: number): EntityState {
  return { id, kind: 'player', type: 'player', position: { x, y: 0, z: 0 }, rotationY: 0, health: 100, isDead: false, name: id }
}

describe('RemotePlayer', () => {
  it('interpolates toward the latest target position', () => {
    const rp = new RemotePlayer('player-2', 'Bob')
    rp.pushState(state('player-2', 0))
    rp.pushState(state('player-2', 10))
    rp.update(1) // big dt → converges most of the way
    expect(rp.group.position.x).toBeGreaterThan(0)
    expect(rp.group.position.x).toBeLessThanOrEqual(10)
  })
})

describe('RemotePlayerManager', () => {
  it('adds, updates and removes remote players, excluding the local id', () => {
    const scene = new THREE.Scene()
    const mgr = new RemotePlayerManager(scene, 'player-1')

    mgr.sync([state('player-1', 0), state('player-2', 5)])
    expect(mgr.ids()).toEqual(['player-2']) // local excluded

    mgr.sync([state('player-2', 5), state('player-3', 7)])
    expect(mgr.ids().sort()).toEqual(['player-2', 'player-3'])

    mgr.sync([state('player-3', 7)])
    expect(mgr.ids()).toEqual(['player-3'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/RemotePlayer.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `RemotePlayer`**

Create `src/net/RemotePlayer.ts`:
```ts
import * as THREE from 'three'
import { buildCharacter } from '../entities/CharacterModel'
import type { EntityState } from '../session/protocol'

const LERP_RATE = 12 // higher = snappier; tuned for ~100ms snapshot spacing

/** A networked player's visual body, smoothed toward the latest snapshot. */
export class RemotePlayer {
  readonly group: THREE.Group
  private target = new THREE.Vector3()
  private targetYaw = 0
  isDead = false

  constructor(readonly id: string, name: string, tint = 0x3399ff) {
    this.group = buildCharacter({ tint, name })
  }

  pushState(s: EntityState): void {
    this.target.set(s.position.x, s.position.y, s.position.z)
    this.targetYaw = s.rotationY
    this.isDead = s.isDead
    if (this.group.position.lengthSq() === 0) this.group.position.copy(this.target) // snap on first state
  }

  update(dt: number): void {
    const t = 1 - Math.exp(-LERP_RATE * dt) // frame-rate-independent lerp
    this.group.position.lerp(this.target, t)
    this.group.rotation.y += (this.targetYaw - this.group.rotation.y) * t
    this.group.visible = !this.isDead
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() }
    })
  }
}
```

- [ ] **Step 4: Implement `RemotePlayerManager`**

Create `src/net/RemotePlayerManager.ts`:
```ts
import * as THREE from 'three'
import { RemotePlayer } from './RemotePlayer'
import type { EntityState } from '../session/protocol'

/** Keeps the scene's RemotePlayer set in sync with a snapshot's player list. */
export class RemotePlayerManager {
  private players = new Map<string, RemotePlayer>()

  constructor(private scene: THREE.Scene, private localId: string) {}

  ids(): string[] { return [...this.players.keys()] }

  sync(playerStates: EntityState[]): void {
    const seen = new Set<string>()
    for (const s of playerStates) {
      if (s.id === this.localId) continue
      seen.add(s.id)
      let rp = this.players.get(s.id)
      if (!rp) {
        rp = new RemotePlayer(s.id, s.name ?? s.id)
        this.players.set(s.id, rp)
        this.scene.add(rp.group)
      }
      rp.pushState(s)
    }
    for (const [id, rp] of this.players) {
      if (!seen.has(id)) { this.scene.remove(rp.group); rp.dispose(); this.players.delete(id) }
    }
  }

  update(dt: number): void {
    for (const rp of this.players.values()) rp.update(dt)
  }

  clear(): void {
    for (const rp of this.players.values()) { this.scene.remove(rp.group); rp.dispose() }
    this.players.clear()
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/RemotePlayer.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/net/RemotePlayer.ts src/net/RemotePlayerManager.ts src/net/__tests__/RemotePlayer.test.ts
git commit -m "feat: render and interpolate remote players from snapshots"
```

---

## Task 13: `MainMenu` — Singleplayer vs Multiplayer

**Files:**
- Modify: `src/ui/MainMenu.tsx`
- Test: `src/ui/__tests__/UI.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/ui/__tests__/UI.test.tsx`:
```ts
import { render, screen, fireEvent } from '@testing-library/react'
import { MainMenu } from '../MainMenu'

describe('MainMenu mode select', () => {
  it('fires onSingleplayer and onMultiplayer', () => {
    const sp = vi.fn(); const mp = vi.fn()
    render(<MainMenu onSingleplayer={sp} onMultiplayer={mp} />)
    fireEvent.click(screen.getByText(/singleplayer/i))
    fireEvent.click(screen.getByText(/multiplayer/i))
    expect(sp).toHaveBeenCalledTimes(1)
    expect(mp).toHaveBeenCalledTimes(1)
  })
})
```
(Ensure `vi` is imported at the top of `UI.test.tsx`; it is already used by existing tests — reuse the existing import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/UI.test.tsx`
Expected: FAIL — `MainMenu` still takes `onStart`.

- [ ] **Step 3: Update `MainMenu` props + buttons**

In `src/ui/MainMenu.tsx`, change the props interface and the button block:
```tsx
interface MainMenuProps {
  onSingleplayer: () => void
  onMultiplayer: () => void
}

export const MainMenu: React.FC<MainMenuProps> = ({ onSingleplayer, onMultiplayer }) => {
```
Replace the single START GAME `<button>` with two buttons (keep the existing inline styles, duplicating them per button):
```tsx
      <div style={{ display: 'flex', gap: 16 }}>
        <button onClick={onSingleplayer} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#ff6600',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>SINGLEPLAYER</button>
        <button onClick={onMultiplayer} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#3399ff',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>MULTIPLAYER</button>
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/UI.test.tsx`
Expected: PASS. (App.tsx will not compile until Task 15 wires the new props — that is expected and handled there.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/MainMenu.tsx src/ui/__tests__/UI.test.tsx
git commit -m "feat: MainMenu offers Singleplayer and Multiplayer"
```

---

## Task 14: `MultiplayerMenu` — host/join/lobby

**Files:**
- Create: `src/ui/MultiplayerMenu.tsx`
- Test: `src/ui/__tests__/MultiplayerMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/MultiplayerMenu.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MultiplayerMenu } from '../MultiplayerMenu'

describe('MultiplayerMenu', () => {
  it('host flow calls onHost and shows the room code + player list', () => {
    const onHost = vi.fn(); const onJoin = vi.fn(); const onStart = vi.fn()
    render(<MultiplayerMenu roomCode="ROOM42" players={['You', 'Bob']} isHost
      onHost={onHost} onJoin={onJoin} onStart={onStart} onBack={vi.fn()} />)
    expect(screen.getByText('ROOM42')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/start/i))
    expect(onStart).toHaveBeenCalled()
  })

  it('join flow submits an entered code', () => {
    const onJoin = vi.fn()
    render(<MultiplayerMenu roomCode={null} players={[]} isHost={false}
      onHost={vi.fn()} onJoin={onJoin} onStart={vi.fn()} onBack={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/room code/i), { target: { value: 'ABC123' } })
    fireEvent.click(screen.getByText(/^join$/i))
    expect(onJoin).toHaveBeenCalledWith('ABC123')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/MultiplayerMenu.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `MultiplayerMenu`**

Create `src/ui/MultiplayerMenu.tsx`:
```tsx
import React, { useState } from 'react'

interface MultiplayerMenuProps {
  roomCode: string | null      // set once hosting; null while choosing/joining
  players: string[]            // lobby roster (names)
  isHost: boolean
  onHost: () => void           // start hosting (creates the room)
  onJoin: (code: string) => void
  onStart: () => void          // host begins the match
  onBack: () => void
}

const panel: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 16,
  background: 'linear-gradient(180deg,#0a0a1a,#1a1a3e)', color: 'white', fontFamily: 'monospace',
}
const btn: React.CSSProperties = {
  padding: '12px 32px', fontSize: 18, fontWeight: 'bold', background: '#3399ff',
  color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
}

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = (p) => {
  const [code, setCode] = useState('')
  const inLobby = p.roomCode !== null || p.players.length > 0

  if (inLobby) {
    return (
      <div style={panel}>
        <h2>Lobby</h2>
        {p.roomCode && (
          <div>Room code: <strong style={{ fontSize: 24 }}>{p.roomCode}</strong>{' '}
            <button style={btn} onClick={() => navigator.clipboard?.writeText(p.roomCode!)}>Copy</button>
          </div>
        )}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {p.players.map((name) => <li key={name}>{name}</li>)}
        </ul>
        {p.isHost
          ? <button style={btn} onClick={p.onStart}>Start</button>
          : <p>Waiting for host to start…</p>}
        <button style={{ ...btn, background: '#555' }} onClick={p.onBack}>Back</button>
      </div>
    )
  }

  return (
    <div style={panel}>
      <h2>Multiplayer (Co-op)</h2>
      <button style={btn} onClick={p.onHost}>Host Game</button>
      <div style={{ display: 'flex', gap: 8 }}>
        <input placeholder="Room code" value={code} onChange={(e) => setCode(e.target.value)}
          style={{ padding: 10, fontSize: 16 }} />
        <button style={btn} onClick={() => onJoinClick()}>Join</button>
      </div>
      <button style={{ ...btn, background: '#555' }} onClick={p.onBack}>Back</button>
    </div>
  )

  function onJoinClick() { if (code.trim()) p.onJoin(code.trim()) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/MultiplayerMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/MultiplayerMenu.tsx src/ui/__tests__/MultiplayerMenu.test.tsx
git commit -m "feat: add MultiplayerMenu host/join/lobby UI"
```

---

## Task 15: Wire roles into `App.tsx`

This connects everything: a `'mpmenu'` screen, host/client orchestration, fixed-tick host loop, client input send + snapshot render, and remote-player rendering. Keep single-player working exactly as before (now reached via the Singleplayer button).

**Files:**
- Modify: `src/types.ts` (add `'mpmenu'` to `GameState`)
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the `mpmenu` game state**

In `src/types.ts`, extend the `GameState` union to include `'mpmenu'`:
```ts
export type GameState = 'menu' | 'mpmenu' | 'playing' | 'paused' | 'gameover'
```

- [ ] **Step 2: Add net role refs + lobby state in `App.tsx`**

Near the other `useState`s in `App` add:
```tsx
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [lobbyPlayers, setLobbyPlayers] = useState<string[]>([])
  const [isHost, setIsHost] = useState(false)
```
Extend `gameDataRef.current` initializer with net fields:
```tsx
    netHost: null as import('./net/NetHost').NetHost | null,
    netClient: null as import('./net/NetClient').NetClient | null,
    peerHost: null as import('./net/PeerHost').PeerHost | null,
    peerClient: null as import('./net/PeerClient').PeerClient | null,
    remotePlayers: null as import('./net/RemotePlayerManager').RemotePlayerManager | null,
    role: 'single' as 'single' | 'host' | 'client',
    nextClientNum: 2,
    hostAccum: 0,
```

- [ ] **Step 3: Add host/join orchestration callbacks**

Add these imports at the top of `App.tsx`:
```tsx
import { NetHost } from './net/NetHost'
import { NetClient } from './net/NetClient'
import { PeerHost } from './net/PeerHost'
import { PeerClient } from './net/PeerClient'
import { RemotePlayerManager } from './net/RemotePlayerManager'
import { MultiplayerMenu } from './ui/MultiplayerMenu'
```

Add these callbacks inside `App` (after `startGame`):
```tsx
  const hostGame = useCallback(async () => {
    const data = gameDataRef.current
    data.role = 'host'
    setIsHost(true)
    const peerHost = new PeerHost()
    data.peerHost = peerHost
    const host = new NetHost(data.session, 'coop')
    data.netHost = host
    setLobbyPlayers(['You'])
    peerHost.onClientConnect((transport) => {
      // First message from a fresh client is its 'join'; assign an id then register.
      transport.onMessage((msg) => {
        if (msg.type === 'join') {
          const id = `player-${data.nextClientNum++}`
          host.addClient(id, msg.name, transport)
          setLobbyPlayers((prev) => [...prev, msg.name])
        }
      })
    })
    const code = await peerHost.start()
    setRoomCode(code)
  }, [])

  const joinGame = useCallback(async (code: string) => {
    const data = gameDataRef.current
    data.role = 'client'
    setIsHost(false)
    const peerClient = new PeerClient()
    data.peerClient = peerClient
    const transport = await peerClient.connect(code)
    const client = new NetClient(transport)
    data.netClient = client
    client.onWelcome(() => startNetGame('client'))
    client.join('Player')
  }, [])
```

- [ ] **Step 4: Add `startNetGame` and the role-aware update loop**

Add a `startNetGame` callback that mirrors `startGame` but sets up remote rendering and the role, then transitions to `'playing'`:
```tsx
  const startNetGame = useCallback((role: 'host' | 'client') => {
    const data = gameDataRef.current
    const engine = engineRef.current!
    data.role = role
    data.remotePlayers = new RemotePlayerManager(engine.scene, data.netClient?.playerId ?? data.session.localId)
    lookRef.current = { yaw: 0, pitch: 0 }
    setStoreOpen(false)
    engine.start()
    data.audio.init(); data.audio.loadSounds()
    updateGameState('playing')
  }, [updateGameState])
```

In the existing `engine.onUpdate((dt) => { ... })` callback, branch by role at the very top. Wrap today's body so it only runs for `role === 'single' || role === 'host'` (the host still simulates locally and renders its own viewmodel), and add network I/O:

```tsx
    engine.onUpdate((dt) => {
      const data = gameDataRef.current

      // ---- CLIENT: send input, render from latest snapshot, no local sim ----
      if (data.role === 'client') {
        const controls = data.controls!
        const m = controls.getMovement()
        data.netClient?.sendInput({
          ...emptyInput(),
          forward: m.forward, backward: m.backward, left: m.left, right: m.right, jump: m.jump,
          shoot: controls.shoot && !storeOpenRef.current,
          yaw: lookRef.current.yaw, pitch: lookRef.current.pitch,
        })
        const snap = data.netClient?.latestSnapshot
        if (snap) {
          const me = snap.players.find(p => p.id === data.netClient!.playerId)
          if (me) {
            engine.camera.position.set(me.position.x, me.position.y, me.position.z)
            engine.camera.rotation.set(me.rotationX ?? 0, me.rotationY, 0, 'YXZ')
            setHealth(me.health)
          }
          data.remotePlayers?.sync(snap.players)
          syncSnapshotEnemies(snap) // see Step 5
        }
        data.remotePlayers?.update(dt)
        data.particleSystem?.update(dt)
        return
      }

      // ---- SINGLE / HOST: authoritative local simulation (existing body) ----
      // (existing input-gather → session.step → camera → events → HUD code stays here)
      // ... existing code unchanged ...

      // After the existing body, for HOST also drive the fixed network tick + remote render:
      if (data.role === 'host') {
        data.hostAccum += dt
        const FIXED = 1 / 30
        while (data.hostAccum >= FIXED) { data.netHost!.tick(FIXED); data.hostAccum -= FIXED }
        const snap = data.session.getSnapshot()
        data.remotePlayers?.sync(snap.players)
        data.remotePlayers?.update(dt)
      }
    })
```

Note: the host's existing body already calls `session.step(dt)` for local rendering responsiveness; to avoid double-stepping, change the host path so the authoritative advance happens only in the fixed-tick `netHost.tick` loop. Concretely, when `data.role === 'host'`, skip the existing `session.step(dt)` call and instead read state from the latest snapshot for the host's own camera/HUD (same pattern as the client, but reading `data.session.getSnapshot()` directly). Keep `role === 'single'` on the original `session.step(dt)` path untouched.

- [ ] **Step 5: Add a client-side enemy snapshot renderer**

Clients have no `Enemy` objects, only enemy `EntityState`s. Add a small helper inside the effect (above `engine.onUpdate`) that maintains a map of simple enemy meshes keyed by id:
```tsx
    const clientEnemies = new Map<string, THREE.Mesh>()
    function syncSnapshotEnemies(snap: import('./session/protocol').Snapshot) {
      const seen = new Set<string>()
      for (const e of snap.enemies) {
        seen.add(e.id)
        let mesh = clientEnemies.get(e.id)
        if (!mesh) {
          mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xcc3333 }))
          clientEnemies.set(e.id, mesh); engine.scene.add(mesh)
        }
        mesh.position.set(e.position.x, e.position.y + 0.9, e.position.z)
        mesh.rotation.y = e.rotationY
        mesh.visible = !e.isDead
      }
      for (const [id, mesh] of clientEnemies) {
        if (!seen.has(id)) { engine.scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); clientEnemies.delete(id) }
      }
    }
```
(Enemy snapshot ids are stable per index within a step; M2 can refine enemy id stability. For M1 co-op this gives clients a visible, moving enemy set.)

- [ ] **Step 6: Update the JSX render branches**

- Change the `menu` branch to the new props and route Multiplayer to the `mpmenu` screen:
```tsx
      {gameState === 'menu' && (
        <MainMenu
          onSingleplayer={startGame}
          onMultiplayer={() => updateGameState('mpmenu')}
        />
      )}
      {gameState === 'mpmenu' && (
        <MultiplayerMenu
          roomCode={roomCode}
          players={lobbyPlayers}
          isHost={isHost}
          onHost={hostGame}
          onJoin={joinGame}
          onStart={() => startNetGame('host')}
          onBack={() => { updateGameState('menu'); setRoomCode(null); setLobbyPlayers([]) }}
        />
      )}
```
- In `startGame`, set `gameDataRef.current.role = 'single'` at the top so restarting from Game Over returns to single-player mode.

- [ ] **Step 7: Type-check, lint, build**

Run:
```bash
npx tsc -b && npm run lint && npm run build
```
Expected: no type errors, lint clean, build succeeds. Fix any compile errors surfaced by the `MainMenu` prop change or the role branching before proceeding.

- [ ] **Step 8: Run the full unit suite**

Run: `npx vitest run`
Expected: all tests PASS (no single-player regression).

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/types.ts
git commit -m "feat: wire host/client multiplayer roles into App"
```

---

## Task 16: Two-browser E2E smoke test + manual checklist

**Files:**
- Create: `e2e/multiplayer.spec.ts`

- [ ] **Step 1: Write the E2E test**

Create `e2e/multiplayer.spec.ts`:
```ts
import { test, expect, chromium } from '@playwright/test'

// Real WebRTC over the public PeerJS broker; allow generous timeouts.
test('two players join the same room and see each other', async () => {
  test.setTimeout(60_000)
  const browser = await chromium.launch()
  const hostCtx = await browser.newContext()
  const joinCtx = await browser.newContext()
  const host = await hostCtx.newPage()
  const join = await joinCtx.newPage()

  await host.goto('/')
  await host.getByText(/multiplayer/i).click()
  await host.getByText(/host game/i).click()
  const code = await host.locator('strong').first().innerText()
  expect(code.length).toBeGreaterThan(0)

  await join.goto('/')
  await join.getByText(/multiplayer/i).click()
  await join.getByPlaceholder(/room code/i).fill(code)
  await join.getByText(/^join$/i).click()

  // Host sees the joiner in the lobby roster.
  await expect(host.getByText(/player/i)).toBeVisible({ timeout: 20_000 })

  await host.getByText(/start/i).click()
  // Both end up in-game (HUD canvas present).
  await expect(host.locator('canvas')).toBeVisible()
  await expect(join.locator('canvas')).toBeVisible()

  await browser.close()
})
```

- [ ] **Step 2: Run the E2E test**

Run: `npm run test:e2e -- multiplayer.spec.ts`
Expected: PASS. If the public broker is flaky/unreachable in CI, mark this test `test.skip` in CI and keep it for local/manual runs (note it in the PR).

- [ ] **Step 3: Manual verification checklist (two browser tabs, `npm run dev`)**

- [ ] Tab A: Multiplayer → Host Game → a room code appears and Copy works.
- [ ] Tab B: Multiplayer → paste code → Join → Tab A lobby shows a second player.
- [ ] Tab A: Start → both tabs enter the arena.
- [ ] Each tab sees the *other* player's character model moving as that tab moves (WASD + mouse look).
- [ ] Bots spawn and both players can damage them; the host owns the waves.
- [ ] Closing the joiner tab does not crash the host.

- [ ] **Step 4: Commit**

```bash
git add e2e/multiplayer.spec.ts
git commit -m "test: two-browser multiplayer E2E smoke + manual checklist"
```

---

## Self-Review Notes (addressed)

- **Spec coverage:** PeerTransport (Tasks 10–11), room-code host/join (Tasks 11, 14, 15), start-menu Singleplayer/Multiplayer + lobby (Tasks 13–15), co-op host-authoritative 2 players (Tasks 3–9, 15), seeing each other (Task 12, 15), dumb clients/interpolation-only (Tasks 12, 15 client branch), in-process testability over a loopback pair (Tasks 6–9). Lag comp, prediction, 10-player scale, host migration, and PvP are correctly **out of scope** (M2/M3).
- **Type consistency:** `PlayerEntity`, `addPlayer/removePlayer/getPlayer/playerIds/nearestPlayer`, `NetHost.addClient/removeClient/tick`, `NetClient.join/sendInput/onWelcome/onSnapshot/playerId/latestSnapshot`, `PeerConnection`, `PeerHost.start/onClientConnect`, `PeerClient.connect`, `RemotePlayer.pushState/update`, `RemotePlayerManager.sync/update/ids/clear` are used consistently across tasks.
- **Open risk flagged for M2:** enemy `EntityState.id` is index-based (`enemy-${i}`) and can churn as the array splices; Task 15 Step 5 notes clients tolerate this for M1, and M2 should give enemies stable ids.
```
