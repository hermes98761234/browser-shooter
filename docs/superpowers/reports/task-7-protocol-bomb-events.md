# Task 7: Update Protocol with Bomb Events

## Summary

Added bomb events and bomb state to the protocol for competitive mode bomb mechanics.

## Changes Made

### 1. SessionEvent Type Updates (`src/session/protocol.ts`)

Added new bomb event types:
- `bombPlanted` - Now includes `planterId: string` and `timer: number` fields
- `bombDropped` - New event with `position: Vec3` and `playerId: string`
- `bombPickedUp` - New event with `playerId: string`
- `bombDefused` - Existing event, unchanged
- `bombExploded` - Existing event, unchanged

### 2. Snapshot Interface Update (`src/session/protocol.ts`)

Added optional `bomb` field to the Snapshot interface:
```typescript
bomb?: {
  state: string
  carrier?: string
  position?: Vec3
  site?: 'A' | 'B'
  timer?: number
  plantProgress?: number
  defuseProgress?: number
}
```

### 3. Tests (`src/session/__tests__/protocol.test.ts`)

Added comprehensive tests for:
- `bombPlanted` event with planterId and timer fields
- `bombDropped` event with position and playerId
- `bombPickedUp` event with playerId
- `bombDefused` event with site
- `bombExploded` event with site
- Snapshot bomb field presence and optionality

## Verification

- ✅ All 22 protocol tests pass
- ✅ TypeScript type check passes (no errors)
- ✅ ESLint passes (only pre-existing warnings)

## Commit

```
fb16d93 feat: add bomb events and bomb state to protocol
```

## Notes

The bomb events were partially implemented (bombPlanted, bombExploded, bombDefused existed). This task added:
1. Missing fields to bombPlanted (planterId, timer)
2. Two new event types (bombDropped, bombPickedUp)
3. Bomb state to the Snapshot interface for client synchronization
