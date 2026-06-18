# Phase 3: New Items + 3D Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add new buy menu items (bomb, defuse kit, heavy armor) with 3D model integration: first-person viewmodel, third-person player model, and buy menu 3D preview.

**Architecture:** Extend `StoreCatalog` with new items, add viewmodel classes for bomb/kit, create `BuyPreview` component for 3D rendering.

**Tech Stack:** TypeScript, React, Three.js, Vitest

## Global Constraints

- TypeScript strict mode
- React 19 + Three.js r170
- Vitest for unit tests
- Follow existing code patterns
- No new dependencies
- Placeholder 3D models (box geometry) initially

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/weapons/StoreCatalog.ts` | Add new items (bomb, defuse kit, heavy armor) |
| `src/weapons/BombModel.ts` | Bomb 3D model for viewmodel |
| `src/weapons/DefuseKitModel.ts` | Defuse kit viewmodel |
| `src/weapons/Viewmodel.ts` | Support objective items |
| `src/ui/BuyPreview.tsx` | 3D preview component |
| `src/ui/BuyMenu.tsx` | Add preview panel |
| `src/net/RemotePlayer.ts` | Third-person armor model |
| `public/models/` | Placeholder 3D models |

---

### Task 1: Add New Items to StoreCatalog

**Files:**
- Modify: `src/weapons/StoreCatalog.ts`
- Modify: `src/weapons/__tests__/StoreCatalog.test.ts`

**Interfaces:**
- Consumes: None
- Produces: New items in catalog

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/weapons/__tests__/StoreCatalog.test.ts
describe('new items', () => {
  it('includes bomb item', () => {
    const bomb = findItem('bomb')
    expect(bomb).toBeDefined()
    expect(bomb!.price).toBe(0)
    expect(bomb!.team).toBe('t')
    expect(bomb!.kind).toBe('objective')
  })

  it('includes defuse kit item', () => {
    const kit = findItem('defuse_kit')
    expect(kit).toBeDefined()
    expect(kit!.price).toBe(400)
    expect(kit!.team).toBe('ct')
    expect(kit!.kind).toBe('gear')
  })

  it('includes heavy armor item', () => {
    const armor = findItem('heavy_armor')
    expect(armor).toBeDefined()
    expect(armor!.price).toBe(1000)
    expect(armor!.kind).toBe('armor')
  })

  it('bomb is free for T team', () => {
    const items = catalogForTeam('t')
    const bomb = items.find(i => i.id === 'bomb')
    expect(bomb).toBeDefined()
    expect(bomb!.price).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/weapons/__tests__/StoreCatalog.test.ts`
Expected: FAIL with "Cannot find item 'bomb'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/weapons/StoreCatalog.ts
export const STORE_CATALOG: StoreItem[] = [
  // ... existing items

  // --- objective (competitive) ---
  { id: 'bomb', name: 'C4 Bomb', price: 0, kind: 'objective', team: 't', icon: 'bomb' },

  // --- gear (competitive) ---
  { id: 'defuse_kit', name: 'Defuse Kit', price: 400, kind: 'gear', team: 'ct', icon: 'defuse_kit' },
  { id: 'heavy_armor', name: 'Heavy Armor', price: 1000, kind: 'armor', icon: 'heavy_armor' },
]

// Update ItemKind in types.ts
export type ItemKind = 'weapon' | 'armor' | 'health' | 'speed' | 'upgrade' | 'objective' | 'gear'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/weapons/__tests__/StoreCatalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/weapons/StoreCatalog.ts src/types.ts
git commit -m "feat: add bomb, defuse kit, and heavy armor to StoreCatalog"
```

---

### Task 2: Create BombModel Class

**Files:**
- Create: `src/weapons/BombModel.ts`
- Create: `src/weapons/__tests__/BombModel.test.ts`

**Interfaces:**
- Consumes: Three.js
- Produces: `BombModel` class for 3D bomb rendering

- [ ] **Step 1: Write the failing test**

```typescript
// src/weapons/__tests__/BombModel.test.ts
import { describe, it, expect } from 'vitest'
import { BombModel } from '../BombModel'

