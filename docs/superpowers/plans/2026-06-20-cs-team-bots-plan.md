# CS-Style Team Bots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Counter-Strike-style team bots — AI-driven players that use the human player model, fight with the player weapon system, and appear on the scoreboard with names and K/D.

**Architecture:** A bot is a `PlayerEntity` in `GameSession.playerMap` whose `PlayerInput` is produced each tick by a `BotController` instead of by keyboard/network. This reuses the existing player movement, weapon/hit, scoring, respawn, snapshot, rendering (`RemotePlayerManager` → `buildCharacter`), and scoreboard paths. The wave-survival `Enemy` system is untouched.

**Tech Stack:** TypeScript, Three.js, React 19, Vitest (jsdom + @testing-library/react), Vite.

## Global Constraints

- Wave-survival code (`src/enemies/*`) and co-op mode behavior must remain unchanged.
- Bots only exist on the authoritative side (single-player or host); clients receive them via the normal snapshot. Clients must never call `addBot`/`removeBot`.
- Aim convention (matches existing tests): for a normalized direction `dir` to the target, `yaw = Math.atan2(dir.x, -dir.z)` and `pitch = Math.asin(dir.y)`.
- `EntityState.isBot` is an additive optional field; do not change any other protocol message shape.
- Player `position` is the eye position (y includes `EYE_HEIGHT = 2`); aim eye-to-eye.
- Run `npm run lint`, `npm run test`, and `npm run build` before the final commit.

---

### Task 1: BotController (combat AI)

**Files:**
- Create: `src/bots/BotController.ts`
- Test: `src/bots/__tests__/BotController.test.ts`

**Interfaces:**
- Consumes: `PlayerEntity` (`{ id, name, team, player: Player, weapons: WeaponManager }`) from `src/session/GameSession.ts`; `PlayerInput` + `emptyInput()` from `src/session/protocol.ts`; `CollisionWorld` from `src/engine/CollisionWorld.ts`.
- Produces: `class BotController { constructor(readonly id: string); computeInput(self: PlayerEntity, others: PlayerEntity[], world: CollisionWorld | null, dt: number): PlayerInput }`

- [ ] **Step 1: Write the failing test**

```typescript
// src/bots/__tests__/BotController.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as THREE from 'three'
import { BotController } from '../BotController'
import { Player } from '../../player/Player'
import { WeaponManager } from '../../weapons/WeaponManager'
import type { PlayerEntity } from '../../session/GameSession'
import type { CollisionWorld } from '../../engine/CollisionWorld'

function entity(id: string, team: 'ct' | 't', pos: THREE.Vector3): PlayerEntity {
  const player = new Player()
  player.position.copy(pos)
  const weapons = new WeaponManager()
  weapons.equip('rifle', 'primary')
  return { id, name: id, team, player, weapons }
}

// Reconstruct the forward vector the session will derive from yaw/pitch.
function forwardOf(yaw: number, pitch: number): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))
}

describe('BotController', () => {
  afterEach(() => vi.restoreAllMocks())

  it('aims at the nearest enemy-team player and ignores allies', () => {
    const bot = entity('bot-0', 't', new THREE.Vector3(0, 2, 0))
    const ally = entity('ally', 't', new THREE.Vector3(0, 2, -3))
    const farEnemy = entity('far', 'ct', new THREE.Vector3(0, 2, -40))
    const nearEnemy = entity('near', 'ct', new THREE.Vector3(5, 2, 0))
    const ctrl = new BotController('bot-0')
    const input = ctrl.computeInput(bot, [ally, farEnemy, nearEnemy], null, 0.016)
    const dirToNear = new THREE.Vector3(5, 0, 0).normalize()
    expect(forwardOf(input.yaw, input.pitch).dot(dirToNear)).toBeGreaterThan(0.99)
  })

  it('fires only after the reaction delay when target is in range with line of sight', () => {
    const bot = entity('bot-0', 't', new THREE.Vector3(0, 2, 0))
    const enemy = entity('e', 'ct', new THREE.Vector3(0, 2, -10))
    const ctrl = new BotController('bot-0')
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // kill aim jitter
    const first = ctrl.computeInput(bot, [enemy], null, 0.1)
    expect(first.shoot).toBe(false)            // still inside reaction window
    let last = first
    for (let i = 0; i < 5; i++) last = ctrl.computeInput(bot, [enemy], null, 0.1)
    expect(last.shoot).toBe(true)              // reaction delay elapsed
  })

  it('holds fire without line of sight', () => {
    const bot = entity('bot-0', 't', new THREE.Vector3(0, 2, 0))
    const enemy = entity('e', 'ct', new THREE.Vector3(0, 2, -10))
    const blocked = { segmentBlocked: () => 4 } as unknown as CollisionWorld
    const ctrl = new BotController('bot-0')
    let input = ctrl.computeInput(bot, [enemy], blocked, 0.1)
    for (let i = 0; i < 10; i++) input = ctrl.computeInput(bot, [enemy], blocked, 0.1)
    expect(input.shoot).toBe(false)
  })

  it('idles (no shoot, no movement) when there is no enemy', () => {
    const bot = entity('bot-0', 't', new THREE.Vector3(0, 2, 0))
    const ally = entity('ally', 't', new THREE.Vector3(0, 2, -3))
    const ctrl = new BotController('bot-0')
    const input = ctrl.computeInput(bot, [ally], null, 0.1)
    expect(input.shoot).toBe(false)
    expect(input.forward).toBe(false)
    expect(input.backward).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/bots/__tests__/BotController.test.ts`
