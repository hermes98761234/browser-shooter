# Team-Based Buy Menu with Stat-Affecting Items — Design

**Date:** 2026-06-16
**Status:** Approved (design); pending implementation plan

## Summary

Expand the existing buy menu from a flat 3-weapon list into a full,
Counter-Terrorist vs Terrorist catalog where purchases affect player
properties (armor, max health, movement speed) and weapon stats. Players
pick a side before the match, which drives their available catalog.

This is **Approach A — slot-based loadout**: weapons live in `primary` /
`secondary` slots, gear and upgrades are stat modifiers. Chosen over a flat
"own everything" list because it is the only model that makes a full,
team-specific catalog feel right and makes the "property improves on buy"
mechanic first-class.

## Goals

- A fuller buy menu (pistols, primaries, gear, upgrades).
- CT and T have **different signature weapons**; **gear/upgrades are shared**.
- Buying an item improves a player property: **armor**, **max health**,
  **movement speed**, or **weapon stats**.
- Player picks CT or T before the match; the choice filters the catalog.
- Works in singleplayer and host-authoritative multiplayer.

## Non-Goals

- Full PvP team-vs-team match logic (round economy, win conditions,
  bombsites). Team here is a selectable identity that drives the catalog and
  is shown on entities; combat rules are unchanged.
- New 3D art or audio. New weapons reuse existing visuals/sounds via a
  `weaponType → visualClass` lookup.

## Architecture

### 1. Item & stat model (`src/types.ts`, `src/weapons/StoreCatalog.ts`)

```ts
export type Team = 'ct' | 't'
export type ItemKind = 'weapon' | 'armor' | 'health' | 'speed' | 'upgrade'

export interface StatEffect {
  armor?: number          // +armor points
  maxHealth?: number      // +max HP
  speedMult?: number      // multiplies move speed
  weapon?: Partial<WeaponDef>  // upgrade applied to equipped weapon
}

export interface StoreItem {
  id: string              // 'm4', 'ak', 'kevlar', ...
  name: string
  price: number
  kind: ItemKind
  team?: Team             // omitted = available to both
  slot?: 'primary' | 'secondary'  // weapons only
  weaponType?: WeaponType         // weapons only → links to WEAPON_DEFS
  effects?: StatEffect            // gear/upgrades
}
```

`WeaponType` opens up beyond `pistol | shotgun | rifle` to the full roster.
Each new weapon gets its own `WEAPON_DEFS` entry (distinct
damage/fireRate/spread/etc.) so CT and T weapons actually feel different.
A `weaponType → visualClass` lookup (`rifle | pistol | shotgun | smg |
sniper`) maps new weapons onto existing models/sounds — no new art.

`canAfford` / catalog helpers extend to take the active `team` and current
loadout (owned/equipped state).

### 2. Catalog content

| Slot | Counter-Terrorist | Terrorist | Shared |
|---|---|---|---|
| Secondary | USP $200 | Glock $200 | Pistol (start, owned), Deagle $700 |
| Primary | M4 $2700, AUG $3300 | AK-47 $2500, Galil $2000 | MP5 $1500, Shotgun $1200, AWP $4750 |
| Gear (shared) | — | — | Kevlar (+50 armor) $650; Kevlar+Helmet $1000; Medkit (+25 max HP, full heal) $800; Light Boots (+15% speed) $500 |
| Upgrades (shared) | — | — | Extended Mag (+50% ammo) $300; Fast Reload (−30% reload) $400 |

Prices are starting values, tunable during implementation.

### 3. Player stats layer (`src/player/Player.ts`, `src/systems/HealthSystem.ts`)

- **Armor**: added to `HealthSystem`. `takeDamage(amount)` splits damage when
  `armor > 0` — half to health, half to armor (CS-style); armor depletes,
  then damage goes fully to health. `Player` exposes `armor` getter/setter.
- **Max health**: `maxHealth` becomes mutable; Medkit raises the cap and heals.
- **Speed**: `Player` gains a `speedMult` applied to `this.speed`.
- **Weapon upgrades**: mutate the equipped `Weapon`'s `maxAmmo` / `reloadTime`
  for the life.
- A `Loadout` / `PlayerStats` holder tracks owned gear and equipped weapons so
  it can be reset on death / match restart.

### 4. Slot-based WeaponManager (`src/weapons/WeaponManager.ts`)

Refactor from a fixed 3-element array to slots:

