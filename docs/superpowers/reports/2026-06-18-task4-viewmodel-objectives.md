# Task 4: Update Viewmodel for Objective Items

## Status: DONE

## Changes Made

### `src/weapons/Viewmodel.ts`
- Added imports for `BombModel` and `DefuseKitModel`
- Added `currentObjective` public property (`'bomb' | 'defuse_kit' | null`)
- Added private `bombModel`, `defuseKitModel`, and `camera` fields
- Added `setObjective(type)` method — creates and attaches the appropriate model to the camera
- Added `clearObjective()` method — disposes models and resets state
- Updated `setWeapon()` to call `clearObjective()` when switching to a weapon
- Updated `dispose()` to call `clearObjective()` for cleanup

### `src/weapons/__tests__/Viewmodel.test.ts`
- Created test file with 4 tests:
  - Viewmodel creates with camera
  - Can set bomb viewmodel
  - Can set defuse kit viewmodel
  - Clears objective when switching to weapon

## Commit
- `207ff56` feat: add objective item support to Viewmodel

## Test Summary
- 4/4 tests pass
- Full test suite passes (no regressions)

## Self-Review

The implementation follows existing code patterns:
- Uses Three.js `Group` for 3D model attachment (same pattern as existing weapon models)
- Proper resource cleanup via `dispose()` on model swap and class disposal
- `setWeapon()` clears objective, preventing stale objective models from persisting
- `clearObjective()` is idempotent (safe to call multiple times)
- No unnecessary abstractions — minimal changes as required

No concerns found. Implementation matches the plan spec exactly.
