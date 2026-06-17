# Third-Person Weapon Display Design

## Goal

Display visible weapons on remote players (PvP multiplayer) and enemy bots (coop mode) so other players can see what weapon each character is carrying, similar to Counter-Strike.

## Current State

- Remote players use `buildCharacter()` which creates weaponless humanoids
- Enemy models have a generic black gun box regardless of enemy type
- `EntityState` protocol already sends `weaponType` but it is unused for rendering
- First-person viewmodel (`Viewmodel.ts`) shows weapons only to the local player

## Approach: Separate ThirdPersonWeapon Class

A standalone `ThirdPersonWeapon` class that builds and attaches third-person weapon meshes to character groups. This keeps weapon code isolated from character model code.

## Components

### 1. `src/weapons/ThirdPersonWeapon.ts` (new file)

A class that:
- Takes a `WeaponType` and builds a distinct low-poly model per weapon using box primitives (3-5 boxes per weapon: body, barrel, grip, stock/scope)
- Returns a `THREE.Group` positioned at the character's right hand area
- Provides `setWeapon(type: WeaponType)` to swap visible model when weapon changes
- Disposes old geometry/material when swapping

**Weapon models (unique per type):**

| Weapon | Class | Distinctive Features |
|--------|-------|---------------------|
| pistol | Pistol | Short barrel, compact body, angled grip |
| usp | Pistol | Slightly longer barrel than pistol, suppressor shape |
| glock | Pistol | Boxier body, shorter barrel |
| deagle | Pistol | Larger body, longer barrel, chunky |
| m4 | Rifle | Collapsed stock, carry handle, standard barrel |
| aug | Rifle | Bullpup shape, integrated scope |
| ak | Rifle | Curved magazine, wooden stock color |
| galil | Rifle | Similar to AK but different magazine angle |
| mp5 | Rifle (SMG) | Compact body, short barrel, vertical magazine |
| rifle | Rifle | Generic carbine shape |
| shotgun | Shotgun | Wide pump grip, short thick barrel |
| awp | Rifle (Sniper) | Very long barrel, large scope box on top |

**Holding poses by weapon class:**

- **Pistols:** One-handed grip, held at right side, slight forward angle (0.15 rad). Left arm stays at side.
- **Rifles/SMGs:** Two-handed grip, right arm forward holding grip, left arm extended to support handguard. Barrel points forward (-Z).
- **Shotgun:** Two-handed grip, pump grip position, wider body. Barrel points forward.
- **AWP (sniper):** Two-handed grip, both hands close to body, very long barrel extends forward. Scope on top.

### 2. Changes to `src/net/RemotePlayer.ts`

- Import `ThirdPersonWeapon` and `weaponVisual`/`weaponType` utilities
- On construction: create `ThirdPersonWeapon`, add to `this.group` at hand position
- In `pushState()`: when `s.weaponType` is provided and differs from current, call `thirdPersonWeapon.setWeapon(type)`
- On `dispose()`: dispose the ThirdPersonWeapon

### 3. Changes to `src/enemies/EnemyModel.ts`

- Import `ThirdPersonWeapon`
- Replace the generic gun box with a `ThirdPersonWeapon` instance
- Use weapon type derived from `EnemyDef.attackType`:
  - `'ranged'` enemies: show a rifle-type weapon (e.g., `'rifle'`)
  - `'melee'` enemies: show no weapon model (bare fists / no ThirdPersonWeapon attached)
- The ThirdPersonWeapon attaches to the same right-arm position as the current gun box

### 4. Network Protocol

No changes needed. `EntityState.weaponType` already exists in `src/session/protocol.ts`.

**Host side:** Verify that the host populates `weaponType` in player snapshots. If not, add it from the player's current weapon state.

**Client side:** `RemotePlayer.pushState()` already receives the full `EntityState`; just read `weaponType` from it.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/weapons/ThirdPersonWeapon.ts` | Create |
| `src/net/RemotePlayer.ts` | Modify — add weapon display |
| `src/enemies/EnemyModel.ts` | Modify — replace generic gun with ThirdPersonWeapon |
| `src/net/NetHost.ts` | Verify — ensure weaponType in snapshots |

## Testing

- **Unit:** Verify `ThirdPersonWeapon` builds valid geometry for each `WeaponType`, `setWeapon()` swaps correctly, `dispose()` cleans up
- **Integration:** Verify `RemotePlayer` shows weapon in a mock scene
- **Manual PvP:** Run two browser tabs, buy different weapons, confirm they are visible on each other's models
- **Manual coop:** Run coop mode, confirm ranged enemies show rifles, melee enemies show no weapon
