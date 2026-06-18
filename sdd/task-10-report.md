**Status**: success
**Summary**: Integrated grenades into GameSession with throw, simulate, detonate, and snapshot support.

**Deliverable**: Modified `src/session/GameSession.ts` with full grenade lifecycle:
- Added imports for Grenade, GRENADE_DEFS, SmokeCloud, calcHeDamage, calcFlashBlindDuration
- Added `activeGrenades` and `smokeClouds` array properties
- Added `throwGrenade()` method supporting long/short throw modes for he/flash/smoke types
- Added `detonateGrenade()` private method handling HE damage to players/enemies, flash blind detection, and smoke cloud creation
- Added grenade and smoke cloud simulation loops in `step()` after pickup processing
- Updated `getSnapshot()` to include active grenade states in the returned snapshot

**Files touched**: src/session/GameSession.ts
**Findings worth promoting**:
- `tsc --noEmit` is the typecheck command (no npm script alias exists)
- The Snapshot interface already includes `grenades: GrenadeState[]` from protocol.ts, so no protocol changes were needed