Expected: FAIL — cannot find module `../BotController`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/bots/BotController.ts
import * as THREE from 'three'
import type { PlayerInput } from '../session/protocol'
import { emptyInput } from '../session/protocol'
import type { PlayerEntity } from '../session/GameSession'
import type { CollisionWorld } from '../engine/CollisionWorld'

const STANDOFF = 8          // preferred distance (m) to hold from the target
const REACTION_TIME = 0.35  // seconds of continuous sight before opening fire
const AIM_ERROR = 0.04      // radians of random aim jitter while firing

/** Drives one bot: reads the world, returns the PlayerInput for this tick. */
export class BotController {
  private aimTimer = 0

  constructor(readonly id: string) {}

  computeInput(self: PlayerEntity, others: PlayerEntity[], world: CollisionWorld | null, dt: number): PlayerInput {
    const input = emptyInput()
    if (self.player.isDead) { this.aimTimer = 0; return input }

    const target = this.pickTarget(self, others)
    if (!target) { this.aimTimer = 0; return input }

    const delta = new THREE.Vector3().subVectors(target.player.position, self.player.position)
    const dist = delta.length()
    const dir = dist > 1e-4 ? delta.clone().multiplyScalar(1 / dist) : new THREE.Vector3(0, 0, -1)

    // Face the target (same convention the session uses to derive the forward ray).
    input.yaw = Math.atan2(dir.x, -dir.z)
    input.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))

    // Close to a standoff distance; back off if too close.
    if (dist > STANDOFF) input.forward = true
    else if (dist < STANDOFF * 0.6) input.backward = true

    const hasLOS = !world || world.segmentBlocked(self.player.position, target.player.position) === null
    const range = self.weapons.current.def.range

    if (hasLOS && dist <= range) {
      this.aimTimer += dt
      if (this.aimTimer >= REACTION_TIME) {
        input.shoot = true
        input.yaw += (Math.random() - 0.5) * AIM_ERROR
        input.pitch += (Math.random() - 0.5) * AIM_ERROR
      }
    } else {
      this.aimTimer = 0
    }
    return input
  }

  /** Nearest living, enemy-team player. */
  private pickTarget(self: PlayerEntity, others: PlayerEntity[]): PlayerEntity | null {
    let best: PlayerEntity | null = null
    let bestDist = Infinity
    for (const o of others) {
      if (o.id === self.id || o.player.isDead || o.team === self.team) continue
      const d = o.player.position.distanceToSquared(self.player.position)
      if (d < bestDist) { bestDist = d; best = o }
    }
    return best
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/bots/__tests__/BotController.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/bots/BotController.ts src/bots/__tests__/BotController.test.ts
git commit -m "feat(bots): add BotController combat AI"
```

---

### Task 2: GameSession bot registry, names, and snapshot flag

**Files:**
- Create: `src/bots/botNames.ts`
- Modify: `src/session/protocol.ts` (add `isBot?` to `EntityState`, ~line 28-44)
- Modify: `src/session/GameSession.ts` (`PlayerEntity`, `addPlayer`, new fields/methods, `step`, `getSnapshot`)
- Test: `src/session/__tests__/GameSession.bots.test.ts`

**Interfaces:**
- Consumes: `BotController` from Task 1; `Team` from `src/types`.
- Produces:
  - `PlayerEntity` gains `isBot?: boolean`.
  - `GameSession.addBot(team: Team): PlayerEntity | null`
  - `GameSession.removeBot(id?: string): void`
  - `EntityState.isBot?: boolean`
  - `BOT_NAMES: string[]`, `botDisplayName(name: string): string`

- [ ] **Step 1: Write the failing test**

```typescript
// src/session/__tests__/GameSession.bots.test.ts
import { describe, it, expect } from 'vitest'
import { GameSession } from '../GameSession'
import * as THREE from 'three'

function pvpSession(): GameSession {
  return new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
}

describe('GameSession bots', () => {
  it('addBot creates an AI player with a BOT name, team, and a rifle', () => {
    const s = pvpSession()
    const bot = s.addBot('t')!
    expect(bot).not.toBeNull()
    expect(bot.isBot).toBe(true)
    expect(bot.team).toBe('t')
    expect(bot.name.startsWith('BOT ')).toBe(true)
    expect(bot.weapons.current.type).toBe('rifle')
    expect(s.getPlayer(bot.id)).toBe(bot)
  })

  it('removeBot removes the bot from the player map', () => {
    const s = pvpSession()
    const bot = s.addBot('ct')!
    s.removeBot(bot.id)
    expect(s.getPlayer(bot.id)).toBeUndefined()
  })

  it('marks bots (and only bots) with isBot in the snapshot', () => {
    const s = pvpSession()
    const bot = s.addBot('t')!
    const snap = s.getSnapshot()
    const botState = snap.players.find(p => p.id === bot.id)!
    const human = snap.players.find(p => p.id === s.localId)!
    expect(botState.isBot).toBe(true)
    expect(human.isBot).toBeFalsy()
  })

  it('drives the bot to face its enemy during step', () => {
    const s = pvpSession()
    // Local human is CT at the origin; put a T bot directly behind it on +Z.
    const bot = s.addBot('t')!
    bot.player.position.set(0, 2, 10)
    bot.player.rotation.set(0, 0, 0)
    s.step(0.05)
    // Bot should now look toward the human at the origin (-Z from the bot).
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(bot.player.rotation.x, bot.player.rotation.y, 0, 'YXZ'))
    const dirToHuman = new THREE.Vector3(0, 0, -10).normalize()
    expect(fwd.dot(dirToHuman)).toBeGreaterThan(0.95)
  })

  it('records a bot kill on the scoreboard by id', () => {
    const s = pvpSession()
    const bot = s.addBot('t')!
    s.scoreboard.recordKill(bot.id, 't', s.localId, 'ct', 'team')
    const scores = s.getSnapshot().scores
    expect(scores.players[bot.id].kills).toBe(1)
    expect(scores.players[s.localId].deaths).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/session/__tests__/GameSession.bots.test.ts`
Expected: FAIL — `addBot` is not a function.

- [ ] **Step 3a: Create the bot name pool**

```typescript
// src/bots/botNames.ts
/** CS-style bot first names; the scoreboard shows them prefixed with "BOT ". */
export const BOT_NAMES = [
  'Wade', 'Cooper', 'Gandhi', 'Quade', 'Quinn', 'Major', 'Rip', 'Seth',
  'Cliffe', 'Wolf', 'Opie', 'Vitaliy', 'Steel', 'Specter', 'Crab', 'Jock',
  'Tex', 'Boomer', 'Zach', 'Dave',
]

export function botDisplayName(name: string): string {
  return `BOT ${name}`
}
```

- [ ] **Step 3b: Add `isBot` to the protocol**

In `src/session/protocol.ts`, inside `interface EntityState`, add after the `team?: Team` line:

```typescript
  isBot?: boolean      // players only; true for AI-controlled bots
```

- [ ] **Step 3c: Extend `PlayerEntity`, `addPlayer`, registry, `addBot`/`removeBot`**

In `src/session/GameSession.ts`:

Add imports near the other imports:

```typescript
import { BotController } from '../bots/BotController'
import { BOT_NAMES, botDisplayName } from '../bots/botNames'
```

Add `isBot` to the interface:

```typescript
export interface PlayerEntity {
  id: string
  name: string
  team: Team
  player: Player
  weapons: WeaponManager
  isBot?: boolean
}
```

Add fields next to `private inputs = new Map<string, PlayerInput>()`:

```typescript
  private bots = new Map<string, BotController>()
  private nextBotNum = 0
  private usedBotNames = new Set<string>()
```

Change `addPlayer` to accept and store `isBot`:

```typescript
  addPlayer(id: string, name: string, team: Team = 'ct', isBot = false): PlayerEntity {
    const index = this.playerMap.size // 0 = host/local, kept at origin
    const entity: PlayerEntity = { id, name, team, player: new Player(), weapons: new WeaponManager(), isBot }
    entity.player.position.copy(this.spawnPosition(index))
    this.playerMap.set(id, entity)
    this.inputs.set(id, emptyInput())
    return entity
  }
```

Add the bot methods after `removePlayer`:

```typescript
  /** Spawn an AI bot on `team` with a rifle and a CS-style name. */
  addBot(team: Team): PlayerEntity | null {
    const id = `bot-${this.nextBotNum++}`
    const entity = this.addPlayer(id, botDisplayName(this.nextBotName()), team, true)
    entity.weapons.equip('rifle', 'primary')
    this.bots.set(id, new BotController(id))
    return entity
  }

  /** Remove a bot (defaults to the most recently added). */
  removeBot(id?: string): void {
    const targetId = id ?? [...this.bots.keys()].pop()
    if (!targetId || !this.bots.has(targetId)) return
    const entity = this.getPlayer(targetId)
    if (entity) this.usedBotNames.delete(entity.name.replace(/^BOT /, ''))
    this.bots.delete(targetId)
    this.removePlayer(targetId)
  }

  private nextBotName(): string {
    for (const n of BOT_NAMES) {
      if (!this.usedBotNames.has(n)) { this.usedBotNames.add(n); return n }
    }
    return `#${this.nextBotNum}`
  }
```

- [ ] **Step 3d: Drive bots in `step()`**

In `src/session/GameSession.ts`, in `step(dt)`, immediately **before** the comment `// Advance every player: look, movement+collision, weapons, shooting.` insert:

```typescript
    // Drive bots: each bot's AI produces this tick's input before players advance.
    if (this.bots.size > 0) {
      const all = [...this.playerMap.values()]
      for (const [id, controller] of this.bots) {
        const self = this.playerMap.get(id)
        if (!self) continue
        this.applyInput(id, controller.computeInput(self, all, this.collisionWorld, dt))
      }
    }
```

- [ ] **Step 3e: Mark bots in the snapshot**

In `getSnapshot()`, in the `players` mapping object, add after the `team: e.team,` line:

```typescript
      isBot: e.isBot,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/session/__tests__/GameSession.bots.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/bots/botNames.ts src/session/protocol.ts src/session/GameSession.ts src/session/__tests__/GameSession.bots.test.ts
git commit -m "feat(bots): register AI bots as players in GameSession"
```

---

### Task 3: Scoreboard shows BOT in the ping column

**Files:**
- Modify: `src/ui/Scoreboard.tsx` (the ping `<span>`, ~line 60)
- Test: `src/ui/__tests__/Scoreboard.test.tsx`

**Interfaces:**
- Consumes: `EntityState.isBot` from Task 2; `Scoreboard` component props `{ players: EntityState[]; scores?: MatchScores }`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

```typescript
// src/ui/__tests__/Scoreboard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Scoreboard } from '../Scoreboard'
import type { EntityState } from '../../session/protocol'
import type { MatchScores } from '../../session/Scoreboard'

function ent(over: Partial<EntityState>): EntityState {
  return { id: over.id!, kind: 'player', type: 'player', position: { x: 0, y: 0, z: 0 },
    rotationY: 0, health: 100, isDead: false, ...over }
}

const scores: MatchScores = { teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null }

describe('Scoreboard bot rows', () => {
  it('shows BOT instead of a ping for bot rows, and ms for humans', () => {
    const players = [
      ent({ id: 'local', name: 'You', team: 'ct', ping: 25 }),
      ent({ id: 'bot-0', name: 'BOT Wade', team: 't', isBot: true }),
    ]
    render(<Scoreboard players={players} scores={scores} />)
    expect(screen.getByText('BOT Wade')).toBeTruthy()
    expect(screen.getByText('BOT')).toBeTruthy()      // bot ping cell
    expect(screen.getByText('25 ms')).toBeTruthy()    // human ping cell
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/ui/__tests__/Scoreboard.test.tsx`
Expected: FAIL — `getByText('BOT')` finds nothing (the cell currently renders `0 ms`).

- [ ] **Step 3: Update the ping cell**

In `src/ui/Scoreboard.tsx`, replace the ping `<span>`:

```tsx
                <span style={{ textAlign: 'right', color: pingColor(p.ping ?? 0) }}>{p.ping ?? 0} ms</span>
```

with:

```tsx
                <span style={{ textAlign: 'right', color: p.isBot ? '#8888aa' : pingColor(p.ping ?? 0) }}>
                  {p.isBot ? 'BOT' : `${p.ping ?? 0} ms`}
                </span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/ui/__tests__/Scoreboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Scoreboard.tsx src/ui/__tests__/Scoreboard.test.tsx
git commit -m "feat(bots): show BOT tag for bot rows on the scoreboard"
```

---

### Task 4: Controls hotkeys to add/remove bots

**Files:**
- Modify: `src/player/Controls.ts` (callbacks + `onKeyDown` cases)
- Test: `src/player/__tests__/Controls.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `Team` from `src/types`.
- Produces: `Controls.onAddBot: ((team: Team) => void) | null`, `Controls.onRemoveBot: (() => void) | null`. Keys: `[` → add CT, `]` → add T, `\` → remove last.

- [ ] **Step 1: Write the failing test**

Append to `src/player/__tests__/Controls.test.ts` (inside the file, after the existing `describe`):

```typescript
describe('Controls bot hotkeys', () => {
  let element: HTMLElement
  let controls: Controls

  beforeEach(() => {
    element = createMockElement()
    controls = new Controls(element, () => 'playing')
  })
  afterEach(() => { controls.destroy(); vi.restoreAllMocks() })

  it('adds a CT bot on BracketLeft and a T bot on BracketRight', () => {
    const teams: string[] = []
    controls.onAddBot = (t) => teams.push(t)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketLeft' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketRight' }))
    expect(teams).toEqual(['ct', 't'])
  })

  it('removes a bot on Backslash', () => {
    const remove = vi.fn()
    controls.onRemoveBot = remove
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backslash' }))
    expect(remove).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/player/__tests__/Controls.test.ts`
Expected: FAIL — `onAddBot` is not a property / handler never fires.

- [ ] **Step 3: Add callbacks and key cases**

In `src/player/Controls.ts`:

Add the import at the top:

```typescript
import type { GameState, Team } from '../types'
```

(Replace the existing `import type { GameState } from '../types'` line.)

Add the callback fields near `onScoreboard`:

```typescript
  /** Authority-only: add a bot to the given team / remove the last bot. */
  onAddBot: ((team: Team) => void) | null = null
  onRemoveBot: (() => void) | null = null
```

Add cases in `onKeyDown`'s `switch` (e.g. after the `KeyG` case):

```typescript
      case 'BracketLeft': this.onAddBot?.('ct'); break
      case 'BracketRight': this.onAddBot?.('t'); break
      case 'Backslash': this.onRemoveBot?.(); break
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/player/__tests__/Controls.test.ts`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/player/Controls.ts src/player/__tests__/Controls.test.ts
git commit -m "feat(bots): add [ ] \\ hotkeys to add/remove bots"
```

---

### Task 5: Wire bots into App (single-player rendering + hotkeys)

**Files:**
- Modify: `src/App.tsx` (`startGame` remote-player init; controls callback wiring ~line 641; single-player render branch ~line 952)

**Interfaces:**
- Consumes: `Controls.onAddBot`/`onRemoveBot` (Task 4); `GameSession.addBot`/`removeBot` (Task 2); existing `RemotePlayerManager`.
- Produces: no new exports. This task is integration; verified by the suite + typecheck + manual run.

- [ ] **Step 1: Initialize a RemotePlayerManager for single-player**

In `src/App.tsx`, in `startGame`, immediately after `data.session = fresh`, add:

```typescript
    // Render bots (and any non-local players) in single-player with the player model.
    if (scene) data.remotePlayers = new RemotePlayerManager(scene, fresh.localId)
```

- [ ] **Step 2: Wire the add/remove-bot hotkeys**

In `src/App.tsx`, next to `data.controls.onScoreboard = ...` (~line 641), add:

```typescript
    data.controls.onAddBot = (team) => { if (data.role !== 'client') data.session.addBot(team) }
    data.controls.onRemoveBot = () => { if (data.role !== 'client') data.session.removeBot() }
```

- [ ] **Step 3: Sync remote players in the single-player branch**

In `src/App.tsx`, replace this block (~line 952):

```typescript
      } else if (data.role === 'single' && showScoreboardRef.current) {
        data.lastPlayers = session.getSnapshot().players
      }
```

with:

```typescript
      } else if (data.role === 'single') {
        const snap = session.getSnapshot()
        if (showScoreboardRef.current) data.lastPlayers = snap.players
        if (data.remotePlayers) {
          data.remotePlayers.sync(snap.players)
          data.remotePlayers.update(dt)
        }
      }
```

- [ ] **Step 4: Verify the full suite, types, and build pass**

Run: `npm run test`
Expected: PASS (all suites, including the new bot tests).

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `tsc -b` + `vite build` succeed with no type errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, start a single-player **PvP** match (MatchSetup → Player vs Player). In-game press `]` a few times to add T bots and `[` to add CT bots. Confirm:
- Bots appear as animated humanoid models identical to the player model (limbs swing, eyes visible).
- Bots chase and shoot you / each other.
- Hold `Tab`: bots are listed on the scoreboard with `BOT <name>`, team color, K/D, ALIVE/DEAD, and `BOT` in the ping column.
- Press `\` to remove a bot; it disappears from the world and scoreboard.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(bots): wire bot hotkeys and single-player bot rendering"
```

---

## Self-Review Notes

- **Spec coverage:** BotController (Task 1) ↔ spec §Components.1; session registry + names + snapshot flag (Task 2) ↔ §Components.2 & §Components.4 backend; scoreboard BOT tag (Task 3) ↔ §Components.4 UI; hotkeys (Task 4) ↔ §Components.5; single-player rendering + wiring (Task 5) ↔ §Components.3 & §Components.5. Wave system untouched (no task modifies `src/enemies/*`).
- **Type consistency:** `addBot(team)`, `removeBot(id?)`, `BotController.computeInput(self, others, world, dt)`, and `EntityState.isBot` are referenced identically across tasks.
- **Out of scope (per spec):** no bot buying, no bomb AI, no pathfinding — none added.
