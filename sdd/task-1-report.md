**Status**: success
**Summary**: Successfully added grenade type definitions and stats with type checking passing.

Added `GrenadeType` union type (`'he' | 'flash' | 'smoke'`) to `src/types.ts` and extended `ItemKind` to include `'grenade'`. Created `src/weapons/GrenadeDefs.ts` with:
- `GrenadeDef` interface defining grenade properties (price, carry limit, throw speeds, fuse timer, effect radius, physics params)
- `GRENADE_DEFS` record mapping each grenade type to its stats
- `calcHeDamage()` function for distance-based HE grenade damage
- `calcFlashBlindDuration()` function for flashbang blind duration

Type checking passed with no errors.

**Files touched**: src/types.ts, src/weapons/GrenadeDefs.ts
**Findings worth promoting**: (none)