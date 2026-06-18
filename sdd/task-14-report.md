**Status**: success
**Summary**: Added grenade viewmodel support methods to Viewmodel class.

<deliverable body>
Added `setGrenade(type: 'he' | 'flash' | 'smoke')` and `playThrowAnimation()` methods to the Viewmodel class in `src/weapons/Viewmodel.ts`. Both methods are placeholders that delegate to existing weapon handling.

- `setGrenade(type)`: Currently shows pistol model (placeholder for future grenade model)
- `playThrowAnimation()`: Currently calls `fire()` (placeholder for throw animation)

TypeScript type check passes with no errors.
</deliverable>

**Files touched**: src/weapons/Viewmodel.ts
**Findings worth promoting**: (none)