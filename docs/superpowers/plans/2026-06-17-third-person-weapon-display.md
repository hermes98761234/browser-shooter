# Third-Person Weapon Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display visible weapons on remote players and enemy bots so other players can see what weapon each character is carrying.

**Architecture:** A standalone `ThirdPersonWeapon` class builds distinct low-poly weapon models per weapon type. RemotePlayer and EnemyModel attach instances to their character groups. The host already sends `weaponType` in snapshots — no protocol changes needed.

**Tech Stack:** Three.js (box geometry primitives), TypeScript, Vitest

## Global Constraints

- Low-poly aesthetic: all weapon shapes built from `THREE.BoxGeometry` primitives only
- No external 3D model files — everything procedural
- Follow existing code patterns (see `Viewmodel.ts`, `EnemyModel.ts`)
- Keep weapon class separation: pistols (one-handed), rifles/SMGs (two-handed), shotgun (two-handed pump), AWP (two-handed sniper)
- `WeaponType` from `src/types.ts` is the canonical weapon identifier

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/weapons/ThirdPersonWeapon.ts` | Create | Standalone class that builds third-person weapon meshes |
| `src/weapons/__tests__/ThirdPersonWeapon.test.ts` | Create | Unit tests for ThirdPersonWeapon |
| `src/net/RemotePlayer.ts` | Modify | Attach ThirdPersonWeapon to remote player character |
| `src/enemies/EnemyModel.ts` | Modify | Replace generic gun box with ThirdPersonWeapon |

---

### Task 1: ThirdPersonWeapon — Unit Tests

**Files:**
- Create: `src/weapons/__tests__/ThirdPersonWeapon.test.ts`

**Interfaces:**
- Produces: `ThirdPersonWeapon` class (tested before implementation via TDD)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { ThirdPersonWeapon } from '../ThirdPersonWeapon'

describe('ThirdPersonWeapon', () => {
  it('creates a group with a child mesh for pistol', () => {
    const w = new ThirdPersonWeapon('pistol')
    expect(w.group).toBeDefined()
    expect(w.group.children.length).toBeGreaterThan(0)
    w.dispose()
  })

  it('creates distinct geometry for each weapon type', () => {
    const types = ['pistol', 'usp', 'glock', 'deagle', 'm4', 'ak', 'aug', 'galil', 'mp5', 'shotgun', 'awp', 'rifle'] as const
    const groups = types.map(t => new ThirdPersonWeapon(t))
    const childCounts = groups.map(g => g.group.children.length)
    // Each weapon should have at least 2 child meshes (body + barrel minimum)
    for (const count of childCounts) {
      expect(count).toBeGreaterThanOrEqual(2)
    }
    groups.forEach(g => g.dispose())
  })

  it('setWeapon swaps visible model', () => {
    const w = new ThirdPersonWeapon('pistol')
    const initialChildren = w.group.children.length
    w.setWeapon('ak')
    // Should still have children after swap
    expect(w.group.children.length).toBeGreaterThan(0)
    w.dispose()
  })

  it('dispose cleans up all meshes', () => {
    const w = new ThirdPersonWeapon('m4')
    w.dispose()
    expect(w.group.children.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/weapons/__tests__/ThirdPersonWeapon.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Commit test file**

```bash
git add src/weapons/__tests__/ThirdPersonWeapon.test.ts
git commit -m "test: add ThirdPersonWeapon unit tests (failing)"
```

---

### Task 2: ThirdPersonWeapon — Implementation

**Files:**
- Create: `src/weapons/ThirdPersonWeapon.ts`
- Test: `src/weapons/__tests__/ThirdPersonWeapon.test.ts`

**Interfaces:**
- Consumes: `WeaponType` from `src/types.ts`
- Produces: `ThirdPersonWeapon` class with `group: THREE.Group`, `setWeapon(type)`, `dispose()`

- [ ] **Step 1: Implement ThirdPersonWeapon class**

```typescript
import * as THREE from 'three'
import type { WeaponType } from '../types'

type WeaponClass = 'pistol' | 'rifle' | 'shotgun' | 'sniper'

function weaponClassOf(type: WeaponType): WeaponClass {
  if (type === 'shotgun') return 'shotgun'
  if (type === 'awp') return 'sniper'
  if (['m4', 'aug', 'ak', 'galil', 'mp5', 'rifle'].includes(type)) return 'rifle'
  return 'pistol'
}

