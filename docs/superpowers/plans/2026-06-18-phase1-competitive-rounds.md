# Phase 1: Competitive Round System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CS-style competitive game mode with rounds, buy phases, economy, and weapon loss on death.

**Architecture:** New `RoundManager` handles round lifecycle, new `Economy` tracks money. Both integrate into existing `GameSession`. UI updates show round state and buy phase.

**Tech Stack:** TypeScript, React, Three.js, Vitest

## Global Constraints

- TypeScript strict mode
- React 19 + Three.js r170
- Vitest for unit tests
- Follow existing code patterns (see `src/session/`, `src/weapons/`)
- No new dependencies

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/session/Economy.ts` | Money tracking, kill rewards, round bonuses |
| `src/session/RoundManager.ts` | Round lifecycle, buy phase timing, win conditions |
| `src/session/MatchConfig.ts` | Add `competitive` mode, round settings |
| `src/session/GameSession.ts` | Integrate RoundManager + Economy, weapon loss |
| `src/session/protocol.ts` | New events (roundStart, roundEnd, etc.) |
| `src/ui/BuyMenu.tsx` | Buy phase restrictions |
| `src/ui/HUD.tsx` | Round timer, buy phase timer, money display |
| `src/App.tsx` | Competitive game state, round UI |

---

### Task 1: Economy Class

**Files:**
- Create: `src/session/Economy.ts`
- Create: `src/session/__tests__/Economy.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `Economy` class with `money`, `addMoney()`, `spendMoney()`, `canAfford()`, `reset()`

- [ ] **Step 1: Write the failing test**

```typescript
// src/session/__tests__/Economy.test.ts
import { describe, it, expect } from 'vitest'
import { Economy } from '../Economy'

describe('Economy', () => {
  it('starts with given amount', () => {
    const eco = new Economy(800)
    expect(eco.money).toBe(800)
  })

  it('adds money', () => {
    const eco = new Economy(800)
    eco.addMoney(3250)
    expect(eco.money).toBe(4050)
  })

  it('spends money', () => {
    const eco = new Economy(800)
    eco.spendMoney(200)
    expect(eco.money).toBe(600)
  })

  it('cannot spend more than available', () => {
    const eco = new Economy(800)
    eco.spendMoney(1000)
    expect(eco.money).toBe(800)
  })

  it('can afford returns true when enough money', () => {
    const eco = new Economy(800)
    expect(eco.canAfford(800)).toBe(true)
    expect(eco.canAfford(801)).toBe(false)
  })

  it('cannot go below zero', () => {
    const eco = new Economy(800)
    eco.spendMoney(900)
    expect(eco.money).toBe(800)
  })

  it('resets to given amount', () => {
    const eco = new Economy(800)
    eco.addMoney(5000)
    eco.reset(800)
    expect(eco.money).toBe(800)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/Economy.test.ts`
Expected: FAIL with "Cannot find module '../Economy'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/session/Economy.ts
export class Economy {
  money: number
  private consecutiveLosses: number = 0

  constructor(startMoney: number = 800) {
    this.money = startMoney
  }

  addMoney(amount: number): void {
    this.money += amount
  }

  spendMoney(amount: number): boolean {
    if (amount > this.money) return false
    this.money -= amount
    return true
  }

  canAfford(amount: number): boolean {
    return this.money >= amount
  }

  reset(amount: number = 800): void {
    this.money = amount
    this.consecutiveLosses = 0
  }

  recordWin(): void {
    this.addMoney(3250)
    this.consecutiveLosses = 0
  }

  recordLoss(): void {
    this.consecutiveLosses++
    const bonus = Math.min(1400 + (this.consecutiveLosses - 1) * 500, 3400)
    this.addMoney(bonus)
  }

  recordKillReward(weaponType: string): void {
    const rewards: Record<string, number> = {
      pistol: 300,
      usp: 300,
      glock: 300,
      deagle: 300,
      mp5: 600,
      m4: 300,
      aug: 300,
      ak: 300,
      galil: 300,
      shotgun: 900,
      awp: 100,
      knife: 1500,
    }
    this.addMoney(rewards[weaponType] ?? 300)
  }

