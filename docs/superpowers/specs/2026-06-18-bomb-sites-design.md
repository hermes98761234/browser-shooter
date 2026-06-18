# Bomb Sites + Objective Design

**Date:** 2026-06-18
**Phase:** 2 of 4
**Status:** Approved

---

## Overview

Add CS-style bomb sites (A and B) to the competitive mode. T side carries and plants the bomb; CT side defends and can defuse. Builds on Phase 1's round system.

## Goals

- Two bombsites (A and B) marked on the arena
- T team receives bomb at round start
- Bomb planting mechanic (stand in site, hold key, 3s timer)
- Bomb timer (40s after planting, explodes)
- Defuse mechanic (approach bomb, hold key, 5s with kit / 10s without)
- Bomb drops on carrier death
- Visual indicators on HUD and minimap

## Architecture

### New Files

- `src/session/Bombsite.ts` — Bombsite zone logic, planting/defusing state
- `src/session/BombCarrier.ts` — Bomb carrier state, drop/pickup logic

### Modified Files

- `src/session/GameSession.ts` — Integrate bomb mechanics, round win conditions
- `src/session/protocol.ts` — Bomb events (planted, defusing, exploded, dropped)
- `src/engine/Arena.ts` — Bombsite zone geometry and markers
- `src/ui/HUD.tsx` — Bomb timer, plant/defuse progress
- `src/ui/Minimap.tsx` — Bombsite markers, bomb carrier indicator

---

## Bombsite Layout

### Arena Configuration

```
        [B Site]
           |
    ----[T Spawn]----
           |
        [A Site]
```

- **A Site**: Located at one end of the arena (south)
- **B Site**: Located at the opposite end (north)
- Each site is a circular zone (radius: 4 units)
- Sites are marked with colored floor indicators (red for T, blue for CT)

### Zone Definitions

```typescript
interface BombsiteZone {
  id: 'A' | 'B'
  center: THREE.Vector3
  radius: number
  control: 't' | 'ct'  // current control team
}
```

---

## Bomb Mechanics

### Bomb Carrier

- **Spawn**: At round start, one T player is randomly selected as bomb carrier
- **Visual**: Bomb carrier has a glowing backpack indicator (visible to T team only)
- **Carrying**: Bomb is held in first-person view (like CS)
- **Dropped**: On death, bomb drops at death location
  - Bomb is visible on ground (glowing C4 model)
  - Any T can pick up by walking over it
  - Bomb is visible on T minimap at all times

### Bomb Planting

| Step | Duration | Requirement |
|------|----------|-------------|
| Approach site | - | Must be inside bombsite zone |
| Start plant | 0s | Press and hold '5' key |
| Plant timer | 3 seconds | Must stay in zone, cannot move |
| Bomb planted | 3s | Bomb is now active, 40s timer starts |

**Rules:**
- Only T side can plant
- Must be alive and inside a bombsite zone
- Moving or taking damage cancels the plant
- Planting awards $300 to the planter
- Only one bomb per round (T side has one bomb)

### Bomb Timer

- **Duration**: 40 seconds after planting
- **Visual**: Red flashing indicator on HUD
- **Audio**: Beeping sound (increases in frequency)
- **Explosion**: T wins the round immediately

### Bomb Defusing

| Step | Duration | Requirement |
|------|----------|-------------|
| Approach bomb | - | Must be near planted bomb |
| Start defuse | 0s | Press and hold 'E' key |
| Defuse timer | 5s (with kit) / 10s (without) | Must stay near bomb |
| Bomb defused | 5s/10s | CT wins the round |

**Rules:**
- Only CT side can defuse
- Must be alive and near the bomb
- Moving or taking damage cancels the defuse
- Defuse kit halves the time (10s → 5s)

---

## Round Win Conditions (Updated)

