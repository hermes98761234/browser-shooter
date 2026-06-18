# New Items + 3D Models Design

**Date:** 2026-06-18
**Phase:** 3 of 4
**Status:** Approved

---

## Overview

Add new buy menu items (bomb, defuse kit, heavy armor) with 3D model integration: first-person viewmodel, third-person player model, and buy menu 3D preview. Builds on Phase 1 (competitive rounds) and Phase 2 (bomb sites).

## Goals

- New items: Bomb (T), Defuse Kit (CT), Heavy Armor (both)
- First-person viewmodel for bomb and defuse kit
- Third-person model showing armor/helmet on player characters
- Buy menu 3D preview panel with rotating item models
- Integrate with Phase 1 economy and Phase 2 bomb mechanics

## Architecture

### New Files

- `src/weapons/BombModel.ts` — Bomb 3D model for viewmodel and ground
- `src/weapons/DefuseKitModel.ts` — Defuse kit viewmodel
- `src/ui/BuyPreview.tsx` — 3D preview component for buy menu

### Modified Files

- `src/weapons/StoreCatalog.ts` — Add new items
- `src/weapons/Viewmodel.ts` — Bomb/kit viewmodel support
- `src/ui/BuyMenu.tsx` — 3D preview panel integration
- `src/net/RemotePlayer.ts` — Third-person armor model
- `src/player/Player.ts` — Armor state for model display

---

## New Items

### Bomb (T Side)

| Property | Value |
|----------|-------|
| ID | `bomb` |
| Name | C4 Bomb |
| Price | $0 (free, assigned at round start) |
| Kind | `objective` |
| Team | T |
| Icon | `bomb` |

**Effect:**
- Carried by one T player per round
- Enables bomb planting at bombsites
- Drops on carrier death
- Visible in first-person viewmodel when equipped

### Defuse Kit (CT Side)

| Property | Value |
|----------|-------|
| ID | `defuse_kit` |
| Name | Defuse Kit |
| Price | $400 |
| Kind | `gear` |
| Team | CT |
| Icon | `defuse_kit` |

**Effect:**
- Reduces defuse time from 10s to 5s
- Visible in first-person when near planted bomb
- Persists across rounds (bought once per match)

### Heavy Armor

| Property | Value |
|----------|-------|
| ID | `heavy_armor` |
| Name | Heavy Armor |
| Price | $1000 |
| Kind | `armor` |
| Team | Both |
| Icon | `heavy_armor` |

**Effect:**
- Full kevlar (100 armor points)
- Helmet protection (reduced headshot damage)
- Leg protection (reduced leg damage)
- Visible on third-person player model (full vest + helmet)

---

## 3D Model Integration

### First-Person Viewmodel

**Bomb Model:**
- C4 device held in both hands
- Visible when bomb carrier presses weapon switch
- Planting animation: arms extend forward, device placed on ground
- Model loaded from `public/models/bomb.glb` (placeholder: box geometry)

**Defuse Kit Model:**
- Wirecutters held in right hand
- Visible when CT is near a planted bomb
- Defusing animation: arms extend toward bomb
- Model loaded from `public/models/defuse_kit.glb` (placeholder: box geometry)

**Implementation:**
- Extend `Viewmodel` class to support objective items
- Add `setObjective(type: 'bomb' | 'defuse_kit')` method
- Handle animation states (idle, planting, defusing)

### Third-Person Player Model

**Armor Visualization:**
- Currently: Simple box geometry for player model
- Enhancement: Overlay meshes for armor components
  - Vest mesh (chest area)
  - Helmet mesh (head area)
  - Both visible to other players

**Bomb Carrier:**
- Glowing backpack indicator (visible to T team only)
- Bomb model attached to back when not in viewmodel
- Dropping animation when carrier dies

**Implementation:**
- Add optional mesh overlays to `RemotePlayer` class
- Toggle visibility based on player state (armor equipped, bomb carried)
- Use placeholder geometry initially (boxes for vest/helmet)

### Buy Menu 3D Preview

**Preview Panel:**
- Small Three.js scene embedded in buy menu
- Shows rotating 3D model of selected item
- For weapons: shows first-person view of holding the item
- For armor: shows third-person character model with armor
- For bomb/kit: shows the item model

**Implementation:**
- New `BuyPreview` React component
- Creates a mini Three.js renderer
- Loads item models from `public/models/`
- Rotates model on mouse hover
- Shows item stats and description below model

