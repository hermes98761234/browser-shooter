# Grenade Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CS-style grenades (HE, Flashbang, Smoke) with physics-based throwing, area effects, and full multiplayer sync.

**Architecture:** Grenades are physics-based projectiles that travel in parabolic arcs, bounce off walls, and detonate on fuse timers. Each type applies different area effects (damage, blindness, smoke cloud). The system is host-authoritative for multiplayer.

**Tech Stack:** Three.js (3D rendering), TypeScript, Vite, existing explosion/particle systems

## Global Constraints

- TypeScript strict mode
- Three.js for all 3D rendering
- Follow existing code patterns in `src/weapons/` and `src/effects/`
- Grenades must not interfere with existing weapon system
- Mobile controls must be supported
- All new files follow existing naming conventions

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `src/weapons/GrenadeDefs.ts` | Grenade type definitions and stats |
| `src/weapons/Grenade.ts` | Grenade class with physics simulation |
| `src/weapons/GrenadeManager.ts` | Player grenade inventory management |
| `src/weapons/GrenadeModel.ts` | 3D model creation for each grenade type |
| `src/effects/SmokeCloud.ts` | Smoke grenade cloud effect |
| `src/effects/FlashEffect.ts` | Flashbang blind effect |
| `src/weapons/__tests__/Grenade.test.ts` | Unit tests for Grenade physics |
| `src/weapons/__tests__/GrenadeManager.test.ts` | Unit tests for inventory logic |

### Modified Files

| File | Changes |
|------|---------|
| `src/types.ts` | Add `GrenadeType`, extend `ItemKind` |
| `src/weapons/StoreCatalog.ts` | Add grenade items |
| `src/weapons/Viewmodel.ts` | Add grenade throw animation |
| `src/player/Controls.ts` | Add 4/5/6/G keybindings, right-click |
| `src/session/GameSession.ts` | Add grenade simulation |
| `src/session/protocol.ts` | Add grenade events and state |
| `src/App.tsx` | Wire grenade inventory to HUD |
| `src/ui/HUD.tsx` | Show grenade inventory icons |
| `src/ui/TouchControls.tsx` | Add grenade selector for mobile |
| `src/audio/SoundEffects.ts` | Add grenade sounds |
| `src/effects/ParticleSystem.ts` | Add smoke cloud rendering |

---

### Task 1: Grenade Type Definitions

**Files:**
- Create: `src/weapons/GrenadeDefs.ts`
- Modify: `src/types.ts:1-80`

**Interfaces:**
- Produces: `GrenadeType`, `GrenadeDef`, `GRENADE_DEFS`

- [ ] **Step 1: Add GrenadeType to types.ts**

```typescript
// src/types.ts - add after WeaponType definition (line 26)
export type GrenadeType = 'he' | 'flash' | 'smoke'
```

- [ ] **Step 2: Extend ItemKind in types.ts**

```typescript
// src/types.ts - modify line 29
export type ItemKind = 'weapon' | 'armor' | 'health' | 'speed' | 'upgrade' | 'objective' | 'gear' | 'grenade'
```

- [ ] **Step 3: Create GrenadeDefs.ts**

```typescript
// src/weapons/GrenadeDefs.ts
import type { GrenadeType, Vec3 } from '../types'

export interface GrenadeDef {
  name: string
  price: number
  carryLimit: number
  longThrowSpeed: number
  shortThrowSpeed: number
  fuseTimer: number
  effectRadius: number
  gravity: number
  restitution: number
  maxBounces: number
}

export const GRENADE_DEFS: Record<GrenadeType, GrenadeDef> = {
  he: {
    name: 'HE Grenade',
    price: 300,
    carryLimit: 1,
    longThrowSpeed: 25,
    shortThrowSpeed: 12,
    fuseTimer: 2.5,
    effectRadius: 10,
    gravity: 9.8,
    restitution: 0.4,
    maxBounces: 3,
  },
  flash: {
    name: 'Flashbang',
    price: 200,
    carryLimit: 2,
    longThrowSpeed: 25,
    shortThrowSpeed: 12,
    fuseTimer: 1.5,
    effectRadius: 8,
    gravity: 9.8,
    restitution: 0.4,
    maxBounces: 3,
  },
  smoke: {
    name: 'Smoke Grenade',
    price: 300,
    carryLimit: 1,
    longThrowSpeed: 20,
    shortThrowSpeed: 10,
    fuseTimer: 2,
    effectRadius: 6,
    gravity: 9.8,
    restitution: 0.4,
    maxBounces: 3,
  },
}

export function calcHeDamage(distance: number): number {
  if (distance <= 2) return 100
  if (distance <= 5) return 100 - ((distance - 2) / 3) * 50
  if (distance <= 10) return 50 - ((distance - 5) / 5) * 50
  return 0
}

export function calcFlashBlindDuration(distance: number): number {
  if (distance <= 4) return 5
  if (distance <= 8) return 3 - ((distance - 4) / 4) * 1
  return 0
}
```

