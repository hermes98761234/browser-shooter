**Status**: success
**Summary**: Extended network protocol with grenade state and events for HE, flashbang, and smoke grenades.

## Changes Made

### 1. Added GrenadeState interface
Added `GrenadeState` interface after `EntityState` with properties:
- `id`: unique grenade identifier
- `type`: grenade type ('he' | 'flash' | 'smoke')
- `position`: Vec3 position
- `velocity`: Vec3 velocity
- `rotation`: Vec3 rotation
- `bounces`: bounce count
- `fuseTimer`: time until detonation
- `thrownBy`: player ID who threw it

### 2. Added grenades to Snapshot
Added `grenades: GrenadeState[]` array to the `Snapshot` interface.

### 3. Added grenade events to SessionEvent
Added two new event types to the `SessionEvent` union:
- `grenadeThrown`: Emitted when a player throws a grenade
- `grenadeDetonated`: Emitted when a grenade explodes, with affected players list

## Verification
- TypeScript compilation: PASS (npx tsc --noEmit)
- No errors or warnings

**Files touched**: src/session/protocol.ts
**Findings worth promoting**: (none)