---

## Store Catalog Updates

```typescript
// New items added to STORE_CATALOG
{ id: 'bomb',         name: 'C4 Bomb',       price: 0,    kind: 'objective', team: 't',   icon: 'bomb' },
{ id: 'defuse_kit',   name: 'Defuse Kit',     price: 400,  kind: 'gear',      team: 'ct',  icon: 'defuse_kit' },
{ id: 'heavy_armor',  name: 'Heavy Armor',    price: 1000, kind: 'armor',     icon: 'heavy_armor' },
```

### Item Kinds (Updated)

```typescript
type ItemKind = 'weapon' | 'armor' | 'health' | 'speed' | 'upgrade' | 'objective' | 'gear'
```

---

## Viewmodel Integration

### Current Viewmodel System

- `src/weapons/Viewmodel.ts` handles weapon display
- Supports weapon switching and firing animations
- Renders in first-person camera space

### Extensions

**New Methods:**
```typescript
setObjective(type: 'bomb' | 'defuse_kit'): void
playPlantAnimation(): void
playDefuseAnimation(): void
```

**State Machine:**
```
idle → planting → planted
idle → defusing → defused
```

**Visual States:**
- Idle: Item held in hands
- Planting: Arms extend, item placed on ground
- Defusing: Arms extend toward bomb, wirecutters active

---

## Third-Person Model Updates

### RemotePlayer Changes

**New Properties:**
```typescript
hasArmor: boolean
hasHelmet: boolean
hasBomb: boolean
```

**Visual Updates:**
- `hasArmor`: Show vest mesh on chest
- `hasHelmet`: Show helmet mesh on head
- `hasBomb`: Show backpack bomb indicator

**Implementation:**
- Add optional `THREE.Mesh` overlays to player model
- Toggle visibility based on state
- Sync state via network snapshot

---

## Buy Menu Enhancements

### Layout Change

```
┌─────────────────────────────────────────┐
│  BUY MENU · CT              $8400       │
├──────────────────┬──────────────────────┤
│  [Item Grid]     │  [3D Preview]        │
│  Pistol | Primary│  ┌──────────────┐   │
│  Gear   | Upg.   │  │  Rotating    │   │
│                  │  │  Item Model  │   │
│                  │  └──────────────┘   │
│                  │  [Item Stats]        │
│                  │  Name: M4A4          │
│                  │  Damage: 33          │
│                  │  Price: $2700        │
├──────────────────┴──────────────────────┤
│  CLOSE (B)                              │
└─────────────────────────────────────────┘
```

### Preview Component

```typescript
interface BuyPreviewProps {
  item: StoreItem | null
  team: Team
}
```

**Behavior:**
- Shows when an item is hovered/selected
- Loads appropriate 3D model
- Rotates model slowly
- Displays item stats below

---

## Network Protocol Changes

### Snapshot Updates

```typescript
interface EntityState {
  // ... existing fields
  hasArmor?: boolean
  hasHelmet?: boolean
  hasBomb?: boolean
  hasDefuseKit?: boolean
}
```

### New Events

```typescript
| { type: 'armorPurchased'; playerId: string; armorType: 'kevlar' | 'heavy' }
| { type: 'defuseKitPurchased'; playerId: string }
| { type: 'bombAssigned'; playerId: string }
| { type: 'bombDropped'; position: Vec3 }
| { type: 'bombPickedUp'; playerId: string }
```

---

## Testing Strategy

- Unit tests for new StoreCatalog items
- Unit tests for Viewmodel objective handling
- Unit tests for RemotePlayer armor state
- Visual tests for BuyPreview component
- Integration test for bomb equip → plant → defuse flow
- E2E test for buying armor and seeing model update

---

## Dependencies

- Phase 1: Competitive Round System (economy, buy phase)
- Phase 2: Bomb Sites (bomb mechanics, objective items)

## Deliverables

- `src/weapons/BombModel.ts`
- `src/weapons/DefuseKitModel.ts`
- `src/ui/BuyPreview.tsx`
- Updated `src/weapons/StoreCatalog.ts`
- Updated `src/weapons/Viewmodel.ts`
- Updated `src/ui/BuyMenu.tsx`
- Updated `src/net/RemotePlayer.ts`
- Updated `src/player/Player.ts`
- Placeholder 3D models in `public/models/`
- Tests for all new modules
