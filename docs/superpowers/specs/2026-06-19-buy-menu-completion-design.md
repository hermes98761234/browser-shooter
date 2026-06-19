# Buy Menu Completion — Design

Date: 2026-06-19

## Problem

The buy menu is the in-game store (opened with `B`). Its data catalog
(`src/weapons/StoreCatalog.ts`) and purchase handler (`src/App.tsx` `onBuy`)
already support grenades, the C4 bomb, and the defuse kit — but the UI never
exposes them. `BuyMenu.tsx` hard-codes a `SECTIONS` array that only renders:

- Pistols (`weapon` / secondary)
- Primary (`weapon` / primary)
- Gear (`armor`, `health`, `speed`)
- Upgrades (`upgrade`)

So items of kind `grenade` (HE, Flashbang, Smoke), `objective` (C4 Bomb), and
`gear` (Defuse Kit) are **unreachable through the UI**, even though buying them
is fully wired up.

Secondary gaps found during research:

1. **Missing icons.** Several catalog items reference `icon` names that do not
   exist in `src/ui/icons/weapons.tsx` (`he_grenade`, `flashbang`,
   `smoke_grenade`, `bomb`, `defuse_kit`, `heavy_armor`). `WeaponIcon` falls
   back to a blank grey box for these.
2. **Placeholder 3D preview.** `BuyPreview.tsx` renders crude inline geometry
   and only distinguishes `weapon` / `armor` / `objective`; everything else is a
   generic grey cube — despite dedicated model factories already existing
   (`createGrenadeModel`, `BombModel`, `DefuseKitModel`).
3. **Grenade re-purchase bug.** Grenades are stackable up to a `carryLimit`
   (flashbang = 2), but the `owned[]`-based disable marks a grenade "OWNED" and
   disabled after the first purchase, so a second can never be bought. Worse, the
   purchase handler deducts money before `GrenadeManager.add()`, which silently
   fails at the carry limit.

## Goals

Make every catalog item buyable from the UI, give each a recognizable icon and a
distinct rotating 3D model in the preview panel, and fix grenade stacking. No
changes to game balance, networking authority, or the catalog data itself.

## Changes

### 1. `BuyMenu.tsx` — sections + grenade stacking

- Extend `SECTIONS` with:
  - `{ title: 'Grenades', kinds: ['grenade'] }`
  - `{ title: 'Equipment', kinds: ['objective', 'gear'] }`
- Accept a new `grenadeInventory` prop (`{ he, flash, smoke }`, already tracked
  in `App.tsx`). For `grenade` items, compute disabled state from affordability
  and `count >= carryLimit` (read from `GRENADE_DEFS`) instead of `owned`, and
  show the current count (e.g. `1/2`).
- Non-grenade items keep existing owned/affordability behavior.

### 2. `App.tsx` — purchase guard

- Pass `grenadeInventory` to `<BuyMenu>`.
- In `onBuy`, for grenade items, skip the purchase (no money deduction) when the
  carry limit is already reached. Do not add grenades to `owned[]` (they are
  consumable/stackable, not one-shot unlocks).

### 3. `src/ui/icons/weapons.tsx` — new icons

Add simple `currentColor` SVG icons for: `he_grenade`, `flashbang`,
`smoke_grenade`, `bomb`, `defuse_kit`, `heavy_armor`. Same flat style as the
existing weapon icons.

### 4. `BuyPreview.tsx` — real models

Replace the inline placeholder geometry with the existing model factories,
selected by item:

- `grenade` → `createGrenadeModel('he' | 'flash' | 'smoke')` (mapped by id)
- `objective` (bomb) → `new BombModel().mesh`
- `gear` defuse kit → `new DefuseKitModel().mesh`
- `weapon` → shape scaled by visual class (`pistol` / `shotgun` / `rifle` via
  `weaponVisual`)
- `armor` / `health` / `speed` / `upgrade` → distinct simple shapes

Dispose previous models (geometry + materials) on item change and unmount.

## Testing

- **`src/ui/__tests__/BuyMenu.test.tsx`** — add: Grenades section renders HE /
  Flashbang / Smoke; Equipment section shows C4 for T and Defuse Kit for CT; a
  grenade button is not disabled after being "owned" and is disabled at carry
  limit.
- **`e2e/buy-menu.spec.ts`** — add: open menu, buy a Flashbang (grenade) and a
  piece of equipment, verify reflected in HUD / inventory.
- Existing `StoreCatalog.test.ts` stays green (catalog unchanged).

## Out of scope

- Network money authority and `owned[]` synchronization (pre-existing, separate).
- First-person `Viewmodel.setGrenade` / `playThrowAnimation` hand animation.