| Condition | Winner | Notes |
|-----------|--------|-------|
| All enemies eliminated | Eliminating team | Standard elimination |
| Time expires (115s) | CT | T failed to plant |
| Bomb planted + explodes (40s) | T | Bomb timer reached zero |
| Bomb defused | CT | Defuse completed |
| All Ts dead (bomb not planted) | CT | Bomb was not planted |
| All CTs dead | T | Bomb can be planted freely |

---

## Visual Indicators

### Bombsite Markers

- **Floor indicators**: Colored circles on the ground at each site
  - Red glow when T controlled
  - Blue glow when CT controlled
  - Pulsing when bomb is planted there

### Minimap

- **A/B markers**: Letters 'A' and 'B' on minimap at site locations
- **Bomb carrier**: Small bomb icon on carrier's position (T team only)
- **Planted bomb**: Flashing bomb icon at planted location (all teams)

### HUD

- **Bomb timer**: Large countdown when bomb is planted
- **Plant progress**: Circular progress bar during planting
- **Defuse progress**: Circular progress bar during defusing
- **Bomb carrier**: "BOMB CARRIER" text on carrier's HUD

---

## Network Protocol Changes

### New Events

```typescript
| { type: 'bombPlanted'; site: 'A' | 'B'; planterId: string; timer: number }
| { type: 'bombDropped'; position: Vec3; playerId: string }
| { type: 'bombPickedUp'; playerId: string }
| { type: 'bombDefused'; defuserId: string; site: 'A' | 'B' }
| { type: 'bombExploded'; site: 'A' | 'B' }
| { type: 'bombPlantStart'; playerId: string; site: 'A' | 'B' }
| { type: 'bombPlantCancel'; playerId: string }
| { type: 'bombDefuseStart'; playerId: string }
| { type: 'bombDefuseCancel'; playerId: string }
```

### Snapshot Changes

```typescript
interface Snapshot {
  // ... existing fields
  bomb?: {
    state: 'carried' | 'dropped' | 'planted' | 'exploded' | 'defused'
    carrier?: string         // player ID carrying bomb
    position?: Vec3          // dropped bomb position
    site?: 'A' | 'B'        // planted site
    timer?: number           // seconds until explosion
    planting?: string        // player ID planting
    defusing?: string        // player ID defusing
  }
}
```

---

## Implementation Details

### Bombsite Class

```typescript
class Bombsite {
  id: 'A' | 'B'
  center: THREE.Vector3
  radius: number
  marker: THREE.Mesh  // visual indicator

  isInside(position: Vec3): boolean
  update(dt: number): void
  dispose(): void
}
```

### BombCarrier Class

```typescript
class BombCarrier {
  state: 'none' | 'carried' | 'dropped' | 'planted'
  carrier: string | null     // player ID
  position: Vec3 | null      // dropped position
  site: 'A' | 'B' | null    // planted site
  timer: number              // countdown
  plantProgress: number      // 0-1
  defuseProgress: number     // 0-1

  pickup(playerId: string): void
  drop(position: Vec3): void
  startPlant(site: 'A' | 'B'): void
  cancelPlant(): void
  startDefuse(): void
  cancelDefuse(): void
  update(dt: number): void
}
```

---

## Testing Strategy

- Unit tests for Bombsite (zone detection)
- Unit tests for BombCarrier (state transitions, plant/defuse timers)
- Integration test for bomb plant → explode flow
- Integration test for bomb plant → defuse flow
- Integration test for bomb drop → pickup flow
- E2E test for full round with bomb objective

---

## Dependencies

- Phase 1: Competitive Round System (round lifecycle, win conditions)

## Deliverables

- `src/session/Bombsite.ts`
- `src/session/BombCarrier.ts`
- Updated `src/session/GameSession.ts`
- Updated `src/session/protocol.ts`
- Updated `src/engine/Arena.ts`
- Updated `src/ui/HUD.tsx`
- Updated `src/ui/Minimap.tsx`
- Tests for all new modules
