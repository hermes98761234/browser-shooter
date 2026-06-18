**Status**: success
**Summary**: Implemented GrenadeManager class with inventory tracking, carry limits, selection, and cycling.

## Deliverable

Created `GrenadeManager` class for managing grenade inventory in the browser shooter game. The implementation provides:

- **Inventory tracking**: Map-based storage of grenade counts per type
- **Carry limits**: Enforced per `GRENADE_DEFS[type].carryLimit` (HE: 1, Flash: 2, Smoke: 1)
- **Selection**: Track currently selected grenade type
- **Cycling**: Round-robin through available grenades
- **Weapon state persistence**: Save/restore last weapon type during grenade use
- **Clear**: Reset inventory (for round start/death)

## Files touched

`src/weapons/GrenadeManager.ts`, `src/weapons/__tests__/GrenadeManager.test.ts`

## Findings worth promoting

- HE and Smoke grenades limited to 1, Flashbangs limited to 2 (per CS-style balance)
- `cycle()` iterates through fixed order: he → flash → smoke → he
- `remove()` automatically deselects if the removed type is selected and inventory depleted