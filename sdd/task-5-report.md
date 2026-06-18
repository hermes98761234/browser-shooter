**Status**: success
**Summary**: Added three grenade items (HE, Flashbang, Smoke) to the store catalog with appropriate prices.

## Changes
Added grenade items to `src/weapons/StoreCatalog.ts` after the defuse_kit entry:
- `he_grenade`: HE Grenade, $300, kind: 'grenade'
- `flashbang`: Flashbang, $200, kind: 'grenade'
- `smoke_grenade`: Smoke Grenade, $300, kind: 'grenade'

## Verification
- TypeScript type check: PASS (npx tsc --noEmit)
- Git commit: `910bf1e` on branch `feature/grenades`

**Files touched**: src/weapons/StoreCatalog.ts
**Findings worth promoting**: (none)
