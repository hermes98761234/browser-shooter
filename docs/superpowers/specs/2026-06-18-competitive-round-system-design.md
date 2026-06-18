# Competitive Round System Design

**Date:** 2026-06-18
**Phase:** 1 of 4
**Status:** Approved

---

## Overview

Add a CS-style competitive game mode with rounds, buy phases, economy, and weapon loss on death. This is the foundation for bomb sites (Phase 2) and new items (Phase 3).

## Goals

- First-to-16 rounds wins (30 max)
- 115-second round timer
- 15-second buy phase at round start
- Weapons lost on death; respawn with default pistol next round
- Economy system with kill rewards, round bonuses, and loss bonuses
- Halftime team swap at round 15
- New `competitive` mode added to MatchConfig

## Architecture

### New Files

- `src/session/RoundManager.ts` — Manages round lifecycle (buy phase, active round, round end)
- `src/session/Economy.ts` — Tracks player money, applies rewards/penalties

### Modified Files

- `src/session/MatchConfig.ts` — Add `competitive` mode, round settings
- `src/session/GameSession.ts` — Integrate RoundManager, weapon loss on death
- `src/session/protocol.ts` — New events (roundStart, roundEnd, buyPhase, etc.)
- `src/ui/BuyMenu.tsx` — Buy phase restrictions, money from Economy
- `src/App.tsx` — Competitive game state, round UI, buy phase flow
- `src/ui/HUD.tsx` — Round timer, buy phase timer, money display

---

## Round Lifecycle

```
[Match Start] → Buy Phase (15s) → Active Round (115s max) → Round End → Repeat
                                                                              ↓
                                                              Halftime (round 15) → Swap sides
                                                                              ↓
                                                              Match End (round 30 or first to 16)
```

### Round States

| State | Duration | Behavior |
|-------|----------|----------|
| `buying` | 15 seconds | Players can buy weapons, movement allowed, weapons cannot fire |
| `active` | 115 seconds max | Full combat, round ends on win condition |
| `over` | 3 seconds | Show round result, then transition to next round's buy phase |

### Round Transitions

1. **Round Start**: Reset positions, set money (first round: $800), open buy phase
2. **Buy Phase End**: Close buy menu, enable weapons, start round timer
3. **Round End**: Determine winner, apply economy rewards, show result
4. **Next Round**: If match not over, transition to buy phase; if halftime, swap teams

---

## Economy System

### Starting Money

| Situation | Amount |
|-----------|--------|
| Match start | $800 |
| Halftime | $800 |
| New round (after round 1) | Carries over from previous round |

### Kill Rewards

| Weapon Type | Reward |
|-------------|--------|
| Pistol | $300 |
| SMG (MP5) | $600 |
| Rifle (M4, AK, AUG, Galil) | $300 |
| Shotgun | $900 |
| Sniper (AWP) | $100 |
| Knife | $1500 |

### Round Rewards

| Outcome | Amount |
|---------|--------|
| Round win | $3250 |
| Round loss (1st loss) | $1400 |
| Round loss (2nd consecutive) | $1900 |
| Round loss (3rd consecutive) | $2400 |
| Round loss (4th consecutive) | $2900 |
| Round loss (5th+ consecutive) | $3400 (cap) |
| Bomb planted | $300 to planter |
| Bomb explodes (T win) | $3400 to all Ts |
| Bomb defused (CT win) | $3250 to all CTs |

### Money Persistence

- Money carries across rounds within a half
- Money resets to $800 at match start and halftime
- Money cannot go below $0

---

## Death During Round

### Current Behavior (to change)
- Player dies → respawn after delay with no weapon loss

### New Behavior (competitive)
- Player dies → **spectate for remainder of round**
- No respawn during round (authentic CS behavior)
- Respawn at round start with:
  - Default pistol (Glock for T, USP for CT)
  - No armor
  - No upgrades
  - Starting money from economy

### Spectator Mode
- Camera follows a living teammate
- Can cycle between teammates with left/right keys
- Show kill feed and round timer
- No interaction with world

---

## Halftime

### Trigger
- After round 15 completes (regardless of score)

### Actions
- Swap team sides (CT ↔ T)
- Reset all player money to $800
- Show halftime screen for 10 seconds
- Resume with round 16 buy phase

### Side Swap Rules
- Players keep their team assignment
- Bomb carrier switches to new T side
- Bombsites swap ownership (A site becomes T side, etc.)

---

## Win Conditions (Per Round)

| Condition | Winner |
|-----------|--------|
| All enemies eliminated | Eliminating team |
| Time expires (115s) | CT (T must plant) |
| Bomb planted + explodes | T |
| Bomb defused | CT |
| All Ts dead (bomb not planted) | CT |
| All CTs dead | T |

### Match Win
- First team to 16 round wins
- If tied 15-15 after 30 rounds: overtime rules (future enhancement)

---

## UI Changes

### HUD Updates
- **Round counter**: "Round 1/30" display
- **Round timer**: Countdown during active round
- **Buy phase timer**: "BUY PHASE: 15s" countdown
- **Money display**: Current money in top-right
- **Team scores**: CT: X | T: Y display

### Buy Menu Changes
- Only accessible during buy phase
- Shows current money from Economy system
- Items that can't be afforded are grayed out
- "ROUND START" button to close buy menu early

### New Overlays
- **Round Start**: "ROUND 1 — FIGHT!" flash
- **Round End**: "CT WINS THE ROUND" or "T WINS THE ROUND"
- **Halftime**: "HALFTIME — SWITCHING SIDES" with scores
- **Match End**: "CT WINS THE MATCH" with final score

---

## Network Protocol Changes

### New Events

```typescript
| { type: 'roundStart'; round: number; money: number; ctScore: number; tScore: number }
| { type: 'roundEnd'; winner: Team; reason: string; ctScore: number; tScore: number }
| { type: 'buyPhaseStart'; duration: number }
| { type: 'buyPhaseEnd' }
| { type: 'playerDied'; playerId: string; spectating: boolean }
| { type: 'moneyUpdate'; playerId: string; amount: number }
| { type: 'halftime'; ctScore: number; tScore: number }
```

### Snapshot Changes

```typescript
interface EntityState {
  // ... existing fields
  money?: number;        // player's current money
  isSpectating?: boolean; // dead and spectating
  spectating?: string;    // player ID being spectated
}

interface Snapshot {
  // ... existing fields
  round: number;
  roundTimer: number;     // seconds remaining
  buyPhase: boolean;
  buyPhaseTimer: number;  // seconds remaining
  ctScore: number;
  tScore: number;
}
```

---

## Testing Strategy

- Unit tests for Economy (rewards, penalties, persistence)
- Unit tests for RoundManager (state transitions, timer)
- Integration test for full round lifecycle
- Integration test for halftime swap
- E2E test for competitive mode flow

---

## Dependencies

- None (standalone feature)

## Deliverables

- `src/session/RoundManager.ts`
- `src/session/Economy.ts`
- Updated `src/session/MatchConfig.ts`
- Updated `src/session/GameSession.ts`
- Updated `src/session/protocol.ts`
- Updated `src/ui/BuyMenu.tsx`
- Updated `src/ui/HUD.tsx`
- Updated `src/App.tsx`
- Tests for all new modules