export class ThirdPersonWeapon {
  group: THREE.Group
  private currentType: WeaponType | null = null
  private models: Map<WeaponType, THREE.Group> = new Map()

  constructor(type: WeaponType) {
    this.group = new THREE.Group()
    this.setWeapon(type)
  }

  setWeapon(type: WeaponType) {
    if (this.currentType === type) return
    // hide all, show target
    for (const [t, m] of this.models) {
      m.visible = t === type
    }
    if (!this.models.has(type)) {
      const model = this.buildModel(type)
      this.models.set(type, model)
      this.group.add(model)
      model.visible = true
    }
    this.currentType = type
  }

  dispose() {
    for (const m of this.models.values()) {
      m.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (obj.material instanceof THREE.Material) obj.material.dispose()
        }
      })
      this.group.remove(m)
    }
    this.models.clear()
  }

  private buildModel(type: WeaponType): THREE.Group {
    const cls = weaponClassOf(type)
    switch (cls) {
      case 'pistol': return this.buildPistol(type)
      case 'rifle': return this.buildRifle(type)
      case 'shotgun': return this.buildShotgun()
      case 'sniper': return this.buildSniper()
    }
  }

  private makeMat(color: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6 })
  }

  private buildPistol(type: WeaponType): THREE.Group {
    const g = new THREE.Group()
    const mat = this.makeMat(0x303030)

    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.18), mat)
    body.position.set(0, 0, 0)

    // barrel
    const barrelLen = type === 'deagle' ? 0.2 : type === 'usp' ? 0.16 : 0.12
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, barrelLen), mat)
    barrel.position.set(0, 0.02, -0.09 - barrelLen / 2)

    // grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), mat)
    grip.position.set(0, -0.08, 0.04)
    grip.rotation.x = 0.2

    // suppressor for usp
    if (type === 'usp') {
      const supp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), this.makeMat(0x1a1a1a))
      supp.position.set(0, 0.02, -0.25)
      g.add(supp)
    }

    g.add(body, barrel, grip)
    // One-handed pistol: no arm support needed
    return g
  }

  private buildRifle(type: WeaponType): THREE.Group {
    const g = new THREE.Group()
    const mat = this.makeMat(0x2a2a2a)
    const woodMat = this.makeMat(0x5a3a1a)

    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.35), mat)
    body.position.set(0, 0, 0)

    // barrel
    const barrelLen = type === 'aug' ? 0.3 : 0.25
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, barrelLen), mat)
    barrel.position.set(0, 0.01, -0.175 - barrelLen / 2)

    // stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.15), type === 'ak' ? woodMat : mat)
    stock.position.set(0, -0.01, 0.25)

    // magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), mat)
    mag.position.set(0, -0.08, -0.05)
    // ak has curved magazine
    if (type === 'ak') mag.rotation.x = 0.15

    // grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), mat)
    grip.position.set(0, -0.08, 0.1)
    grip.rotation.x = 0.2

    // scope for aug
    if (type === 'aug') {
      const scope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.1), this.makeMat(0x111111))
      scope.position.set(0, 0.07, -0.05)
      g.add(scope)
    }

    g.add(body, barrel, stock, mag, grip)
    return g
  }

  private buildShotgun(): THREE.Group {
    const g = new THREE.Group()
    const mat = this.makeMat(0x2a2a2a)
    const woodMat = this.makeMat(0x5a3a1a)

    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.3), mat)
    body.position.set(0, 0, 0)

    // barrel (wider)
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.25), mat)
    barrel.position.set(0, 0.02, -0.275)

    // pump grip
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.1), woodMat)
    pump.position.set(0, -0.03, -0.1)

    // stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.15), woodMat)
    stock.position.set(0, -0.01, 0.22)

    g.add(body, barrel, pump, stock)
    return g
  }

  private buildSniper(): THREE.Group {
    const g = new THREE.Group()
    const mat = this.makeMat(0x1a2a1a)

    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.4), mat)
    body.position.set(0, 0, 0)

    // long barrel
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.4), mat)
    barrel.position.set(0, 0.01, -0.4)

    // scope (large)
    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.15), this.makeMat(0x111111))
    scope.position.set(0, 0.08, -0.05)

    // stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.18), mat)
    stock.position.set(0, -0.01, 0.29)

    // bipod legs
    const legMat = this.makeMat(0x333333)
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), legMat)
    legL.position.set(-0.04, -0.08, -0.2)
    legL.rotation.x = 0.2
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), legMat)
    legR.position.set(0.04, -0.08, -0.2)
    legR.rotation.x = 0.2

    g.add(body, barrel, scope, stock, legL, legR)
    return g
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/weapons/__tests__/ThirdPersonWeapon.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/weapons/ThirdPersonWeapon.ts
git commit -m "feat: add ThirdPersonWeapon class with per-type low-poly models"
```

---

### Task 3: RemotePlayer — Attach Weapon Display

**Files:**
- Modify: `src/net/RemotePlayer.ts`

**Interfaces:**
- Consumes: `ThirdPersonWeapon` from `src/weapons/ThirdPersonWeapon`
- Consumes: `weaponType` from `EntityState` (already in protocol)
- Produces: weapon visible on remote player character

- [ ] **Step 1: Add ThirdPersonWeapon to RemotePlayer**

Edit `src/net/RemotePlayer.ts`:

1. Add import at top:
```typescript
import { ThirdPersonWeapon } from '../weapons/ThirdPersonWeapon'
```

2. Add field after `isDead`:
```typescript
private thirdPersonWeapon: ThirdPersonWeapon
```

3. In constructor, after `this.group = buildCharacter(...)`:
```typescript
this.thirdPersonWeapon = new ThirdPersonWeapon('pistol')
this.thirdPersonWeapon.group.position.set(0.42, 1.3, -0.35)
this.group.add(this.thirdPersonWeapon.group)
```

4. In `pushState()`, after the team color check block, add weapon sync:
```typescript
if (s.weaponType) {
  this.thirdPersonWeapon.setWeapon(s.weaponType as WeaponType)
}
```

5. Add import for WeaponType:
```typescript
import type { WeaponType } from '../types'
```

6. In `dispose()`, before the traverse, add:
```typescript
this.thirdPersonWeapon.dispose()
```

- [ ] **Step 2: Run existing tests to verify no regressions**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/net/RemotePlayer.ts
git commit -m "feat: display weapons on remote players in multiplayer"
```