```ts
primary: Weapon | null   // bought
secondary: Weapon        // pistol by default
currentSlot: 'primary' | 'secondary'
equip(weaponType, slot)  // buying a slot replaces what's there
```

- Keys **1** = primary, **2** = secondary; mouse-wheel cycles equipped slots.
- `addAmmo` / `switchTo` / `update` operate over the equipped weapons.

### 5. Team-select flow (`src/App.tsx`, `src/types.ts`, new `src/ui/TeamSelect.tsx`)

- New `GameState: 'teamselect'`, shown before `'playing'` (after singleplayer
  start / after the MP lobby).
- Two-button screen (CT / T) sets `team` in App state and persists a default
  in `Settings`.
- `team` drives the buy-menu catalog filter and is stored on the player entity.

### 6. Buy menu UI (`src/ui/BuyMenu.tsx`)

- Filters `STORE_CATALOG` by `item.team === team || item.team == null`.
- Groups items into headed sections: **Pistols · Primary · Gear · Upgrades**,
  reusing the current inline style.
- Shows owned/equipped state ("OWNED", disabled), affordability greying
  (existing logic), live money, and the active team (CT/T).
- Still toggled by **B**.

### 7. Multiplayer sync (`src/session/protocol.ts`, `src/net/NetHost.ts`, `src/net/NetClient.ts`)

- `EntityState` gains `team?` and `armor?` so remote players render/score
  correctly.
- New `NetMessage`: `{ type: 'buy'; playerId: string; itemId: string }`.
- **Host-authoritative**: host validates team + affordability, applies effects
  to that player's loadout/stats, deducts money, and broadcasts via snapshot.
  Money becomes host-owned per-player in multiplayer; stays local in
  singleplayer.
- Client sends `buy` on click; UI reflects confirmed state from snapshots.

## Data Flow (a purchase)

1. Player opens buy menu (**B**), clicks an affordable, team-valid item.
2. **Singleplayer:** apply effect locally — deduct money, equip weapon or apply
   `StatEffect` to `Player`/`HealthSystem`/equipped `Weapon`.
3. **Multiplayer:** client sends `{ type: 'buy', playerId, itemId }`; host
   validates (team, money, ownership), applies, deducts money, and the result
   propagates in the next snapshot (`team`, `armor`, `weaponType`, `health`,
   `maxHealth`).

## Error Handling

- Unaffordable purchase: button disabled in UI; host rejects defensively
  (no-op, no money change).
- Wrong-team / unknown `itemId`: host rejects (no-op).
- Buying a slot already holding a weapon: replaces it (intended).
- Death / match restart: reset `Loadout`/`PlayerStats` (armor, maxHealth,
  speedMult, weapon upgrades, equipped primary) to defaults.

## Testing

Following existing `__tests__` patterns:

- **Catalog**: team filtering, affordability, owned/equipped state.
- **Stats**: armor damage-split math, max-HP raise + heal, speed multiplier,
  weapon-upgrade application.
- **WeaponManager**: equip/replace per slot, switch, ammo routing.
- **Net**: host validates and applies `buy`; rejects unaffordable / wrong-team /
  unknown item; broadcasts `armor` + `team` in snapshot (extend existing
  `NetHost` / `NetClient` tests).

## Affected Files

- `src/types.ts` — `Team`, `ItemKind`, `StatEffect`, `StoreItem`, expanded
  `WeaponType`, `GameState: 'teamselect'`.
- `src/weapons/WeaponDefs.ts` — full weapon roster + `visualClass` lookup.
- `src/weapons/StoreCatalog.ts` — full catalog, team/loadout-aware helpers.
- `src/weapons/WeaponManager.ts` — slot-based refactor.
- `src/weapons/Weapon.ts` — accept upgrade modifiers.
- `src/player/Player.ts` — `armor`, `speedMult`, mutable max health.
- `src/systems/HealthSystem.ts` — armor damage split, mutable maxHealth.
- `src/ui/BuyMenu.tsx` — sectioned, team-filtered menu.
- `src/ui/TeamSelect.tsx` — new team-select screen.
- `src/session/protocol.ts` — `EntityState` fields, `buy` message.
- `src/net/NetHost.ts`, `src/net/NetClient.ts` — buy handling, money authority.
- `src/App.tsx` — team state, teamselect flow, buy wiring, loadout reset.
- `__tests__` — catalog, stats, weapon manager, net.
