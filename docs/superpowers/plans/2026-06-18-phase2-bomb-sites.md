# Phase 2: Bomb Sites + Objective Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CS-style bomb sites (A and B) to competitive mode with planting, defusing, and bomb carrier mechanics.

**Architecture:** New `Bombsite` class for zone logic, new `BombCarrier` class for bomb state. Both integrate into `GameSession` and update win conditions.

**Tech Stack:** TypeScript, React, Three.js, Vitest

## Global Constraints

- TypeScript strict mode
- React 19 + Three.js r170
- Vitest for unit tests
- Follow existing code patterns
- No new dependencies

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/session/Bombsite.ts` | Bombsite zone detection, markers |
| `src/session/BombCarrier.ts` | Bomb state machine, plant/defuse timers |
| `src/session/GameSession.ts` | Integrate bomb mechanics, win conditions |
| `src/session/protocol.ts` | Bomb events |
| `src/engine/Arena.ts` | Bombsite zone geometry |
| `src/ui/HUD.tsx` | Bomb timer, plant/defuse progress |
| `src/ui/Minimap.tsx` | Bombsite markers |

---

### Task 1: Bombsite Class

**Files:**
- Create: `src/session/Bombsite.ts`
- Create: `src/session/__tests__/Bombsite.test.ts`

**Interfaces:**
- Consumes: `Vec3` from `src/types.ts`
- Produces: `Bombsite` class with `isInside()`, `center`, `radius`

- [ ] **Step 1: Write the failing test**

```typescript
// src/session/__tests__/Bombsite.test.ts
import { describe, it, expect } from 'vitest'
import { Bombsite } from '../Bombsite'
import type { Vec3 } from '../../types'