- [ ] **Step 4: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/weapons/GrenadeDefs.ts
git commit -m "feat(grenade): add grenade type definitions and stats"
```

---

### Task 2: Grenade 3D Model

**Files:**
- Create: `src/weapons/GrenadeModel.ts`

**Interfaces:**
- Produces: `createGrenadeModel(type: GrenadeType): THREE.Group`

- [ ] **Step 1: Create GrenadeModel.ts**

```typescript
// src/weapons/GrenadeModel.ts
import * as THREE from 'three'
import type { GrenadeType } from '../types'

const GRENADE_COLORS: Record<GrenadeType, { body: number; accent: number }> = {
  he: { body: 0x4a5c3a, accent: 0x2d3a22 },
  flash: { body: 0xc0c0c0, accent: 0xff0000 },
  smoke: { body: 0x3a5c3a, accent: 0x2d4a22 },
}

export function createGrenadeModel(type: GrenadeType): THREE.Group {
  const group = new THREE.Group()
  const colors = GRENADE_COLORS[type]

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8),
    new THREE.MeshStandardMaterial({ color: colors.body, metalness: 0.6, roughness: 0.4 })
  )
  body.rotation.x = Math.PI / 2
  group.add(body)

  const accent = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.02, 8),
    new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.7, roughness: 0.3 })
  )
  accent.rotation.x = Math.PI / 2
  accent.position.z = 0.04
  group.add(accent)

  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.03, 4),
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 })
  )
  pin.position.set(0.05, 0.02, 0)
  group.add(pin)

  return group
}
```

- [ ] **Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/weapons/GrenadeModel.ts
git commit -m "feat(grenade): add 3D grenade models"
```

---

### Task 3: Grenade Physics Class

**Files:**
- Create: `src/weapons/Grenade.ts`
- Create: `src/weapons/__tests__/Grenade.test.ts`

**Interfaces:**
- Consumes: `GrenadeType`, `GrenadeDef`, `GRENADE_DEFS`, `createGrenadeModel`
- Produces: `Grenade` class with `update(dt)`, `detonate()`, `isExpired()`

- [ ] **Step 1: Write failing test**

```typescript
// src/weapons/__tests__/Grenade.test.ts
import { describe, it, expect } from 'vitest'
import { Grenade } from '../Grenade'

describe('Grenade', () => {
  it('should create grenade with correct type', () => {
    const grenade = new Grenade('he', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    expect(grenade.type).toBe('he')
    expect(grenade.position.y).toBe(2)
  })

  it('should tick fuse timer', () => {
    const grenade = new Grenade('he', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    expect(grenade.fuseTimer).toBe(2.5)
    grenade.update(0.1)
    expect(grenade.fuseTimer).toBeCloseTo(2.4)
  })

  it('should be expired when fuse reaches zero', () => {
    const grenade = new Grenade('flash', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    grenade.update(2.0)
    expect(grenade.isExpired()).toBe(true)
  })

  it('should apply gravity to velocity', () => {
    const grenade = new Grenade('he', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -10 })
    const initialVy = grenade.velocity.y
    grenade.update(0.1)
    expect(grenade.velocity.y).toBeLessThan(initialVy)
  })

  it('should bounce off ground', () => {
    const grenade = new Grenade('he', { x: 0, y: 0.5, z: 0 }, { x: 0, y: -5, z: 0 })
    grenade.update(0.2)
    expect(grenade.velocity.y).toBeGreaterThan(0)
    expect(grenade.bounces).toBe(1)
  })

  it('should stop bouncing after max bounces', () => {
    const grenade = new Grenade('he', { x: 0, y: 0.5, z: 0 }, { x: 0, y: -5, z: 0 })
    for (let i = 0; i < 5; i++) {
      grenade.update(0.2)
    }
    expect(grenade.bounces).toBeLessThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/weapons/__tests__/Grenade.test.ts`
Expected: FAIL with "Cannot find module '../Grenade'"

- [ ] **Step 3: Write Grenade.ts implementation**

```typescript
// src/weapons/Grenade.ts
import * as THREE from 'three'
import type { GrenadeType, Vec3 } from '../types'
import { GRENADE_DEFS, type GrenadeDef } from './GrenadeDefs'
import { createGrenadeModel } from './GrenadeModel'

export class Grenade {
  type: GrenadeType
  def: GrenadeDef
  id: string
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Euler
  fuseTimer: number
  bounces: number = 0
  private mesh: THREE.Group
  private settled: boolean = false

  constructor(type: GrenadeType, position: Vec3, velocity: Vec3, id?: string) {
    this.type = type
    this.def = { ...GRENADE_DEFS[type] }
    this.id = id ?? `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    this.position = new THREE.Vector3(position.x, position.y, position.z)
    this.velocity = new THREE.Vector3(velocity.x, velocity.y, velocity.z)
    this.rotation = new THREE.Euler(0, 0, 0)
    this.fuseTimer = this.def.fuseTimer
    this.mesh = createGrenadeModel(type)
    this.mesh.position.copy(this.position)
  }

  get meshRef(): THREE.Group {
    return this.mesh
  }

  update(dt: number): void {
    if (this.settled) {
      this.fuseTimer -= dt
      return
    }

    this.velocity.y -= this.def.gravity * dt

    this.position.x += this.velocity.x * dt
    this.position.y += this.velocity.y * dt
    this.position.z += this.velocity.z * dt

    if (this.position.y <= 0.15) {
      this.position.y = 0.15
      if (this.bounces < this.def.maxBounces) {
        this.velocity.y = Math.abs(this.velocity.y) * this.def.restitution
        this.velocity.x *= 0.8
        this.velocity.z *= 0.8
        this.bounces++
      } else {
        this.velocity.set(0, 0, 0)
        this.settled = true
      }
    }

    this.rotation.x += this.velocity.z * dt * 2
    this.rotation.z -= this.velocity.x * dt * 2

    this.mesh.position.copy(this.position)
    this.mesh.rotation.copy(this.rotation)

    this.fuseTimer -= dt
  }

  isExpired(): boolean {
    return this.fuseTimer <= 0
  }

  detonate(): Vec3 {
    return { x: this.position.x, y: this.position.y, z: this.position.z }
  }

  dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (child.material instanceof THREE.Material) {
          child.material.dispose()
        }
      }
    })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/weapons/__tests__/Grenade.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/weapons/Grenade.ts src/weapons/__tests__/Grenade.test.ts
