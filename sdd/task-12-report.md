**Status**: success
**Summary**: Integrated grenade inventory, selection, throwing, and buy-menu purchase into App.tsx

**Deliverable body**:
Added grenade state variables (grenadeInventory, selectedGrenade), initialized GrenadeManager in startGame, wired grenade controls (select via 4/5/6 keys, cycle via G, throw via mouse), handled grenade purchases in the buy-menu switch statement (he_grenade, flashbang, smoke_grenade), and passed grenadeInventory/selectedGrenade props to HUD.

**Files touched**: src/App.tsx

**Findings worth promoting**:
- Controls callbacks use typed `GrenadeType` ('he' | 'flash' | 'smoke') and throw mode ('long' | 'short'), requiring proper imports from types.ts
- Pre-existing type errors in test files (missing `grenades` property on Snapshot mocks) are unrelated to this task