  recordBombPlant(): void {
    this.addMoney(300)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/Economy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/Economy.ts src/session/__tests__/Economy.test.ts
git commit -m "feat: add Economy class for competitive mode money tracking"
```

---

### Task 2: RoundManager Class

**Files:**
- Create: `src/session/RoundManager.ts`
- Create: `src/session/__tests__/RoundManager.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `RoundManager` class with round lifecycle management

- [ ] **Step 1: Write the failing test**

```typescript
// src/session/__tests__/RoundManager.test.ts
import { describe, it, expect } from 'vitest'
import { RoundManager, RoundState } from '../RoundManager'

describe('RoundManager', () => {
  it('starts in buying state', () => {
    const rm = new RoundManager()
    expect(rm.state).toBe(RoundState.Buying)
    expect(rm.round).toBe(1)
  })

  it('transitions from buying to active after duration', () => {
    const rm = new RoundManager()
    rm.update(16) // 15s buy phase + 1s extra
    expect(rm.state).toBe(RoundState.Active)
    expect(rm.buyPhase).toBe(false)
  })

  it('counts down buy phase timer', () => {
    const rm = new RoundManager()
    rm.update(5)
    expect(rm.buyPhaseTimer).toBe(10) // 15 - 5 = 10
  })

  it('ends round when timer expires', () => {
    const rm = new RoundManager()
    rm.update(16) // enter active
    rm.update(116) // 115s round timer
    expect(rm.state).toBe(RoundState.Over)
  })

  it('counts down round timer', () => {
    const rm = new RoundManager()
    rm.update(16) // enter active
    rm.update(10)
    expect(rm.roundTimer).toBe(105) // 115 - 10 = 105
  })

  it('advances to next round after over state', () => {
    const rm = new RoundManager()
    rm.update(16) // buying -> active
    rm.update(116) // active -> over
    rm.endRound('ct')
    expect(rm.round).toBe(2)
    expect(rm.state).toBe(RoundState.Buying)
    expect(rm.ctScore).toBe(1)
  })

  it('swaps teams at halftime', () => {
    const rm = new RoundManager()
    rm.setRound(15)
    rm.update(16) // buying -> active
    rm.endRound('ct')
    expect(rm.round).toBe(16)
    expect(rm.isHalftime).toBe(true)
  })

  it('match ends at round 30 or first to 16', () => {
    const rm = new RoundManager()
    rm.setRound(29)
    rm.ctScore = 15
    rm.tScore = 14
    rm.update(16) // active
    rm.endRound('ct')
    expect(rm.matchOver).toBe(true)
    expect(rm.winner).toBe('ct')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/RoundManager.test.ts`
Expected: FAIL with "Cannot find module '../RoundManager'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/session/RoundManager.ts
export enum RoundState {
  Buying = 'buying',
  Active = 'active',
  Over = 'over',
}

export class RoundManager {
  state: RoundState = RoundState.Buying
  round: number = 1
  ctScore: number = 0
  tScore: number = 0
  buyPhaseTimer: number = 15
  roundTimer: number = 115
  isHalftime: boolean = false
  matchOver: boolean = false
  winner: 'ct' | 't' | null = null

  private readonly maxRounds = 30
  private readonly winScore = 16
  private readonly buyPhaseDuration = 15
  private readonly roundDuration = 115

  get buyPhase(): boolean {
    return this.state === RoundState.Buying
  }

  update(dt: number): void {
    if (this.state === RoundState.Buying) {
      this.buyPhaseTimer -= dt
      if (this.buyPhaseTimer <= 0) {
        this.state = RoundState.Active
        this.roundTimer = this.roundDuration
      }
    } else if (this.state === RoundState.Active) {
      this.roundTimer -= dt
      if (this.roundTimer <= 0) {
        this.state = RoundState.Over
        this.roundTimer = 0
      }
    }
  }

  endRound(winner: 'ct' | 't'): void {
    if (winner === 'ct') this.ctScore++
    else this.tScore++

    // Check match end
    if (this.ctScore >= this.winScore || this.tScore >= this.winScore) {
      this.matchOver = true
      this.winner = this.ctScore >= this.winScore ? 'ct' : 't'
      return
    }

    if (this.round >= this.maxRounds) {
      this.matchOver = true
      this.winner = this.ctScore > this.tScore ? 'ct' : 't'
      return
    }

    // Check halftime
    if (this.round === 15) {
      this.isHalftime = true
    }

    // Advance round
    this.round++
    this.state = RoundState.Buying
    this.buyPhaseTimer = this.buyPhaseDuration
  }

  setRound(round: number): void {
    this.round = round
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/RoundManager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/RoundManager.ts src/session/__tests__/RoundManager.test.ts
git commit -m "feat: add RoundManager for competitive round lifecycle"
```

---

### Task 3: Update MatchConfig

**Files:**
- Modify: `src/session/MatchConfig.ts`
- Modify: `src/session/MatchConfig.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `competitive` mode in MatchConfig

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/session/MatchConfig.test.ts
describe('competitive mode', () => {
  it('defaultCompetitiveConfig returns correct defaults', () => {
    const config = defaultCompetitiveConfig()
    expect(config.mode).toBe('competitive')
    expect(config.damagePolicy).toBe('team')
    expect(config.fragLimit).toBe(0) // rounds-based, not frag-based
    expect(config.roundsToWin).toBe(16)
    expect(config.buyPhaseDuration).toBe(15)
    expect(config.roundDuration).toBe(115)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/MatchConfig.test.ts`
Expected: FAIL with "defaultCompetitiveConfig is not defined"

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/session/MatchConfig.ts
export interface MatchConfig {
  mode: GameMode
  damagePolicy: DamagePolicy
  fragLimit: number
  roundsToWin?: number
  buyPhaseDuration?: number
  roundDuration?: number
}

export function defaultCompetitiveConfig(): MatchConfig {
  return {
    mode: 'competitive',
    damagePolicy: 'team',
    fragLimit: 0,
    roundsToWin: 16,
    buyPhaseDuration: 15,
    roundDuration: 115,
  }
}
```

Also update `protocol.ts` to include 'competitive' in GameMode:

```typescript
export type GameMode = 'coop' | 'pvp' | 'hybrid' | 'competitive'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/MatchConfig.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/MatchConfig.ts src/session/MatchConfig.test.ts src/session/protocol.ts
git commit -m "feat: add competitive mode to MatchConfig"
```

---

### Task 4: Integrate RoundManager into GameSession

**Files:**
- Modify: `src/session/GameSession.ts`
- Modify: `src/session/__tests__/GameSession.test.ts`

**Interfaces:**
- Consumes: `RoundManager`, `Economy` (Tasks 1-2)
- Produces: Round-aware GameSession with weapon loss on death

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/session/__tests__/GameSession.test.ts
describe('competitive mode', () => {
  it('creates with RoundManager when mode is competitive', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    expect(session.roundManager).toBeDefined()
    expect(session.economy).toBeDefined()
    expect(session.roundManager.state).toBe(RoundState.Buying)
  })

  it('resets weapons on death in competitive mode', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    // Simulate player death
    session.player.takeDamage(200)
    session.handleDeath(session.localId)
    // Player should have default pistol
    expect(session.weaponManager.current.type).toBe('pistol')
  })

  it('round advances after buy phase', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    session.step(16) // buy phase -> active
    expect(session.roundManager.buyPhase).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/GameSession.test.ts`
Expected: FAIL with "session.roundManager is undefined"

- [ ] **Step 3: Write minimal implementation**

```typescript
// Add to src/session/GameSession.ts
import { RoundManager, RoundState } from './RoundManager'
import { Economy } from './Economy'
import { defaultCompetitiveConfig } from './MatchConfig'

export class GameSession {
  // ... existing code
  roundManager: RoundManager | null = null
  economy: Economy | null = null

  constructor(config: MatchConfig = defaultMatchConfig()) {
    this.config = config
    this.scoreboard = new Scoreboard(config.fragLimit)
    this.addPlayer(LOCAL_ID, 'You', 'ct')

    if (config.mode === 'competitive') {
      this.roundManager = new RoundManager()
      this.economy = new Economy(800)
    }
  }

  handleDeath(playerId: string): void {
    if (this.config.mode === 'competitive') {
      const entity = this.playerMap.get(playerId)
      if (entity) {
        // Reset weapons to default pistol
        entity.weapons.reset()
      }
    }
  }

  step(dt: number): SessionEvent[] {
    const events: SessionEvent[] = []
    this.tick++

    // Update round manager in competitive mode
    if (this.roundManager) {
      this.roundManager.update(dt)
      if (this.roundManager.state === RoundState.Over) {
        // Round ended by timer (CT wins if no bomb planted)
        events.push({ type: 'roundEnd', winner: 'ct', reason: 'time' })
      }
    }

    // ... rest of existing step logic
    return events
  }
}
```

Also add `reset()` to WeaponManager:

```typescript
// Add to src/weapons/WeaponManager.ts
reset(): void {
  this.equip('pistol', 'secondary')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/GameSession.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/GameSession.ts src/weapons/WeaponManager.ts
git commit -m "feat: integrate RoundManager and Economy into GameSession"
```

---

### Task 5: Update Protocol with New Events

**Files:**
- Modify: `src/session/protocol.ts`

**Interfaces:**
- Consumes: None
- Produces: New event types for round lifecycle

- [ ] **Step 1: Write the failing test**

```typescript
// Add to existing test file or create new
describe('protocol events', () => {
  it('includes round events', () => {
    const event: SessionEvent = { type: 'roundStart', round: 1, money: 800 }
    expect(event.type).toBe('roundStart')
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
  | { type: 'roundStart'; round: number; money: number; ctScore: number; tScore: number }
  | { type: 'roundEnd'; winner: 'ct' | 't'; reason: string; ctScore: number; tScore: number }
  | { type: 'buyPhaseStart'; duration: number }
  | { type: 'buyPhaseEnd' }
  | { type: 'halftime'; ctScore: number; tScore: number }
  | { type: 'moneyUpdate'; playerId: string; amount: number }

// Add to Snapshot interface
export interface Snapshot {
  // ... existing fields
  round?: number
  roundTimer?: number
  buyPhase?: boolean
  buyPhaseTimer?: number
  ctScore?: number
  tScore?: number
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/protocol.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/protocol.ts
git commit -m "feat: add round lifecycle events to protocol"
```

---

### Task 6: Update HUD for Competitive Mode

**Files:**
- Modify: `src/ui/HUD.tsx`

**Interfaces:**
- Consumes: RoundManager state, Economy money
- Produces: Round timer, buy phase timer, money display

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/ui/__tests__/UI.test.tsx
describe('competitive HUD', () => {
  it('shows round timer when provided', () => {
    // Test that HUD renders round timer
  })

  it('shows buy phase timer when provided', () => {
    // Test that HUD renders buy phase timer
  })

  it('shows money when provided', () => {
    // Test that HUD renders money
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/UI.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/ui/HUD.tsx props interface
interface HUDProps {
  // ... existing props
  round?: number
  roundTimer?: number
  buyPhase?: boolean
  buyPhaseTimer?: number
  money?: number
  ctScore?: number
  tScore?: number
}

// Add to HUD component render
{props.round !== undefined && (
  <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)' }}>
    <div style={{ fontSize: 18, fontFamily: 'monospace', color: '#fff' }}>
      Round {props.round} | CT: {props.ctScore} - T: {props.tScore}
    </div>
    {props.buyPhase && (
      <div style={{ fontSize: 16, color: '#ffcc00', textAlign: 'center' }}>
        BUY PHASE: {Math.ceil(props.buyPhaseTimer ?? 0)}s
      </div>
    )}
    {!props.buyPhase && (
      <div style={{ fontSize: 16, color: '#fff', textAlign: 'center' }}>
        {Math.ceil(props.roundTimer ?? 0)}s
      </div>
    )}
  </div>
)}

{props.money !== undefined && (
  <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 18, fontFamily: 'monospace', color: '#00ff00' }}>
    ${props.money}
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/UI.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/HUD.tsx
git commit -m "feat: add round timer, buy phase, and money to HUD"
```

---

### Task 7: Update BuyMenu for Buy Phase

**Files:**
- Modify: `src/ui/BuyMenu.tsx`

**Interfaces:**
- Consumes: BuyPhase state, Economy
- Produces: Buy phase restricted menu

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/ui/__tests__/BuyMenu.test.tsx
describe('buy phase', () => {
  it('shows buy phase warning when not in buy phase', () => {
    // Test that menu shows warning
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/BuyMenu.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/ui/BuyMenu.tsx props
interface BuyMenuProps {
  // ... existing props
  buyPhase?: boolean
  buyPhaseTimer?: number
}

// Add to BuyMenu component
{props.buyPhase === false && (
  <div style={{ padding: 16, color: '#ffcc00', textAlign: 'center' }}>
    BUY PHASE ENDED - Wait for next round
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/BuyMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/BuyMenu.tsx
git commit -m "feat: restrict BuyMenu to buy phase only"
```

---

### Task 8: Integrate Competitive Mode into App.tsx

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working competitive mode in the game

- [ ] **Step 1: Write the failing test**

```typescript
// No unit test for App.tsx - this is integration testing
// Will verify with E2E test later
```

- [ ] **Step 2: Update GameSetup flow**

```typescript
// In src/App.tsx, add competitive mode option to MatchSetup
const MODES = [
  { value: 'coop', label: 'Co-op (vs AI)' },
  { value: 'pvp', label: 'Team PvP (no AI)' },
  { value: 'hybrid', label: 'Hybrid (teams + AI)' },
  { value: 'competitive', label: 'Competitive (CS-style)' }, // NEW
]
```

- [ ] **Step 3: Update startGame for competitive mode**

```typescript
// In startGame callback, handle competitive mode
const startGame = useCallback(() => {
  const data = gameDataRef.current
  resetNetworking()
  // ... existing cleanup

  const fresh = new GameSession(data.matchConfig)
  // ... existing setup

  // If competitive, start with buy phase
  if (data.matchConfig.mode === 'competitive' && fresh.roundManager) {
    fresh.roundManager.state = RoundState.Buying
    fresh.roundManager.buyPhaseTimer = 15
  }

  // ... rest of existing startGame
}, [updateGameState, resetNetworking])
```

- [ ] **Step 4: Update game loop for competitive mode**

```typescript
// In engine.onUpdate callback, handle competitive round events
for (const ev of events) {
  // ... existing event handling

  case 'roundEnd':
    // Show round end overlay
    setRoundEnd({ winner: ev.winner, reason: ev.reason })
    setTimeout(() => setRoundEnd(null), 3000)
    break

  case 'buyPhaseStart':
    setStoreOpen(true)
    break

  case 'halftime':
    // Show halftime overlay
    setHalftime(true)
    setTimeout(() => setHalftime(false), 10000)
    break
}
```

- [ ] **Step 5: Pass competitive props to HUD**

```typescript
// In HUD component render
<HUD
  // ... existing props
  round={gameDataRef.current.session.roundManager?.round}
  roundTimer={gameDataRef.current.session.roundManager?.roundTimer}
  buyPhase={gameDataRef.current.session.roundManager?.buyPhase}
  buyPhaseTimer={gameDataRef.current.session.roundManager?.buyPhaseTimer}
  money={gameDataRef.current.economy?.money}
  ctScore={gameDataRef.current.session.roundManager?.ctScore}
  tScore={gameDataRef.current.session.roundManager?.tScore}
/>
```

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate competitive mode into game UI"
```

---

### Task 9: E2E Test for Competitive Mode

**Files:**
- Create: `e2e/competitive.spec.ts`

**Interfaces:**
- Consumes: All previous tasks
- Produces: E2E test verifying competitive mode works

- [ ] **Step 1: Write the E2E test**

```typescript
// e2e/competitive.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Competitive Mode', () => {
  test('can start competitive match', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Multiplayer')
    await page.click('text=Create Room')
    await page.click('text=Competitive')
    await page.click('text=Create Room')
    // Verify lobby shows
    await expect(page.locator('text=Lobby')).toBeVisible()
  })

  test('shows buy phase timer', async ({ page }) => {
    // Start a game and verify buy phase UI appears
  })

  test('shows round timer after buy phase', async ({ page }) => {
    // Start a game, wait for buy phase to end, verify round timer
  })
})
```

- [ ] **Step 2: Run E2E test**

Run: `npx playwright test e2e/competitive.spec.ts`
Expected: PASS (or note failures for manual testing)

- [ ] **Step 3: Commit**

```bash
git add e2e/competitive.spec.ts
git commit -m "test: add E2E tests for competitive mode"
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

1. Start dev server (`npm run dev`)
2. Go to Multiplayer → Create Room → Select Competitive
3. Verify buy phase timer appears
4. Verify money display shows $800
5. Verify round timer appears after buy phase
6. Verify round ends after timer expires
7. Verify new round starts with buy phase

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 1 competitive round system"
```

---

## Summary

| Task | Deliverable | Tests |
|------|-------------|-------|
| 1 | Economy class | Unit tests |
| 2 | RoundManager class | Unit tests |
| 3 | MatchConfig update | Unit tests |
| 4 | GameSession integration | Unit tests |
| 5 | Protocol events | Type tests |
| 6 | HUD updates | Component tests |
| 7 | BuyMenu updates | Component tests |
| 8 | App.tsx integration | Integration |
| 9 | E2E tests | E2E tests |
| 10 | Final verification | All tests |

**Total estimated time:** 2-3 hours for experienced developer