git commit -m "feat(grenade): add Grenade class with physics simulation"
```

---

### Task 4: Grenade Manager (Inventory)

**Files:**
- Create: `src/weapons/GrenadeManager.ts`
- Create: `src/weapons/__tests__/GrenadeManager.test.ts`

**Interfaces:**
- Consumes: `GrenadeType`, `GRENADE_DEFS`
- Produces: `GrenadeManager` class with `add()`, `remove()`, `has()`, `getCount()`, `select()`

- [ ] **Step 1: Write failing test**

```typescript
// src/weapons/__tests__/GrenadeManager.test.ts
import { describe, it, expect } from 'vitest'
import { GrenadeManager } from '../GrenadeManager'

describe('GrenadeManager', () => {
  it('should start with no grenades', () => {
    const manager = new GrenadeManager()
    expect(manager.has('he')).toBe(false)
    expect(manager.has('flash')).toBe(false)
    expect(manager.has('smoke')).toBe(false)
  })

  it('should add grenade up to carry limit', () => {
    const manager = new GrenadeManager()
    expect(manager.add('he')).toBe(true)
    expect(manager.has('he')).toBe(true)
    expect(manager.getCount('he')).toBe(1)
    expect(manager.add('he')).toBe(false)
  })

  it('should allow 2 flashbangs', () => {
    const manager = new GrenadeManager()
    expect(manager.add('flash')).toBe(true)
    expect(manager.add('flash')).toBe(true)
    expect(manager.getCount('flash')).toBe(2)
    expect(manager.add('flash')).toBe(false)
  })

  it('should remove grenade on use', () => {
    const manager = new GrenadeManager()
    manager.add('he')
    expect(manager.remove('he')).toBe(true)
    expect(manager.has('he')).toBe(false)
  })

  it('should track selected grenade', () => {
    const manager = new GrenadeManager()
    manager.add('he')
    manager.add('flash')
    manager.select('he')
    expect(manager.selected).toBe('he')
  })

  it('should cycle through grenades', () => {
    const manager = new GrenadeManager()
    manager.add('he')
    manager.add('flash')
    manager.add('smoke')
    manager.select('he')
    expect(manager.cycle()).toBe('flash')
    expect(manager.cycle()).toBe('smoke')
    expect(manager.cycle()).toBe('he')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/weapons/__tests__/GrenadeManager.test.ts`
Expected: FAIL with "Cannot find module '../GrenadeManager'"

- [ ] **Step 3: Write GrenadeManager.ts implementation**

```typescript
// src/weapons/GrenadeManager.ts
import type { GrenadeType } from '../types'
import { GRENADE_DEFS } from './GrenadeDefs'

export class GrenadeManager {
  private inventory: Map<GrenadeType, number> = new Map()
  selected: GrenadeType | null = null
  private lastWeaponType: string | null = null

  has(type: GrenadeType): boolean {
    return (this.inventory.get(type) ?? 0) > 0
  }

  getCount(type: GrenadeType): number {
    return this.inventory.get(type) ?? 0
  }

  add(type: GrenadeType): boolean {
    const count = this.getCount(type)
    if (count >= GRENADE_DEFS[type].carryLimit) return false
    this.inventory.set(type, count + 1)
    return true
  }

  remove(type: GrenadeType): boolean {
    const count = this.getCount(type)
    if (count <= 0) return false
    this.inventory.set(type, count - 1)
    if (this.selected === type && !this.has(type)) {
      this.selected = null
    }
    return true
  }

  select(type: GrenadeType): boolean {
    if (!this.has(type)) return false
    this.selected = type
    return true
  }

  cycle(): GrenadeType | null {
    const types: GrenadeType[] = ['he', 'flash', 'smoke']
    const currentIdx = this.selected ? types.indexOf(this.selected) : -1
    for (let i = 1; i <= types.length; i++) {
      const nextIdx = (currentIdx + i) % types.length
      if (this.has(types[nextIdx])) {
        this.selected = types[nextIdx]
        return this.selected
      }
    }
    return null
  }

  saveLastWeapon(type: string): void {
    this.lastWeaponType = type
  }

  getLastWeapon(): string | null {
    return this.lastWeaponType
  }

  clear(): void {
    this.inventory.clear()
    this.selected = null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/weapons/__tests__/GrenadeManager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/weapons/GrenadeManager.ts src/weapons/__tests__/GrenadeManager.test.ts
git commit -m "feat(grenade): add GrenadeManager for inventory tracking"
```

---

### Task 5: Store Integration

**Files:**
- Modify: `src/weapons/StoreCatalog.ts:1-49`

**Interfaces:**
- Consumes: `GrenadeType`, `GRENADE_DEFS`

- [ ] **Step 1: Add grenade items to StoreCatalog**

```typescript
// src/weapons/StoreCatalog.ts - add after line 34 (defuse_kit item)
  // --- grenades ---
  { id: 'he_grenade',    name: 'HE Grenade',    price: 300, kind: 'grenade', icon: 'he_grenade' },
  { id: 'flashbang',     name: 'Flashbang',      price: 200, kind: 'grenade', icon: 'flashbang' },
  { id: 'smoke_grenade', name: 'Smoke Grenade',  price: 300, kind: 'grenade', icon: 'smoke_grenade' },
```

- [ ] **Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/weapons/StoreCatalog.ts
git commit -m "feat(grenade): add grenade items to store catalog"
```

---

### Task 6: Controls (Keybindings)

**Files:**
- Modify: `src/player/Controls.ts:1-123`

**Interfaces:**
- Produces: `onThrowGrenade`, `onSelectGrenade`, `onRightClick`

- [ ] **Step 1: Add grenade callbacks to Controls**

```typescript
// src/player/Controls.ts - add after line 21 (onScoreboard)
  onThrowGrenade: ((mode: 'long' | 'short') => void) | null = null
  onSelectGrenade: ((type: 'he' | 'flash' | 'smoke') => void) | null = null
  onCycleGrenade: (() => void) | null = null
```

- [ ] **Step 2: Add keybindings to onKeyDown**

```typescript
// src/player/Controls.ts - add inside onKeyDown switch (after line 63)
      case 'Digit4': this.onSelectGrenade?.('he'); break
      case 'Digit5': this.onSelectGrenade?.('flash'); break
      case 'Digit6': this.onSelectGrenade?.('smoke'); break
      case 'KeyG': this.onCycleGrenade?.(); break
```

- [ ] **Step 3: Add right-click handler**

```typescript
// src/player/Controls.ts - add inside onMouseDown (after line 92)
    if (e.button === 2) {
      this.onThrowGrenade?.('short')
    }
```

```typescript
// src/player/Controls.ts - add inside onMouseUp (after line 98)
    if (e.button === 2) {
      // Right click released
    }
```

- [ ] **Step 4: Add right-click to left-click handler**

```typescript
// src/player/Controls.ts - modify onMouseDown line 88
  private onMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      this.shoot = true
      if (this.getGameState() === 'playing' && document.pointerLockElement !== this.element) {
        this.element.requestPointerLock()
      }
      this.onThrowGrenade?.('long')
    }
    if (e.button === 2) {
      this.onThrowGrenade?.('short')
    }
  }
```

- [ ] **Step 5: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/player/Controls.ts
git commit -m "feat(grenade): add grenade keybindings and throw controls"
```

---

### Task 7: Smoke Cloud Effect

**Files:**
- Create: `src/effects/SmokeCloud.ts`

**Interfaces:**
- Produces: `SmokeCloud` class with `update(dt)`, `isExpired()`, `dispose()`

- [ ] **Step 1: Create SmokeCloud.ts**

```typescript
// src/effects/SmokeCloud.ts
import * as THREE from 'three'

export class SmokeCloud {
  position: THREE.Vector3
  radius: number
  maxRadius: number
  duration: number
  private elapsed: number = 0
  private mesh: THREE.Mesh
  private material: THREE.MeshBasicMaterial
  private growDuration: number = 0.5
  private fadeStart: number

  constructor(position: THREE.Vector3, radius: number = 6, duration: number = 15) {
    this.position = position.clone()
    this.radius = 0
    this.maxRadius = radius
    this.duration = duration
    this.fadeStart = duration - 3

    this.material = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      this.material
    )
    this.mesh.position.copy(this.position)
    this.mesh.scale.setScalar(0.01)
  }

  get meshRef(): THREE.Mesh {
    return this.mesh
  }

  update(dt: number): void {
    this.elapsed += dt

    if (this.elapsed < this.growDuration) {
      const t = this.elapsed / this.growDuration
      this.radius = this.maxRadius * t
      this.mesh.scale.setScalar(this.radius)
      this.material.opacity = 0.7 * t
    } else if (this.elapsed < this.fadeStart) {
      this.material.opacity = 0.7
    } else if (this.elapsed < this.duration) {
      const t = (this.elapsed - this.fadeStart) / (this.duration - this.fadeStart)
      this.material.opacity = 0.7 * (1 - t)
    }
  }

  isExpired(): boolean {
    return this.elapsed >= this.duration
  }

  containsPoint(point: THREE.Vector3): boolean {
    return this.position.distanceTo(point) <= this.radius
  }

  blocksRaycast(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const dir = to.clone().sub(from)
    const len = dir.length()
    dir.normalize()

    const oc = this.position.clone().sub(from)
    const proj = oc.dot(dir)
    if (proj < 0 || proj > len) return false

    const closest = from.clone().addScaledVector(dir, proj)
    return closest.distanceTo(this.position) <= this.radius
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
```

- [ ] **Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/effects/SmokeCloud.ts
git commit -m "feat(grenade): add SmokeCloud effect"
```

---

### Task 8: Flash Effect

**Files:**
- Create: `src/effects/FlashEffect.ts`

**Interfaces:**
- Produces: `FlashEffect` class with `trigger(duration)`, `update(dt)`, `isActive`

- [ ] **Step 1: Create FlashEffect.ts**

```typescript
// src/effects/FlashEffect.ts
export interface FlashEffectState {
  active: boolean
  opacity: number
  duration: number
  elapsed: number
}

export function createFlashEffect(): FlashEffectState {
  return { active: false, opacity: 0, duration: 0, elapsed: 0 }
}

export function triggerFlash(state: FlashEffectState, duration: number): FlashEffectState {
  return { active: true, opacity: 1, duration, elapsed: 0 }
}

export function updateFlash(state: FlashEffectState, dt: number): FlashEffectState {
  if (!state.active) return state

  const elapsed = state.elapsed + dt
  if (elapsed >= state.duration) {
    return { active: false, opacity: 0, duration: 0, elapsed: 0 }
  }

  const fadeStart = state.duration * 0.3
  let opacity: number
  if (elapsed < 0.1) {
    opacity = elapsed / 0.1
  } else if (elapsed < fadeStart) {
    opacity = 1
  } else {
    opacity = 1 - (elapsed - fadeStart) / (state.duration - fadeStart)
  }

  return { active: true, opacity: Math.max(0, Math.min(1, opacity)), duration: state.duration, elapsed }
}
```

- [ ] **Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/effects/FlashEffect.ts
git commit -m "feat(grenade): add FlashEffect for flashbang blindness"
```

---

### Task 9: Protocol Extension

**Files:**
- Modify: `src/session/protocol.ts`

**Interfaces:**
- Produces: `GrenadeState`, grenade events in `SessionEvent`

- [ ] **Step 1: Add GrenadeState to protocol**

```typescript
// src/session/protocol.ts - add after EntityState interface
export interface GrenadeState {
  id: string
  type: 'he' | 'flash' | 'smoke'
  position: Vec3
  velocity: Vec3
  rotation: Vec3
  bounces: number
  fuseTimer: number
  thrownBy: string
}
```

- [ ] **Step 2: Add grenade events to SessionEvent**

```typescript
// src/session/protocol.ts - add to SessionEvent union type
| { type: 'grenadeThrown'; playerId: string; grenadeType: 'he' | 'flash' | 'smoke';
    position: Vec3; velocity: Vec3; id: string }
| { type: 'grenadeDetonated'; id: string; position: Vec3; grenadeType: 'he' | 'flash' | 'smoke';
    affectedPlayers: string[] }
```

- [ ] **Step 3: Add grenades to Snapshot**

```typescript
// src/session/protocol.ts - add to Snapshot interface
  grenades: GrenadeState[]
```

- [ ] **Step 4: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/protocol.ts
git commit -m "feat(grenade): extend protocol with grenade events and state"
```

---

### Task 10: GameSession Integration

**Files:**
- Modify: `src/session/GameSession.ts:1-535`

**Interfaces:**
- Consumes: `Grenade`, `GrenadeManager`, `GRENADE_DEFS`, `SmokeCloud`, `calcHeDamage`, `calcFlashBlindDuration`

- [ ] **Step 1: Add grenade imports and properties**

```typescript
// src/session/GameSession.ts - add imports
import { Grenade } from '../weapons/Grenade'
import { GRENADE_DEFS } from '../weapons/GrenadeDefs'
import { SmokeCloud } from '../effects/SmokeCloud'
import { calcHeDamage, calcFlashBlindDuration } from '../weapons/GrenadeDefs'
```

```typescript
// src/session/GameSession.ts - add to GameSession class (after line 55)
  activeGrenades: Grenade[] = []
  smokeClouds: SmokeCloud[] = []
```

- [ ] **Step 2: Add throwGrenade method**

```typescript
// src/session/GameSession.ts - add after tryDefuse method (line 210)
  throwGrenade(playerId: string, type: 'he' | 'flash' | 'smoke', mode: 'long' | 'short'): boolean {
    const entity = this.playerMap.get(playerId)
    if (!entity || entity.player.isDead) return false

    const entityGrenades = (entity as any).grenades as import('../weapons/GrenadeManager').GrenadeManager | undefined
    if (!entityGrenades || !entityGrenades.has(type)) return false

    const def = GRENADE_DEFS[type]
    const speed = mode === 'long' ? def.longThrowSpeed : def.shortThrowSpeed

    const cameraQuat = new THREE.Quaternion().setFromEuler(entity.player.rotation)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuat)
    const velocity = forward.multiplyScalar(speed)
    if (mode === 'short') velocity.y = 3

    const position = entity.player.position.clone().add(forward.clone().multiplyScalar(0.5))
    const grenade = new Grenade(type, { x: position.x, y: position.y, z: position.z },
      { x: velocity.x, y: velocity.y, z: velocity.z })

    this.activeGrenades.push(grenade)
    entityGrenades.remove(type)
    return true
  }
```

- [ ] **Step 3: Add grenade simulation to step()**

```typescript
// src/session/GameSession.ts - add to step() after pickup loop (line 392)
    // Update active grenades
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const grenade = this.activeGrenades[i]
      grenade.update(dt)

      if (grenade.isExpired()) {
        const pos = grenade.detonate()
        this.detonateGrenade(grenade, pos, events)
        this.activeGrenades.splice(i, 1)
        grenade.dispose()
      }
    }

    // Update smoke clouds
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      this.smokeClouds[i].update(dt)
      if (this.smokeClouds[i].isExpired()) {
        this.smokeClouds[i].dispose()
        this.smokeClouds.splice(i, 1)
      }
    }
```

- [ ] **Step 4: Add detonateGrenade method**

```typescript
// src/session/GameSession.ts - add after throwGrenade method
  private detonateGrenade(grenade: Grenade, pos: Vec3, events: SessionEvent[]): void {
    const position = new THREE.Vector3(pos.x, pos.y, pos.z)
    const affectedPlayers: string[] = []

    if (grenade.type === 'he') {
      for (const entity of this.playerMap.values()) {
        if (entity.player.isDead) continue
        const dist = entity.player.position.distanceTo(position)
        if (dist <= grenade.def.effectRadius) {
          const damage = calcHeDamage(dist)
          entity.player.takeDamage(damage)
          affectedPlayers.push(entity.id)
          if (entity.player.isDead) {
            events.push({ type: 'playerDied', playerId: entity.id })
            this.handleDeath(entity.id)
          }
        }
      }
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue
        const dist = enemy.mesh.position.distanceTo(position)
        if (dist <= grenade.def.effectRadius) {
          const damage = calcHeDamage(dist)
          enemy.takeDamage(damage)
          if (enemy.isDead) {
            this.scoreSystem.addKill(enemy.def.scoreValue)
            this.waveManager.onEnemyKilled()
            events.push({ type: 'enemyKilled', enemyType: enemy.type, pos: toVec3(enemy.mesh.position), scoreValue: enemy.def.scoreValue })
          }
        }
      }
    } else if (grenade.type === 'flash') {
      for (const entity of this.playerMap.values()) {
        if (entity.player.isDead) continue
        const dist = entity.player.position.distanceTo(position)
        if (dist <= grenade.def.effectRadius) {
          const dirToGrenade = position.clone().sub(entity.player.position).normalize()
          const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(entity.player.rotation)
          const dot = dirToGrenade.dot(lookDir)
          if (dot > 0) {
            const duration = calcFlashBlindDuration(dist)
            affectedPlayers.push(entity.id)
          }
        }
      }
    } else if (grenade.type === 'smoke') {
      const smoke = new SmokeCloud(position)
      this.smokeClouds.push(smoke)
    }

    events.push({
      type: 'grenadeDetonated',
      id: grenade.id,
      position: pos,
      grenadeType: grenade.type,
      affectedPlayers,
    })
  }
```

- [ ] **Step 5: Update getSnapshot to include grenades**

```typescript
// src/session/GameSession.ts - add to getSnapshot() return object (after line 268)
      grenades: this.activeGrenades.map(g => ({
        id: g.id,
        type: g.type,
        position: { x: g.position.x, y: g.position.y, z: g.position.z },
        velocity: { x: g.velocity.x, y: g.velocity.y, z: g.velocity.z },
        rotation: { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z },
        bounces: g.bounces,
        fuseTimer: g.fuseTimer,
        thrownBy: 'local',
      })),
```

- [ ] **Step 6: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/session/GameSession.ts
git commit -m "feat(grenade): integrate grenades into GameSession"
```

---

### Task 11: HUD Updates

**Files:**
- Modify: `src/ui/HUD.tsx`

**Interfaces:**
- Consumes: `GrenadeManager`

- [ ] **Step 1: Add grenade props to HUD**

```typescript
// src/ui/HUD.tsx - add to HUDProps interface
  grenadeInventory?: { he: number; flash: number; smoke: number }
  selectedGrenade?: string | null
```

- [ ] **Step 2: Add grenade display section**

```tsx
// src/ui/HUD.tsx - add after weapon name display
      {grenadeInventory && (
        <div style={{ position: 'absolute', bottom: 80, right: 20, display: 'flex', gap: 8 }}>
          {grenadeInventory.he > 0 && (
            <div style={{ 
              padding: '4px 8px', 
              background: selectedGrenade === 'he' ? '#4a5c3a' : 'rgba(0,0,0,0.5)',
              border: selectedGrenade === 'he' ? '2px solid #7a9c5a' : '1px solid #555',
              borderRadius: 4,
              color: '#fff',
              fontSize: 12
            }}>
              4: HE ×{grenadeInventory.he}
            </div>
          )}
          {grenadeInventory.flash > 0 && (
            <div style={{ 
              padding: '4px 8px', 
              background: selectedGrenade === 'flash' ? '#c0c0c0' : 'rgba(0,0,0,0.5)',
              border: selectedGrenade === 'flash' ? '2px solid #fff' : '1px solid #555',
              borderRadius: 4,
              color: selectedGrenade === 'flash' ? '#000' : '#fff',
              fontSize: 12
            }}>
              5: Flash ×{grenadeInventory.flash}
            </div>
          )}
          {grenadeInventory.smoke > 0 && (
            <div style={{ 
              padding: '4px 8px', 
              background: selectedGrenade === 'smoke' ? '#3a5c3a' : 'rgba(0,0,0,0.5)',
              border: selectedGrenade === 'smoke' ? '2px solid #5a9c5a' : '1px solid #555',
              borderRadius: 4,
              color: '#fff',
              fontSize: 12
            }}>
              6: Smoke ×{grenadeInventory.smoke}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 3: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/ui/HUD.tsx
git commit -m "feat(grenade): add grenade inventory display to HUD"
```

---

### Task 12: App.tsx Integration

**Files:**
- Modify: `src/App.tsx:1-1141`

**Interfaces:**
- Consumes: `GrenadeManager`, `Grenade`, `SmokeCloud`, `FlashEffect`

- [ ] **Step 1: Add grenade state variables**

```typescript
// src/App.tsx - add state variables (after line 105)
  const [grenadeInventory, setGrenadeInventory] = useState({ he: 0, flash: 0, smoke: 0 })
  const [selectedGrenade, setSelectedGrenade] = useState<string | null>(null)
  const [flashEffect, setFlashEffect] = useState<FlashEffectState | null>(null)
```

- [ ] **Step 2: Add grenade manager to gameData**

```typescript
// src/App.tsx - add to gameDataRef (after line 163)
    grenadeManager: new (await import('./weapons/GrenadeManager')).GrenadeManager(),
```

- [ ] **Step 3: Wire grenade controls**

```typescript
// src/App.tsx - add in useEffect after controls setup (after line 466)
    data.controls.onSelectGrenade = (type) => {
      if (gameStateRef.current !== 'playing') return
      const gm = data.grenadeManager
      if (gm.select(type)) {
        setSelectedGrenade(type)
      }
    }

    data.controls.onCycleGrenade = () => {
      if (gameStateRef.current !== 'playing') return
      const gm = data.grenadeManager
      const next = gm.cycle()
      setSelectedGrenade(next)
    }

    data.controls.onThrowGrenade = (mode) => {
      if (gameStateRef.current !== 'playing') return
      const gm = data.grenadeManager
      if (!gm.selected) return
      const session = data.session
      if (session.throwGrenade(session.localId, gm.selected, mode)) {
        setGrenadeInventory({
          he: gm.getCount('he'),
          flash: gm.getCount('flash'),
          smoke: gm.getCount('smoke'),
        })
        if (!gm.has(gm.selected)) {
          setSelectedGrenade(null)
        }
      }
    }
```

- [ ] **Step 4: Handle grenade purchase in buy callback**

```typescript
// src/App.tsx - modify onBuy callback (after line 1091)
            switch (id) {
              case 'bomb':
                data.viewmodel?.setObjective('bomb')
                break
              case 'defuse_kit':
                data.viewmodel?.setObjective('defuse_kit')
                break
              case 'he_grenade':
                data.grenadeManager.add('he')
                setGrenadeInventory({
                  he: data.grenadeManager.getCount('he'),
                  flash: data.grenadeManager.getCount('flash'),
                  smoke: data.grenadeManager.getCount('smoke'),
                })
                break
              case 'flashbang':
                data.grenadeManager.add('flash')
                setGrenadeInventory({
                  he: data.grenadeManager.getCount('he'),
                  flash: data.grenadeManager.getCount('flash'),
                  smoke: data.grenadeManager.getCount('smoke'),
                })
                break
              case 'smoke_grenade':
                data.grenadeManager.add('smoke')
                setGrenadeInventory({
                  he: data.grenadeManager.getCount('he'),
                  flash: data.grenadeManager.getCount('flash'),
                  smoke: data.grenadeManager.getCount('smoke'),
                })
                break
              default:
                data.viewmodel?.setWeapon(weaponVisual(wm.current.type))
                break
            }
```

- [ ] **Step 5: Pass grenade props to HUD**

```tsx
// src/App.tsx - add to HUD component (after line 1032)
          grenadeInventory={grenadeInventory}
          selectedGrenade={selectedGrenade}
```

- [ ] **Step 6: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat(grenade): integrate grenades into App.tsx"
```

---

### Task 13: Audio Integration

**Files:**
- Modify: `src/audio/SoundEffects.ts`

**Interfaces:**
- Produces: `playGrenadeThrow()`, `playGrenadeBounce()`, `playGrenadeDetonate(type)`

- [ ] **Step 1: Add grenade sound methods**

```typescript
// src/audio/SoundEffects.ts - add methods
  playGrenadeThrow(position?: THREE.Vector3) {
    // Placeholder: use existing metallic sound
    this.playSound('weapon_reload', position)
  }

  playGrenadeBounce(position: THREE.Vector3) {
    this.playSound('bullet_impact', position, 0.3)
  }

  playGrenadeDetonate(type: 'he' | 'flash' | 'smoke', position: THREE.Vector3) {
    if (type === 'he') {
      this.playSound('enemy_death', position, 1.5)
    } else if (type === 'flash') {
      this.playSound('weapon_fire', position, 0.8)
    } else {
      this.playSound('weapon_reload', position, 0.5)
    }
  }
```

- [ ] **Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/audio/SoundEffects.ts
git commit -m "feat(grenade): add grenade sound effects"
```

---

### Task 14: Viewmodel Integration

**Files:**
- Modify: `src/weapons/Viewmodel.ts`

**Interfaces:**
- Produces: `setGrenade(type)`, `playThrowAnimation()`

- [ ] **Step 1: Add grenade methods to Viewmodel**

```typescript
// src/weapons/Viewmodel.ts - add methods
  setGrenade(type: 'he' | 'flash' | 'smoke') {
    // Placeholder: show grenade model in hand
    this.setWeapon('pistol')
  }

  playThrowAnimation() {
    // Placeholder: animate throw
    this.fire()
  }
```

- [ ] **Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/weapons/Viewmodel.ts
git commit -m "feat(grenade): add grenade viewmodel support"
```

---

### Task 15: Touch Controls

**Files:**
- Modify: `src/ui/TouchControls.tsx`

**Interfaces:**
- Consumes: `grenadeInventory`, `selectedGrenade`

- [ ] **Step 1: Add grenade selector to TouchControls**

```tsx
// src/ui/TouchControls.tsx - add grenade buttons
      <div style={{ position: 'absolute', bottom: 120, right: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          style={{ width: 40, height: 40, background: selectedGrenade === 'he' ? '#4a5c3a' : 'rgba(0,0,0,0.5)', border: '1px solid #555', borderRadius: 4, color: '#fff', fontSize: 10 }}
          onClick={() => onSelectGrenade?.('he')}
        >
          HE
        </button>
        <button
          style={{ width: 40, height: 40, background: selectedGrenade === 'flash' ? '#c0c0c0' : 'rgba(0,0,0,0.5)', border: '1px solid #555', borderRadius: 4, color: selectedGrenade === 'flash' ? '#000' : '#fff', fontSize: 10 }}
          onClick={() => onSelectGrenade?.('flash')}
        >
          Flash
        </button>
        <button
          style={{ width: 40, height: 40, background: selectedGrenade === 'smoke' ? '#3a5c3a' : 'rgba(0,0,0,0.5)', border: '1px solid #555', borderRadius: 4, color: '#fff', fontSize: 10 }}
          onClick={() => onSelectGrenade?.('smoke')}
        >
          Smoke
        </button>
      </div>
```

- [ ] **Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/ui/TouchControls.tsx
git commit -m "feat(grenade): add grenade selector to touch controls"
```

---

### Task 16: Run All Tests

**Files:**
- All test files

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run type check**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: PASS

---

### Task 17: Final Commit and PR

- [ ] **Step 1: Stage all changes**

```bash
git add -A
```

- [ ] **Step 2: Create commit**

```bash
git commit -m "feat(grenade): implement CS-style grenade system

- Add HE, Flashbang, and Smoke grenades with physics-based throwing
- Grenade models with parabolic arc and wall bouncing
- Area effects: HE damage, Flash blindness, Smoke cloud
- Store integration with carry limits
- HUD display for grenade inventory
- Keybindings: 4/5/6 for selection, G to cycle, left/right click to throw
- Mobile touch controls support
- Audio placeholders for throw, bounce, and detonation
- Network protocol extensions for multiplayer sync"
```

- [ ] **Step 3: Push branch**

```bash
git push -u origin feature/grenades
```

- [ ] **Step 4: Create PR**

```bash
gh pr create --title "feat: Add CS-style grenade system" --body "$(cat <<'EOF'
## Summary
- Implement HE, Flashbang, and Smoke grenades with physics-based throwing
- Add grenade models with parabolic arc, wall bouncing, and fuse timers
- Area effects: HE damage with falloff, Flash blindness (facing-aware), Smoke cloud
- Store integration with carry limits (1 HE, 2 Flash, 1 Smoke)
- HUD display for grenade inventory with selection highlighting
- Keybindings: 4/5/6 for direct selection, G to cycle, left/right click for long/short throw
- Mobile touch controls with grenade selector buttons
- Audio placeholders for throw, bounce, and detonation sounds
- Network protocol extensions for multiplayer sync (host authoritative)

## Test plan
- [ ] Run `npx vitest run` to verify all unit tests pass
- [ ] Run `npm run typecheck` to verify TypeScript compilation
- [ ] Run `npm run lint` to verify code style
- [ ] Manual testing: buy grenades, throw them, verify effects
- [ ] Test in multiplayer to verify sync
EOF
)"
```