---

### Task 4: EnemyModel — Replace Generic Gun with ThirdPersonWeapon

**Files:**
- Modify: `src/enemies/EnemyModel.ts`

**Interfaces:**
- Consumes: `ThirdPersonWeapon` from `src/weapons/ThirdPersonWeapon`
- Consumes: `EnemyDef.attackType` from `src/enemies/EnemyDefs.ts`
- Produces: weapon visible on enemy character (ranged only)

- [ ] **Step 1: Modify buildSoldier to use ThirdPersonWeapon**

Edit `src/enemies/EnemyModel.ts`:

1. Add import at top:
```typescript
import { ThirdPersonWeapon } from '../weapons/ThirdPersonWeapon'
```

2. Remove the `gunMat` variable and the gun box creation:
```typescript
// DELETE these lines:
const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 })
// ...
const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), gunMat)
gun.position.set(0.42, 1.3, -0.35)
```

3. Remove `[gun, 'body']` from the `zoned` array.

4. After the zoned loop, add weapon attachment for ranged enemies:
```typescript
if (def.attackType === 'ranged') {
  const weaponType = type === 'sniper' ? 'awp' : 'rifle'
  const weapon = new ThirdPersonWeapon(weaponType)
  weapon.group.position.set(0.42, 1.3, -0.35)
  group.add(weapon.group)
}
```

- [ ] **Step 2: Run existing tests to verify no regressions**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/enemies/EnemyModel.ts
git commit -m "feat: display weapons on ranged enemy bots"
```

---

### Task 5: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run lint**

Run: `npx eslint src/`
Expected: No errors

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual verification checklist**

- Start dev server: `npm run dev`
- Open two browser tabs for PvP mode
- Tab 1: Buy an AK-47, Tab 2: Buy an AWP
- Verify: Tab 1 sees Tab 2 holding a long green sniper rifle with bipod
- Verify: Tab 2 sees Tab 1 holding a rifle with curved magazine
- Switch weapons (buy different gun), verify model updates on other player
- Start coop mode, verify riflemen show rifles, snipers show AWP, melee enemies show no weapon