describe('Bombsite', () => {
  it('creates with id and center', () => {
    const site = new Bombsite('A', { x: 0, y: 0, z: -20 })
    expect(site.id).toBe('A')
    expect(site.center).toEqual({ x: 0, y: 0, z: -20 })
  })

  it('detects point inside zone', () => {
    const site = new Bombsite('A', { x: 0, y: 0, z: -20 })
    expect(site.isInside({ x: 0, y: 0, z: -20 })).toBe(true)
    expect(site.isInside({ x: 1, y: 0, z: -20 })).toBe(true)
    expect(site.isInside({ x: 3, y: 0, z: -20 })).toBe(false)
  })

  it('detects point outside zone', () => {
    const site = new Bombsite('A', { x: 0, y: 0, z: -20 })
    expect(site.isInside({ x: 10, y: 0, z: 10 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/Bombsite.test.ts`
Expected: FAIL with "Cannot find module '../Bombsite'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/session/Bombsite.ts
import type { Vec3 } from '../types'

export class Bombsite {
  id: 'A' | 'B'
  center: Vec3
  radius: number = 4

  constructor(id: 'A' | 'B', center: Vec3) {
    this.id = id
    this.center = center
  }

  isInside(pos: Vec3): boolean {
    const dx = pos.x - this.center.x
    const dz = pos.z - this.center.z
    return Math.sqrt(dx * dx + dz * dz) <= this.radius
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/Bombsite.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/Bombsite.ts src/session/__tests__/Bombsite.test.ts
git commit -m "feat: add Bombsite class for zone detection"
```

---

### Task 2: BombCarrier Class

**Files:**
- Create: `src/session/BombCarrier.ts`
- Create: `src/session/__tests__/BombCarrier.test.ts`

**Interfaces:**
- Consumes: `Vec3` from `src/types.ts`
- Produces: `BombCarrier` class with state machine

- [ ] **Step 1: Write the failing test**

```typescript
// src/session/__tests__/BombCarrier.test.ts
import { describe, it, expect } from 'vitest'
import { BombCarrier, BombState } from '../BombCarrier'

describe('BombCarrier', () => {
  it('starts with no bomb', () => {
    const bomb = new BombCarrier()
    expect(bomb.state).toBe(BombState.None)
  })

  it('assigns bomb to carrier', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    expect(bomb.state).toBe(BombState.Carried)
    expect(bomb.carrier).toBe('player-1')
  })

  it('drops bomb', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.drop({ x: 5, y: 0, z: -15 })
    expect(bomb.state).toBe(BombState.Dropped)
    expect(bomb.position).toEqual({ x: 5, y: 0, z: -15 })
    expect(bomb.carrier).toBeNull()
  })

  it('picks up dropped bomb', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.drop({ x: 5, y: 0, z: -15 })
    bomb.pickup('player-2')
    expect(bomb.state).toBe(BombState.Carried)
    expect(bomb.carrier).toBe('player-2')
  })

  it('plants bomb', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    expect(bomb.state).toBe(BombState.Planting)
    expect(bomb.plantProgress).toBe(0)
  })

  it('completes plant after 3 seconds', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(1)
    bomb.update(1)
    bomb.update(1)
    expect(bomb.state).toBe(BombState.Planted)
    expect(bomb.site).toBe('A')
  })

  it('cancels plant on move', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.cancelPlant()
    expect(bomb.state).toBe(BombState.Carried)
    expect(bomb.plantProgress).toBe(0)
  })

  it('defuses bomb', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(3) // complete plant
    bomb.startDefuse()
    expect(bomb.state).toBe(BombState.Defusing)
  })

  it('completes defuse after 5 seconds with kit', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(3)
    bomb.startDefuse()
    bomb.update(5)
    expect(bomb.state).toBe(BombState.Defused)
  })

  it('completes defuse after 10 seconds without kit', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(3)
    bomb.startDefuse(false)
    bomb.update(10)
    expect(bomb.state).toBe(BombState.Defused)
  })

  it('explodes after 40 seconds', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(3)
    bomb.update(40)
    expect(bomb.state).toBe(BombState.Exploded)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/BombCarrier.test.ts`
Expected: FAIL with "Cannot find module '../BombCarrier'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/session/BombCarrier.ts
import type { Vec3 } from '../types'

export enum BombState {
  None = 'none',
  Carried = 'carried',
  Dropped = 'dropped',
  Planting = 'planting',
  Planted = 'planted',
  Defusing = 'defusing',
  Defused = 'defused',
  Exploded = 'exploded',
}

export class BombCarrier {
  state: BombState = BombState.None
  carrier: string | null = null
  position: Vec3 | null = null
  site: 'A' | 'B' | null = null
  timer: number = 40
  plantProgress: number = 0
  defuseProgress: number = 0

  private plantDuration = 3
  private defuseDuration = 5
  private defuseDurationNoKit = 10

  assign(playerId: string): void {
    this.state = BombState.Carried
    this.carrier = playerId
    this.position = null
    this.site = null
    this.timer = 40
    this.plantProgress = 0
    this.defuseProgress = 0
  }

  drop(pos: Vec3): void {
    this.state = BombState.Dropped
    this.carrier = null
    this.position = pos
  }

  pickup(playerId: string): void {
    if (this.state !== BombState.Dropped) return
    this.state = BombState.Carried
    this.carrier = playerId
    this.position = null
  }

  startPlant(site: 'A' | 'B'): void {
    if (this.state !== BombState.Carried) return
    this.state = BombState.Planting
    this.site = site
    this.plantProgress = 0
  }

  cancelPlant(): void {
    if (this.state !== BombState.Planting) return
    this.state = BombState.Carried
    this.plantProgress = 0
    this.site = null
  }

  startDefuse(hasKit: boolean = true): void {
    if (this.state !== BombState.Planted) return
    this.state = BombState.Defusing
    this.defuseProgress = 0
    this.defuseDuration = hasKit ? 5 : 10
  }

  cancelDefuse(): void {
    if (this.state !== BombState.Defusing) return
    this.state = BombState.Planted
    this.defuseProgress = 0
  }

  update(dt: number): void {
    if (this.state === BombState.Planting) {
      this.plantProgress += dt
      if (this.plantProgress >= this.plantDuration) {
        this.state = BombState.Planted
        this.timer = 40
        this.plantProgress = this.plantDuration
      }
    } else if (this.state === BombState.Planted) {
      this.timer -= dt
      if (this.timer <= 0) {
        this.state = BombState.Exploded
        this.timer = 0
      }
    } else if (this.state === BombState.Defusing) {
      this.defuseProgress += dt
      if (this.defuseProgress >= this.defuseDuration) {
        this.state = BombState.Defused
        this.defuseProgress = this.defuseDuration
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/BombCarrier.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/BombCarrier.ts src/session/__tests__/BombCarrier.test.ts
git commit -m "feat: add BombCarrier class for bomb state machine"
```

---

### Task 3: Update GameSession with Bomb Mechanics

**Files:**
- Modify: `src/session/GameSession.ts`

**Interfaces:**
- Consumes: `Bombsite`, `BombCarrier` (Tasks 1-2)
- Produces: Bomb-aware GameSession

- [ ] **Step 1: Write the failing test**

```typescript
// Add to test file
describe('bomb mechanics', () => {
  it('creates bombsites in competitive mode', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    expect(session.bombsites).toHaveLength(2)
    expect(session.bombsites[0].id).toBe('A')
    expect(session.bombsites[1].id).toBe('B')
  })

  it('creates bomb carrier in competitive mode', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    expect(session.bomb).toBeDefined()
    expect(session.bomb.state).toBe(BombState.None)
  })

  it('assigns bomb at round start', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    session.assignBomb()
    expect(session.bomb.state).toBe(BombState.Carried)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/GameSession.test.ts`
Expected: FAIL with "session.bombsites is undefined"

- [ ] **Step 3: Write minimal implementation**

```typescript
// Add to src/session/GameSession.ts
import { Bombsite } from './Bombsite'
import { BombCarrier, BombState } from './BombCarrier'

export class GameSession {
  // ... existing code
  bombsites: Bombsite[] = []
  bomb: BombCarrier = new BombCarrier()

  constructor(config: MatchConfig = defaultMatchConfig()) {
    // ... existing constructor
    if (config.mode === 'competitive') {
      this.bombsites = [
        new Bombsite('A', { x: 0, y: 0, z: -25 }),
        new Bombsite('B', { x: 0, y: 0, z: 25 }),
      ]
    }
  }

  assignBomb(): void {
    // Find a T player to carry the bomb
    for (const entity of this.playerMap.values()) {
      if (entity.team === 't') {
        this.bomb.assign(entity.id)
        return
      }
    }
  }

  step(dt: number): SessionEvent[] {
    const events: SessionEvent[] = []
    // ... existing step logic

    // Update bomb state
    if (this.bomb.state === BombState.Planting || 
        this.bomb.state === BombState.Planted || 
        this.bomb.state === BombState.Defusing) {
      this.bomb.update(dt)
      
      if (this.bomb.state === BombState.Exploded) {
        events.push({ type: 'bombExploded', site: this.bomb.site! })
      }
      if (this.bomb.state === BombState.Defused) {
        events.push({ type: 'bombDefused', site: this.bomb.site! })
      }
    }

    return events
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/GameSession.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/GameSession.ts
git commit -m "feat: integrate bomb mechanics into GameSession"
```

---

### Task 4: Add Bombsite Zones to Arena

**Files:**
- Modify: `src/engine/Arena.ts`

**Interfaces:**
- Consumes: Bombsite positions
- Produces: Visual markers for bombsites

- [ ] **Step 1: Write the failing test**

```typescript
// Add to arena tests
describe('bombsite markers', () => {
  it('creates bombsite markers', () => {
    // Test that arena creates visual markers
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/Arena.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Add to src/engine/Arena.ts
export function createArena(scene: THREE.Scene): CollisionWorld {
  // ... existing arena creation

  // Add bombsite markers
  const siteA = new THREE.Mesh(
    new THREE.RingGeometry(3, 4, 32),
    new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.5 })
  )
  siteA.rotation.x = -Math.PI / 2
  siteA.position.set(0, 0.01, -25)
  scene.add(siteA)

  const siteB = new THREE.Mesh(
    new THREE.RingGeometry(3, 4, 32),
    new THREE.MeshBasicMaterial({ color: 0x3333ff, transparent: true, opacity: 0.5 })
  )
  siteB.rotation.x = -Math.PI / 2
  siteB.position.set(0, 0.01, 25)
  scene.add(siteB)

  // ... return collision world
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/Arena.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/Arena.ts
git commit -m "feat: add bombsite visual markers to arena"
```

---

### Task 5: Update HUD with Bomb Indicators

**Files:**
- Modify: `src/ui/HUD.tsx`

**Interfaces:**
- Consumes: BombCarrier state
- Produces: Bomb timer, plant/defuse progress

- [ ] **Step 1: Write the failing test**

```typescript
// Add to HUD tests
describe('bomb indicators', () => {
  it('shows bomb timer when planted', () => {
    // Test bomb timer display
  })

  it('shows plant progress when planting', () => {
    // Test plant progress display
  })

  it('shows defuse progress when defusing', () => {
    // Test defuse progress display
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/UI.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/ui/HUD.tsx props
interface HUDProps {
  // ... existing props
  bombState?: BombState
  bombTimer?: number
  bombSite?: 'A' | 'B'
  plantProgress?: number
  defuseProgress?: number
}

// Add to HUD render
{props.bombState === 'planted' && (
  <div style={{ 
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    fontSize: 24, fontFamily: 'monospace', color: '#ff0000', textAlign: 'center'
  }}>
    <div>BOMB PLANTED AT {props.bombSite}</div>
    <div>{Math.ceil(props.bombTimer ?? 0)}s</div>
  </div>
)}

{props.bombState === 'planting' && (
  <div style={{ 
    position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
    width: 200, height: 10, background: '#333'
  }}>
    <div style={{ 
      width: `${(props.plantProgress ?? 0) * 100}%`, 
      height: '100%', background: '#ffcc00' 
    }} />
  </div>
)}

{props.bombState === 'defusing' && (
  <div style={{ 
    position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
    width: 200, height: 10, background: '#333'
  }}>
    <div style={{ 
      width: `${(props.defuseProgress ?? 0) * 100}%`, 
      height: '100%', background: '#00ff00' 
    }} />
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/UI.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/HUD.tsx
git commit -m "feat: add bomb indicators to HUD"
```

---

### Task 6: Update Minimap with Bombsite Markers

**Files:**
- Modify: `src/ui/Minimap.tsx`

**Interfaces:**
- Consumes: Bombsite positions, bomb carrier
- Produces: Minimap markers for sites and bomb

- [ ] **Step 1: Write the failing test**

```typescript
// Add to minimap tests
describe('bombsite markers', () => {
  it('shows A and B markers on minimap', () => {
    // Test minimap markers
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/Minimap.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/ui/Minimap.tsx props
interface MinimapProps {
  // ... existing props
  bombsites?: { id: string; position: { x: number; z: number } }[]
  bombCarrier?: string
  bombPosition?: { x: number; z: number }
}

// Add to Minimap render
{props.bombsites?.map((site) => {
  const x = ((site.position.x / props.arenaSize) * 50) + 50
  const y = ((site.position.z / props.arenaSize) * 50) + 50
  return (
    <div key={site.id} style={{
      position: 'absolute',
      left: `${x}%`, top: `${y}%`,
      transform: 'translate(-50%, -50%)',
      color: site.id === 'A' ? '#ff3333' : '#3333ff',
      fontWeight: 'bold',
      fontSize: 12,
    }}>
      {site.id}
    </div>
  )
})}

{props.bombPosition && (
  <div style={{
    position: 'absolute',
    left: `${((props.bombPosition.x / props.arenaSize) * 50) + 50}%`,
    top: `${((props.bombPosition.z / props.arenaSize) * 50) + 50}%`,
    transform: 'translate(-50%, -50%)',
    width: 6, height: 6,
    borderRadius: '50%',
    background: '#ff0000',
  }} />
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/Minimap.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/Minimap.tsx
git commit -m "feat: add bombsite and bomb markers to minimap"
```

---

### Task 7: Update Protocol with Bomb Events

**Files:**
- Modify: `src/session/protocol.ts`

**Interfaces:**
- Consumes: BombCarrier, Bombsite
- Produces: Bomb-related events

- [ ] **Step 1: Write the failing test**

```typescript
// Add to protocol tests
describe('bomb events', () => {
  it('includes bomb events', () => {
    const event: SessionEvent = { type: 'bombPlanted', site: 'A', planterId: 'player-1', timer: 40 }
    expect(event.type).toBe('bombPlanted')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/protocol.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Add to src/session/protocol.ts SessionEvent type
export type SessionEvent =
  // ... existing events
  | { type: 'bombPlanted'; site: 'A' | 'B'; planterId: string; timer: number }
  | { type: 'bombDropped'; position: Vec3; playerId: string }
  | { type: 'bombPickedUp'; playerId: string }
  | { type: 'bombDefused'; site: 'A' | 'B' }
  | { type: 'bombExploded'; site: 'A' | 'B' }

// Add to Snapshot interface
export interface Snapshot {
  // ... existing fields
  bomb?: {
    state: string
    carrier?: string
    position?: Vec3
    site?: 'A' | 'B'
    timer?: number
    plantProgress?: number
    defuseProgress?: number
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/protocol.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/protocol.ts
git commit -m "feat: add bomb events to protocol"
```

---

### Task 8: Integrate Bomb into App.tsx

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: All bomb classes
- Produces: Working bomb gameplay

- [ ] **Step 1: Write the failing test**

```typescript
// No unit test - integration testing
```

- [ ] **Step 2: Add bomb handling to game loop**

```typescript
// In src/App.tsx engine.onUpdate callback
case 'bombPlanted':
  setBombState('planted')
  setBombSite(ev.site)
  setBombTimer(ev.timer)
  break

case 'bombExploded':
  // T wins the round
  break

case 'bombDefused':
  // CT wins the round
  break
```

- [ ] **Step 3: Pass bomb props to HUD**

```typescript
<HUD
  // ... existing props
  bombState={bombState}
  bombTimer={bombTimer}
  bombSite={bombSite}
  plantProgress={plantProgress}
  defuseProgress={defuseProgress}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate bomb mechanics into game UI"
```

---

### Task 9: E2E Test for Bomb Objective

**Files:**
- Create: `e2e/bomb-objective.spec.ts`

**Interfaces:**
- Consumes: All previous tasks
- Produces: E2E test for bomb gameplay

- [ ] **Step 1: Write the E2E test**

```typescript
// e2e/bomb-objective.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Bomb Objective', () => {
  test('can see bombsite markers', async ({ page }) => {
    // Start game, verify bombsite markers visible
  })

  test('bomb carrier indicator shows', async ({ page }) => {
    // Start game, verify bomb carrier indicator
  })
})
```

- [ ] **Step 2: Run E2E test**

Run: `npx playwright test e2e/bomb-objective.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/bomb-objective.spec.ts
git commit -m "test: add E2E tests for bomb objective"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test**

1. Start dev server
2. Start competitive match
3. Verify bombsite markers visible on ground
4. Verify A/B markers on minimap
5. Plant bomb at a site
6. Verify bomb timer appears
7. Verify defuse works

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 2 bomb sites objective"
```

---

## Summary

| Task | Deliverable | Tests |
|------|-------------|-------|
| 1 | Bombsite class | Unit tests |
| 2 | BombCarrier class | Unit tests |
| 3 | GameSession integration | Unit tests |
| 4 | Arena bombsite markers | Unit tests |
| 5 | HUD bomb indicators | Component tests |
| 6 | Minimap markers | Component tests |
| 7 | Protocol events | Type tests |
| 8 | App.tsx integration | Integration |
| 9 | E2E tests | E2E tests |
| 10 | Final verification | All tests |

**Total estimated time:** 2-3 hours for experienced developer