describe('BombModel', () => {
  it('creates a mesh', () => {
    const model = new BombModel()
    expect(model.mesh).toBeDefined()
    model.dispose()
  })

  it('has correct dimensions', () => {
    const model = new BombModel()
    const box = new THREE.Box3().setFromObject(model.mesh)
    expect(box.getSize(new THREE.Vector3()).x).toBeGreaterThan(0)
    model.dispose()
  })

  it('disposes cleanly', () => {
    const model = new BombModel()
    model.dispose()
    expect(model.mesh.parent).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/weapons/__tests__/BombModel.test.ts`
Expected: FAIL with "Cannot find module '../BombModel'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/weapons/BombModel.ts
import * as THREE from 'three'

export class BombModel {
  mesh: THREE.Group

  constructor() {
    this.mesh = new THREE.Group()

    // Placeholder: C4 device (box with timer display)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.15, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    )
    this.mesh.add(body)

    // Timer display
    const display = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.08, 0.01),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    )
    display.position.set(0, 0.08, 0.1)
    this.mesh.add(display)

    // Wires
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    )
    wire.position.set(0.1, 0.08, 0)
    wire.rotation.z = Math.PI / 2
    this.mesh.add(wire)
  }

  dispose(): void {
    this.mesh.parent?.remove(this.mesh)
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/weapons/__tests__/BombModel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/weapons/BombModel.ts src/weapons/__tests__/BombModel.test.ts
git commit -m "feat: add BombModel class for 3D bomb rendering"
```

---

### Task 3: Create DefuseKitModel Class

**Files:**
- Create: `src/weapons/DefuseKitModel.ts`
- Create: `src/weapons/__tests__/DefuseKitModel.test.ts`

**Interfaces:**
- Consumes: Three.js
- Produces: `DefuseKitModel` class for 3D wirecutter rendering

- [ ] **Step 1: Write the failing test**

```typescript
// src/weapons/__tests__/DefuseKitModel.test.ts
import { describe, it, expect } from 'vitest'
import { DefuseKitModel } from '../DefuseKitModel'

describe('DefuseKitModel', () => {
  it('creates a mesh', () => {
    const model = new DefuseKitModel()
    expect(model.mesh).toBeDefined()
    model.dispose()
  })

  it('disposes cleanly', () => {
    const model = new DefuseKitModel()
    model.dispose()
    expect(model.mesh.parent).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/weapons/__tests__/DefuseKitModel.test.ts`
Expected: FAIL with "Cannot find module '../DefuseKitModel'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/weapons/DefuseKitModel.ts
import * as THREE from 'three'

export class DefuseKitModel {
  mesh: THREE.Group

  constructor() {
    this.mesh = new THREE.Group()

    // Placeholder: Wirecutters (two cylinders for handles)
    const handle1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    )
    handle1.position.set(-0.03, 0, 0)
    handle1.rotation.z = 0.3
    this.mesh.add(handle1)

    const handle2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    )
    handle2.position.set(0.03, 0, 0)
    handle2.rotation.z = -0.3
    this.mesh.add(handle2)

    // Cutting head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.02, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x666666 })
    )
    head.position.set(0, 0.1, 0)
    this.mesh.add(head)
  }

  dispose(): void {
    this.mesh.parent?.remove(this.mesh)
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/weapons/__tests__/DefuseKitModel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/weapons/DefuseKitModel.ts src/weapons/__tests__/DefuseKitModel.test.ts
git commit -m "feat: add DefuseKitModel class for 3D wirecutter rendering"
```

---

### Task 4: Update Viewmodel for Objective Items

**Files:**
- Modify: `src/weapons/Viewmodel.ts`
- Modify: `src/weapons/__tests__/Viewmodel.test.ts`

**Interfaces:**
- Consumes: `BombModel`, `DefuseKitModel` (Tasks 2-3)
- Produces: Viewmodel supports bomb/kit display

- [ ] **Step 1: Write the failing test**

```typescript
// Add to viewmodel tests
describe('objective items', () => {
  it('can set bomb viewmodel', () => {
    const vm = new Viewmodel(new THREE.Camera())
    vm.setObjective('bomb')
    expect(vm.currentObjective).toBe('bomb')
    vm.dispose()
  })

  it('can set defuse kit viewmodel', () => {
    const vm = new Viewmodel(new THREE.Camera())
    vm.setObjective('defuse_kit')
    expect(vm.currentObjective).toBe('defuse_kit')
    vm.dispose()
  })

  it('clears objective when switching to weapon', () => {
    const vm = new Viewmodel(new THREE.Camera())
    vm.setObjective('bomb')
    vm.setWeapon('pistol')
    expect(vm.currentObjective).toBeNull()
    vm.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/weapons/__tests__/Viewmodel.test.ts`
Expected: FAIL with "vm.setObjective is not a function"

- [ ] **Step 3: Write minimal implementation**

```typescript
// Add to src/weapons/Viewmodel.ts
import { BombModel } from './BombModel'
import { DefuseKitModel } from './DefuseKitModel'

export class Viewmodel {
  // ... existing code
  currentObjective: 'bomb' | 'defuse_kit' | null = null
  private bombModel: BombModel | null = null
  private defuseKitModel: DefuseKitModel | null = null

  setObjective(type: 'bomb' | 'defuse_kit'): void {
    this.clearObjective()
    this.currentObjective = type

    if (type === 'bomb') {
      this.bombModel = new BombModel()
      this.camera.add(this.bombModel.mesh)
    } else {
      this.defuseKitModel = new DefuseKitModel()
      this.camera.add(this.defuseKitModel.mesh)
    }
  }

  clearObjective(): void {
    if (this.bombModel) {
      this.bombModel.dispose()
      this.bombModel = null
    }
    if (this.defuseKitModel) {
      this.defuseKitModel.dispose()
      this.defuseKitModel = null
    }
    this.currentObjective = null
  }

  setWeapon(type: string): void {
    this.clearObjective()
    // ... existing weapon setting logic
  }

  dispose(): void {
    this.clearObjective()
    // ... existing dispose logic
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/weapons/__tests__/Viewmodel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/weapons/Viewmodel.ts
git commit -m "feat: add objective item support to Viewmodel"
```

---

### Task 5: Create BuyPreview Component

**Files:**
- Create: `src/ui/BuyPreview.tsx`
- Create: `src/ui/__tests__/BuyPreview.test.tsx`

**Interfaces:**
- Consumes: Three.js, `StoreItem`
- Produces: 3D preview component for buy menu

- [ ] **Step 1: Write the failing test**

```typescript
// src/ui/__tests__/BuyPreview.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BuyPreview } from '../BuyPreview'
import { findItem } from '../../weapons/StoreCatalog'

describe('BuyPreview', () => {
  it('renders with no item', () => {
    render(<BuyPreview item={null} />)
    expect(screen.getByText('Select an item')).toBeDefined()
  })

  it('renders with item selected', () => {
    const item = findItem('m4')
    render(<BuyPreview item={item!} />)
    expect(screen.getByText('M4')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/BuyPreview.test.tsx`
Expected: FAIL with "Cannot find module '../BuyPreview'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/ui/BuyPreview.tsx
import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import type { StoreItem } from '../types'

interface BuyPreviewProps {
  item: StoreItem | null
}

export function BuyPreview({ item }: BuyPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const modelRef = useRef<THREE.Group | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.set(0, 0.5, 2)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(200, 200)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    // Animation loop
    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.01
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    if (!sceneRef.current) return

    // Remove old model
    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current)
      modelRef.current = null
    }

    if (!item) return

    // Create placeholder model based on item kind
    const group = new THREE.Group()

    if (item.kind === 'weapon') {
      // Gun shape placeholder
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.1, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x444444 })
      )
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      )
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(0, 0.05, -0.2)
      group.add(body, barrel)
    } else if (item.kind === 'armor') {
      // Vest shape placeholder
      const vest = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.5, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x228B22 })
      )
      group.add(vest)
    } else if (item.kind === 'objective') {
      // Bomb shape
      const bomb = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.15, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      )
      group.add(bomb)
    } else {
      // Generic box
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x666666 })
      )
      group.add(box)
    }

    sceneRef.current.add(group)
    modelRef.current = group
  }, [item])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div ref={containerRef} style={{ width: 200, height: 200, border: '1px solid #3a3a55' }} />
      {item ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 'bold' }}>{item.name}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {item.price === 0 ? 'FREE' : `$${item.price}`}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.5 }}>Select an item</div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/BuyPreview.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/BuyPreview.tsx src/ui/__tests__/BuyPreview.test.tsx
git commit -m "feat: add BuyPreview component for 3D item preview"
```

---

### Task 6: Integrate BuyPreview into BuyMenu

**Files:**
- Modify: `src/ui/BuyMenu.tsx`

**Interfaces:**
- Consumes: `BuyPreview` (Task 5)
- Produces: Buy menu with 3D preview panel

- [ ] **Step 1: Write the failing test**

```typescript
// Add to BuyMenu tests
describe('buy preview', () => {
  it('shows preview when item selected', () => {
    // Test that preview appears
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/BuyMenu.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/ui/BuyMenu.tsx
import { useState } from 'react'
import { BuyPreview } from './BuyPreview'
import type { StoreItem } from '../types'

export function BuyMenu({ team, money, owned, onBuy, onClose }: BuyMenuProps) {
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null)
  // ... existing code

  return (
    <div style={{ /* existing styles */ }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Left: Item grid */}
        <div style={{ flex: 1 }}>
          {/* ... existing item grid */}
          {items.map((item) => {
            const isOwned = owned.includes(item.id)
            const affordable = canAffordItem(money, item.id)
            const disabled = isOwned || !affordable
            return (
              <button
                key={item.id}
                disabled={disabled}
                onClick={() => onBuy(item.id)}
                onMouseEnter={() => setSelectedItem(item)}
                style={{ /* existing styles */ }}
              >
                {/* ... existing button content */}
              </button>
            )
          })}
        </div>

        {/* Right: Preview panel */}
        <div style={{ width: 220, borderLeft: '1px solid #3a3a55', paddingLeft: 16 }}>
          <BuyPreview item={selectedItem} />
        </div>
      </div>

      {/* ... existing close button */}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/BuyMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/BuyMenu.tsx
git commit -m "feat: integrate BuyPreview into BuyMenu"
```

---

### Task 7: Add Third-Person Armor to RemotePlayer

**Files:**
- Modify: `src/net/RemotePlayer.ts`

**Interfaces:**
- Consumes: Three.js
- Produces: Armor visualization on player models

- [ ] **Step 1: Write the failing test**

```typescript
// Add to RemotePlayer tests
describe('armor visualization', () => {
  it('shows vest when armor equipped', () => {
    const rp = new RemotePlayer('test', 'TestPlayer', 'ct')
    rp.setArmor(true)
    expect(rp.hasArmor).toBe(true)
    rp.dispose()
  })

  it('shows helmet when helmet equipped', () => {
    const rp = new RemotePlayer('test', 'TestPlayer', 'ct')
    rp.setHelmet(true)
    expect(rp.hasHelmet).toBe(true)
    rp.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/RemotePlayer.test.ts`
Expected: FAIL with "rp.setArmor is not a function"

- [ ] **Step 3: Write minimal implementation**

```typescript
// Add to src/net/RemotePlayer.ts
export class RemotePlayer {
  // ... existing code
  hasArmor: boolean = false
  hasHelmet: boolean = false
  private vestMesh: THREE.Mesh | null = null
  private helmetMesh: THREE.Mesh | null = null

  setArmor(show: boolean): void {
    this.hasArmor = show
    if (show && !this.vestMesh) {
      this.vestMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x228B22 })
      )
      this.vestMesh.position.set(0, 0, 0)
      this.group.add(this.vestMesh)
    } else if (!show && this.vestMesh) {
      this.group.remove(this.vestMesh)
      this.vestMesh.geometry.dispose()
      this.vestMesh = null
    }
  }

  setHelmet(show: boolean): void {
    this.hasHelmet = show
    if (show && !this.helmetMesh) {
      this.helmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x228B22 })
      )
      this.helmetMesh.position.set(0, 0.9, 0)
      this.group.add(this.helmetMesh)
    } else if (!show && this.helmetMesh) {
      this.group.remove(this.helmetMesh)
      this.helmetMesh.geometry.dispose()
      this.helmetMesh = null
    }
  }

  dispose(): void {
    this.setArmor(false)
    this.setHelmet(false)
    // ... existing dispose logic
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/RemotePlayer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/net/RemotePlayer.ts
git commit -m "feat: add third-person armor visualization to RemotePlayer"
```

---

### Task 8: Update App.tsx for New Items

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working new items in game

- [ ] **Step 1: Write the failing test**

```typescript
// No unit test - integration testing
```

- [ ] **Step 2: Add bomb viewmodel handling**

```typescript
// In src/App.tsx, update buy handler
case 'bomb':
  data.viewmodel?.setObjective('bomb')
  break
case 'defuse_kit':
  data.viewmodel?.setObjective('defuse_kit')
  break
```

- [ ] **Step 3: Add third-person armor sync**

```typescript
// In snapshot sync
if (data.remotePlayers) {
  for (const entity of snap.players) {
    const remote = data.remotePlayers.get(entity.id)
    if (remote) {
      remote.setArmor(entity.hasArmor ?? false)
      remote.setHelmet(entity.hasHelmet ?? false)
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate new items into game UI"
```

---

### Task 9: Create Placeholder 3D Models

**Files:**
- Create: `public/models/bomb.glb` (placeholder)
- Create: `public/models/defuse_kit.glb` (placeholder)

**Interfaces:**
- Consumes: None
- Produces: Placeholder model files

- [ ] **Step 1: Create placeholder files**

Since we can't create actual GLB files, create README files explaining the placeholders:

```markdown
# Placeholder 3D Models

These are placeholder files for the bomb and defuse kit models.

Replace with actual GLB files when available:
- `bomb.glb` - C4 bomb model
- `defuse_kit.glb` - Wirecutter model

The code currently uses procedural geometry (boxes/cylinders) as placeholders.
```

- [ ] **Step 2: Commit**

```bash
git add public/models/
git commit -m "docs: add placeholder 3D model documentation"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test**

1. Start dev server
2. Open buy menu in competitive mode
3. Hover over bomb item - verify 3D preview appears
4. Hover over defuse kit - verify preview
5. Buy heavy armor - verify third-person model shows
6. Equip bomb as T - verify first-person viewmodel

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 3 new items and 3D models"
```

---

## Summary

| Task | Deliverable | Tests |
|------|-------------|-------|
| 1 | StoreCatalog update | Unit tests |
| 2 | BombModel class | Unit tests |
| 3 | DefuseKitModel class | Unit tests |
| 4 | Viewmodel update | Unit tests |
| 5 | BuyPreview component | Component tests |
| 6 | BuyMenu integration | Component tests |
| 7 | RemotePlayer armor | Unit tests |
| 8 | App.tsx integration | Integration |
| 9 | Placeholder models | Documentation |
| 10 | Final verification | All tests |

**Total estimated time:** 2-3 hours for experienced developer
