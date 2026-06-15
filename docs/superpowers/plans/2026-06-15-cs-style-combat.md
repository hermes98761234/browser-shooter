# CS-Style Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the wave-survival shooter into a Counter-Strike–flavored game with a real map with cover, humanoid enemies that shoot back (hitscan + tracer + telegraph), collision + line-of-sight, and a first-person weapon viewmodel — all built from Three.js primitives.

**Architecture:** Add a scene-independent `CollisionWorld` that does movement push-out and segment line-of-sight tests. The arena returns that world. Enemies become humanoid `THREE.Group`s with melee or ranged AI that uses the world for LOS. Player movement and player bullets respect the world. A camera-parented viewmodel adds the gun in hand. The wave-survival loop is unchanged.

**Tech Stack:** TypeScript, Three.js 0.170, React 19, Vite, Vitest (unit), Playwright (e2e).

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src/engine/CollisionWorld.ts` | create | Box-collider registry; `resolve` push-out + `segmentBlocked` LOS |
| `src/engine/__tests__/CollisionWorld.test.ts` | create | Unit tests for collision/LOS |
| `src/engine/Arena.ts` | rewrite | Build map with cover; return a `CollisionWorld` |
| `src/enemies/EnemyModel.ts` | create | `buildSoldier(type)` → humanoid `THREE.Group` |
| `src/types.ts` | modify | Extend `EnemyDef`; add `EnemyAction` union |
| `src/enemies/EnemyDefs.ts` | modify | New combat fields + ranged enemy types |
| `src/enemies/Enemy.ts` | rewrite | Group model, melee + ranged AI, LOS, tagged actions |
| `src/enemies/__tests__/Enemy.test.ts` | modify | Update for action union + add ranged tests |
| `src/enemies/WaveManager.ts` | modify | Mix ranged types into later waves |
| `src/effects/ParticleSystem.ts` | modify | `tracer(from, to)` for enemy hitscan shots |
| `src/weapons/Viewmodel.ts` | create | First-person gun parented to camera; bob + recoil |
| `src/player/Player.ts` | modify | Resolve movement against `CollisionWorld` |
| `src/App.tsx` | modify | Wire world, enemy actions, tracers, viewmodel, LOS for player shots |

---

## Task 1: CollisionWorld

**Files:**
- Create: `src/engine/CollisionWorld.ts`
- Test: `src/engine/__tests__/CollisionWorld.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/engine/__tests__/CollisionWorld.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { CollisionWorld } from '../CollisionWorld'

describe('CollisionWorld', () => {
  it('pushes an overlapping point outside the box', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2))
    const pos = new THREE.Vector3(0.5, 0, 0) // inside the box on XZ
    world.resolve(pos, 0.5)
    const insideX = pos.x > -1 && pos.x < 1
    const insideZ = pos.z > -1 && pos.z < 1
    expect(insideX && insideZ).toBe(false)
  })

  it('leaves a point outside the box unchanged', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2))
    const pos = new THREE.Vector3(5, 0, 5)
    world.resolve(pos, 0.5)
    expect(pos.x).toBeCloseTo(5)
    expect(pos.z).toBeCloseTo(5)
  })

  it('reports a blocking distance when a box is between two points', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(5, 1, 0), new THREE.Vector3(2, 4, 4))
    const from = new THREE.Vector3(0, 1.5, 0)
    const to = new THREE.Vector3(10, 1.5, 0)
    const d = world.segmentBlocked(from, to)
    expect(d).not.toBeNull()
    expect(d!).toBeGreaterThan(0)
    expect(d!).toBeLessThan(10)
  })

  it('returns null when the path is clear', () => {
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(5, 1, 20), new THREE.Vector3(2, 4, 4)) // off to the side
    const from = new THREE.Vector3(0, 1.5, 0)
    const to = new THREE.Vector3(10, 1.5, 0)
    expect(world.segmentBlocked(from, to)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/CollisionWorld.test.ts`
Expected: FAIL — cannot find module `../CollisionWorld`.

- [ ] **Step 3: Implement CollisionWorld**

Create `src/engine/CollisionWorld.ts`:

```ts
import * as THREE from 'three'

export interface BoxCollider {
  min: THREE.Vector3
  max: THREE.Vector3
}

export class CollisionWorld {
  boxes: BoxCollider[] = []

  addBox(center: THREE.Vector3, size: THREE.Vector3): void {
    const half = size.clone().multiplyScalar(0.5)
    this.boxes.push({
      min: center.clone().sub(half),
      max: center.clone().add(half),
    })
  }

  /** Push a circle of `radius` (on the XZ plane) out of any overlapping box. Mutates `pos`. */
  resolve(pos: THREE.Vector3, radius: number): void {
    for (const box of this.boxes) {
      const closestX = THREE.MathUtils.clamp(pos.x, box.min.x, box.max.x)
      const closestZ = THREE.MathUtils.clamp(pos.z, box.min.z, box.max.z)
      const dx = pos.x - closestX
      const dz = pos.z - closestZ
      const distSq = dx * dx + dz * dz

      if (distSq < radius * radius) {
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq)
          const push = radius - dist
          pos.x += (dx / dist) * push
          pos.z += (dz / dist) * push
        } else {
          // center is inside the box: push out along the least-penetration axis
          const toLeft = pos.x - box.min.x
          const toRight = box.max.x - pos.x
          const toBack = pos.z - box.min.z
          const toFront = box.max.z - pos.z
          const minPen = Math.min(toLeft, toRight, toBack, toFront)
          if (minPen === toLeft) pos.x = box.min.x - radius
          else if (minPen === toRight) pos.x = box.max.x + radius
          else if (minPen === toBack) pos.z = box.min.z - radius
          else pos.z = box.max.z + radius
        }
      }
    }
  }

  /** Distance to the nearest box blocking the segment from->to, or null if clear. */
  segmentBlocked(from: THREE.Vector3, to: THREE.Vector3): number | null {
    const dir = to.clone().sub(from)
    const len = dir.length()
    if (len < 1e-8) return null
    dir.divideScalar(len)

    const ray = new THREE.Ray(from.clone(), dir)
    const box3 = new THREE.Box3()
    const target = new THREE.Vector3()
    let nearest: number | null = null

    for (const box of this.boxes) {
      box3.set(box.min, box.max)
      const hit = ray.intersectBox(box3, target)
      if (hit) {
        const d = from.distanceTo(target)
        if (d <= len && (nearest === null || d < nearest)) {
          nearest = d
        }
      }
    }
    return nearest
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/CollisionWorld.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/CollisionWorld.ts src/engine/__tests__/CollisionWorld.test.ts
git commit -m "feat: add CollisionWorld for movement push-out and line-of-sight

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Map with cover (rewrite Arena)

**Files:**
- Modify: `src/engine/Arena.ts`

- [ ] **Step 1: Rewrite Arena to build cover and return a CollisionWorld**

Replace the entire contents of `src/engine/Arena.ts`:

```ts
import * as THREE from 'three'
import { CollisionWorld } from './CollisionWorld'

const ARENA = 30
const WALL_H = 5

/** Builds the map (floor, perimeter walls, cover) and returns its CollisionWorld. */
export function createArena(scene: THREE.Scene): CollisionWorld {
  const world = new CollisionWorld()

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
    new THREE.MeshStandardMaterial({ color: 0x6b6b63, roughness: 0.95, metalness: 0.05 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a8577, roughness: 0.85, metalness: 0.1 })
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x9c7a3c, roughness: 0.8, metalness: 0.05 })
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x707078, roughness: 0.9, metalness: 0.1 })

  // Helper: add a solid box both to the scene and the collision world.
  const addSolid = (
    center: [number, number, number],
    size: [number, number, number],
    mat: THREE.Material
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat)
    mesh.position.set(...center)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    world.addBox(new THREE.Vector3(...center), new THREE.Vector3(...size))
  }

  // Perimeter walls
  addSolid([0, WALL_H / 2, -ARENA], [ARENA * 2, WALL_H, 0.5], wallMat)
  addSolid([0, WALL_H / 2, ARENA], [ARENA * 2, WALL_H, 0.5], wallMat)
  addSolid([-ARENA, WALL_H / 2, 0], [0.5, WALL_H, ARENA * 2], wallMat)
  addSolid([ARENA, WALL_H / 2, 0], [0.5, WALL_H, ARENA * 2], wallMat)

  // Central hard-cover block
  addSolid([0, 1.5, 0], [6, 3, 6], concreteMat)

  // Two raised structures / long walls for sight-line breaks
  addSolid([-14, 2, -8], [1, 4, 14], concreteMat)
  addSolid([14, 2, 8], [1, 4, 14], concreteMat)

  // Crate stacks (cover you can hide behind)
  const crateGroups: [number, number][] = [
    [-10, 10], [12, -12], [8, 14], [-16, -14], [18, 0], [-6, -18],
  ]
  for (const [x, z] of crateGroups) {
    addSolid([x, 1, z], [2, 2, 2], crateMat)
    addSolid([x + 2, 1, z], [2, 2, 2], crateMat)
    addSolid([x + 1, 2.6, z], [2, 1.4, 2], crateMat) // stacked on top
  }

  // Low sandbag-style walls (waist-high cover)
  addSolid([6, 0.6, -6], [6, 1.2, 0.8], concreteMat)
  addSolid([-8, 0.6, 6], [6, 1.2, 0.8], concreteMat)

  // Lighting (daylight-ish)
  scene.add(new THREE.AmbientLight(0xb0b8c0, 0.7))

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1)
  sun.position.set(20, 30, 10)
  sun.castShadow = true
  sun.shadow.mapSize.width = 2048
  sun.shadow.mapSize.height = 2048
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 120
  sun.shadow.camera.left = -45
  sun.shadow.camera.right = 45
  sun.shadow.camera.top = 45
  sun.shadow.camera.bottom = -45
  scene.add(sun)

  return world
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc -b`
Expected: no errors. (App.tsx still calls `createArena(engine.scene)` — return value not yet used; that's fine until Task 9.)

- [ ] **Step 3: Commit**

```bash
git add src/engine/Arena.ts
git commit -m "feat: build map with cover and return a CollisionWorld

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Humanoid enemy model

**Files:**
- Create: `src/enemies/EnemyModel.ts`
- Test: add to `src/enemies/__tests__/Enemy.test.ts` is done in Task 5; this task adds its own quick test file.
- Test: `src/enemies/__tests__/EnemyModel.test.ts`

> Note: `buildSoldier` reads `ENEMY_DEFS[type].color`. The new enemy types (`rifleman`, `sniper`) are added in Task 4, but `buildSoldier` only needs `color`, and `grunt`/`runner`/`tank` already exist, so this task is self-contained for those types.

- [ ] **Step 1: Write the failing test**

Create `src/enemies/__tests__/EnemyModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildSoldier } from '../EnemyModel'

describe('buildSoldier', () => {
  it('returns a Group with body parts', () => {
    const soldier = buildSoldier('grunt')
    expect(soldier).toBeInstanceOf(THREE.Group)
    expect(soldier.children.length).toBeGreaterThan(4)
  })

  it('scales the tank larger than the runner', () => {
    const tank = buildSoldier('tank')
    const runner = buildSoldier('runner')
    expect(tank.scale.x).toBeGreaterThan(runner.scale.x)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/enemies/__tests__/EnemyModel.test.ts`
Expected: FAIL — cannot find module `../EnemyModel`.

- [ ] **Step 3: Implement buildSoldier**

Create `src/enemies/EnemyModel.ts`:

```ts
import * as THREE from 'three'
import { ENEMY_DEFS } from './EnemyDefs'

/** Builds a humanoid soldier from primitives. Feet sit at y=0; the gun points -Z (forward). */
export function buildSoldier(type: string): THREE.Group {
  const def = ENEMY_DEFS[type]
  const group = new THREE.Group()

  const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, metalness: 0.2 })
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2a679, roughness: 0.8 })
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 })

  const legGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25)
  const lLeg = new THREE.Mesh(legGeo, bodyMat); lLeg.position.set(-0.18, 0.45, 0)
  const rLeg = new THREE.Mesh(legGeo, bodyMat); rLeg.position.set(0.18, 0.45, 0)

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), bodyMat)
  torso.position.set(0, 1.3, 0)

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat)
  head.position.set(0, 1.85, 0)

  const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18)
  const lArm = new THREE.Mesh(armGeo, bodyMat); lArm.position.set(-0.45, 1.35, 0)
  const rArm = new THREE.Mesh(armGeo, bodyMat)
  rArm.position.set(0.4, 1.35, 0.12); rArm.rotation.x = -Math.PI / 3

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), gunMat)
  gun.position.set(0.42, 1.3, -0.35)

  for (const part of [lLeg, rLeg, torso, head, lArm, rArm, gun]) {
    part.castShadow = true
    group.add(part)
  }

  const scale = type === 'tank' ? 1.3 : type === 'runner' ? 0.85 : 1
  group.scale.setScalar(scale)
  return group
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/enemies/__tests__/EnemyModel.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/enemies/EnemyModel.ts src/enemies/__tests__/EnemyModel.test.ts
git commit -m "feat: humanoid enemy soldier model from primitives

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Enemy types & combat data (types.ts, EnemyDefs.ts)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/enemies/EnemyDefs.ts`

- [ ] **Step 1: Extend EnemyDef and add EnemyAction in types.ts**

In `src/types.ts`, replace the `EnemyDef` interface (currently lines 21-29) with the following, and add the import + `EnemyAction` union. Add this import at the top of the file:

```ts
import type { Vector3 } from 'three'
```

Replace the `EnemyDef` interface with:

```ts
export interface EnemyDef {
  type: string
  health: number
  damage: number
  speed: number
  attackRange: number // melee strike range
  scoreValue: number
  color: number
  attackType: 'melee' | 'ranged'
  fireRange: number // distance at which a ranged enemy will engage
  fireRate: number // seconds between ranged shots
  accuracy: number // 0..1 hit probability per shot
  telegraphTime: number // seconds of aiming before a ranged shot
  standoff: number // preferred minimum distance for ranged enemies
}

export type EnemyAction =
  | { type: 'melee'; damage: number }
  | { type: 'shoot'; damage: number; from: Vector3; to: Vector3; hit: boolean }
```

- [ ] **Step 2: Update EnemyDefs with combat fields and ranged types**

Replace the entire contents of `src/enemies/EnemyDefs.ts`:

```ts
import type { EnemyDef } from '../types'

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  grunt: {
    type: 'grunt', health: 50, damage: 10, speed: 4, attackRange: 2,
    scoreValue: 100, color: 0xb33939,
    attackType: 'melee', fireRange: 0, fireRate: 0, accuracy: 0, telegraphTime: 0, standoff: 0,
  },
  runner: {
    type: 'runner', health: 30, damage: 8, speed: 8, attackRange: 1.5,
    scoreValue: 150, color: 0xe67e22,
    attackType: 'melee', fireRange: 0, fireRate: 0, accuracy: 0, telegraphTime: 0, standoff: 0,
  },
  tank: {
    type: 'tank', health: 150, damage: 25, speed: 2, attackRange: 3,
    scoreValue: 300, color: 0x6d0000,
    attackType: 'melee', fireRange: 0, fireRate: 0, accuracy: 0, telegraphTime: 0, standoff: 0,
  },
  rifleman: {
    type: 'rifleman', health: 60, damage: 12, speed: 3.5, attackRange: 2,
    scoreValue: 200, color: 0x2d6cdf,
    attackType: 'ranged', fireRange: 25, fireRate: 1.2, accuracy: 0.6, telegraphTime: 0.5, standoff: 8,
  },
  sniper: {
    type: 'sniper', health: 40, damage: 30, speed: 2.5, attackRange: 2,
    scoreValue: 350, color: 0x16607a,
    attackType: 'ranged', fireRange: 45, fireRate: 2.5, accuracy: 0.8, telegraphTime: 1.0, standoff: 18,
  },
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc -b`
Expected: errors in `Enemy.ts` (its `update` return type no longer matches the new `EnemyAction` — that's expected and fixed in Task 5). The `types.ts` and `EnemyDefs.ts` changes themselves must be valid. If the only errors are inside `Enemy.ts`/`App.tsx`, proceed.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/enemies/EnemyDefs.ts
git commit -m "feat: add ranged enemy combat fields and EnemyAction type

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Enemy AI (melee + ranged with LOS)

**Files:**
- Rewrite: `src/enemies/Enemy.ts`
- Modify: `src/enemies/__tests__/Enemy.test.ts`

- [ ] **Step 1: Update existing tests and add ranged tests**

In `src/enemies/__tests__/Enemy.test.ts`, replace the import block at the top and the two behavior tests as follows.

Replace the imports (lines 1-4) with:

```ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Enemy } from '../Enemy'
import { WaveManager } from '../WaveManager'
import { CollisionWorld } from '../../engine/CollisionWorld'
```

Replace the `'attacks when in range'` test (currently lines 42-48) with:

```ts
  it('attacks when in range (melee)', () => {
    const enemy = new Enemy('grunt', new THREE.Vector3(1, 0, 0))
    const playerPos = new THREE.Vector3(1.5, 0, 0)
    enemy.attackTimer = 0.9
    const result = enemy.update(0.2, playerPos)
    expect(result).toEqual({ type: 'melee', damage: 10 })
  })

  it('ranged enemy fires when player is in range with clear line of sight', () => {
    const enemy = new Enemy('rifleman', new THREE.Vector3(0, 0, 0))
    const playerPos = new THREE.Vector3(10, 2, 0) // within fireRange 25
    // First call begins aiming; pass dt past telegraphTime so it fires.
    const result = enemy.update(0.6, playerPos)
    expect(result?.type).toBe('shoot')
  })

  it('ranged enemy holds fire when a wall blocks line of sight', () => {
    const enemy = new Enemy('rifleman', new THREE.Vector3(0, 0, 0))
    const playerPos = new THREE.Vector3(10, 2, 0)
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(5, 1.5, 0), new THREE.Vector3(2, 3, 4)) // between them
    const result = enemy.update(0.6, playerPos, world)
    expect(result).toBeNull()
    expect(enemy.mesh.position.x).toBeGreaterThan(0) // advanced toward player instead
  })

  it('ranged enemy waits out the telegraph before firing', () => {
    const enemy = new Enemy('rifleman', new THREE.Vector3(0, 0, 0))
    const playerPos = new THREE.Vector3(10, 2, 0)
    const result = enemy.update(0.1, playerPos) // dt < telegraphTime 0.5
    expect(result).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/enemies/__tests__/Enemy.test.ts`
Expected: FAIL — `'shoot'` cases fail and the melee shape mismatches, because `Enemy` is not yet rewritten.

- [ ] **Step 3: Rewrite Enemy.ts**

Replace the entire contents of `src/enemies/Enemy.ts`:

```ts
import * as THREE from 'three'
import type { EnemyDef, EnemyAction } from '../types'
import { ENEMY_DEFS } from './EnemyDefs'
import { buildSoldier } from './EnemyModel'
import type { CollisionWorld } from '../engine/CollisionWorld'

const RADIUS = 0.6
const EYE_HEIGHT = 1.5

export class Enemy {
  type: string
  def: EnemyDef
  health: number
  mesh: THREE.Group
  attackTimer: number = 0 // melee cooldown counts up; ranged fire-cooldown counts down
  telegraphTimer: number = 0
  isAiming: boolean = false
  telegraphCue: boolean = false // set true for one frame when aiming begins
  isDead: boolean = false
  deathTimer: number = 0

  constructor(type: string, position: THREE.Vector3) {
    this.type = type
    this.def = ENEMY_DEFS[type]
    this.health = this.def.health
    this.mesh = buildSoldier(type)
    this.mesh.position.copy(position)
    this.mesh.position.y = 0
  }

  takeDamage(amount: number): boolean {
    if (this.isDead) return false
    this.health = Math.max(0, this.health - amount)
    if (this.health <= 0) {
      this.isDead = true
      this.deathTimer = 0.5
      return true
    }
    return false
  }

  update(dt: number, playerPosition: THREE.Vector3, world?: CollisionWorld): EnemyAction | null {
    if (this.isDead) {
      this.deathTimer -= dt
      this.mesh.scale.multiplyScalar(0.9)
      return null
    }
    return this.def.attackType === 'ranged'
      ? this.updateRanged(dt, playerPosition, world)
      : this.updateMelee(dt, playerPosition, world)
  }

  private updateMelee(dt: number, playerPosition: THREE.Vector3, world?: CollisionWorld): EnemyAction | null {
    const dir = new THREE.Vector3().subVectors(playerPosition, this.mesh.position).setY(0)
    const distance = dir.length()

    if (distance > this.def.attackRange) {
      dir.normalize()
      this.mesh.position.addScaledVector(dir, this.def.speed * dt)
      if (world) world.resolve(this.mesh.position, RADIUS)
      this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z)
      this.attackTimer = 0
    } else {
      this.attackTimer += dt
      if (this.attackTimer >= 1) {
        this.attackTimer = 0
        return { type: 'melee', damage: this.def.damage }
      }
    }
    return null
  }

  private updateRanged(dt: number, playerPosition: THREE.Vector3, world?: CollisionWorld): EnemyAction | null {
    this.attackTimer = Math.max(0, this.attackTimer - dt)
    this.telegraphCue = false

    const flatDir = new THREE.Vector3().subVectors(playerPosition, this.mesh.position).setY(0)
    const distance = flatDir.length()
    if (distance > 1e-4) flatDir.normalize()

    this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z)

    const eye = this.mesh.position.clone().setY(EYE_HEIGHT)
    const hasLOS = !world || world.segmentBlocked(eye, playerPosition) === null

    if (!hasLOS || distance > this.def.fireRange) {
      // Advance to gain line of sight / get into range.
      this.isAiming = false
      this.telegraphTimer = 0
      this.mesh.position.addScaledVector(flatDir, this.def.speed * dt)
      if (world) world.resolve(this.mesh.position, RADIUS)
      return null
    }

    // Keep distance if too close.
    if (distance < this.def.standoff) {
      this.mesh.position.addScaledVector(flatDir, -this.def.speed * dt)
      if (world) world.resolve(this.mesh.position, RADIUS)
    }

    if (!this.isAiming) {
      this.isAiming = true
      this.telegraphTimer = 0
      this.telegraphCue = true
    }
    this.telegraphTimer += dt

    if (this.telegraphTimer >= this.def.telegraphTime && this.attackTimer <= 0) {
      this.telegraphTimer = 0
      this.attackTimer = this.def.fireRate
      const hit = Math.random() < this.def.accuracy
      const muzzle = this.mesh.position.clone().setY(1.4).addScaledVector(flatDir, 0.6)
      return { type: 'shoot', damage: this.def.damage, from: muzzle, to: playerPosition.clone(), hit }
    }
    return null
  }

  dispose() {
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (obj.material instanceof THREE.Material) obj.material.dispose()
      }
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/enemies/__tests__/Enemy.test.ts`
Expected: PASS (all Enemy + WaveManager tests in this file).

- [ ] **Step 5: Commit**

```bash
git add src/enemies/Enemy.ts src/enemies/__tests__/Enemy.test.ts
git commit -m "feat: humanoid enemies with melee and ranged LOS-aware AI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Mix ranged enemies into waves

**Files:**
- Modify: `src/enemies/WaveManager.ts`

- [ ] **Step 1: Update the wave table**

In `src/enemies/WaveManager.ts`, replace the `WAVE_DEFS` array (currently lines 5-11) with:

```ts
const WAVE_DEFS: WaveDef[] = [
  { number: 1, enemies: [{ type: 'grunt', count: 5 }], spawnDelay: 1 },
  { number: 2, enemies: [{ type: 'grunt', count: 6 }, { type: 'runner', count: 2 }], spawnDelay: 0.8 },
  { number: 3, enemies: [{ type: 'grunt', count: 5 }, { type: 'rifleman', count: 3 }], spawnDelay: 0.7 },
  { number: 4, enemies: [{ type: 'runner', count: 4 }, { type: 'rifleman', count: 4 }, { type: 'sniper', count: 1 }], spawnDelay: 0.6 },
  { number: 5, enemies: [{ type: 'tank', count: 2 }, { type: 'rifleman', count: 4 }, { type: 'sniper', count: 2 }, { type: 'grunt', count: 4 }], spawnDelay: 0.5 },
]
```

> The `'tracks enemies remaining'` test relies on wave 1 spawning exactly 5 enemies — wave 1 is unchanged, so that test still passes.

- [ ] **Step 2: Run wave tests**

Run: `npx vitest run src/enemies/__tests__/WaveManager.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/enemies/WaveManager.ts
git commit -m "feat: mix ranged enemies (rifleman, sniper) into later waves

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Enemy tracer effect

**Files:**
- Modify: `src/effects/ParticleSystem.ts`

- [ ] **Step 1: Add a tracers array field**

In `src/effects/ParticleSystem.ts`, add this field next to the other private arrays (after `private explosions: ExplosionHandle[] = []`, around line 19):

```ts
  private tracers: { line: THREE.Line; mat: THREE.LineBasicMaterial; life: number; maxLife: number }[] = []
```

- [ ] **Step 2: Add the tracer() method**

Add this method to the `ParticleSystem` class (e.g. right after `muzzleFlash`, around line 76):

```ts
  tracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()])
    const mat = new THREE.LineBasicMaterial({ color: 0xffdd66, transparent: true, opacity: 0.9 })
    const line = new THREE.Line(geo, mat)
    this.scene.add(line)
    this.tracers.push({ line, mat, life: 0.12, maxLife: 0.12 })
  }
```

- [ ] **Step 3: Update and dispose tracers in update()**

In the `update(dt)` method, add this block just before the closing brace of the method (after the explosions loop, around line 128):

```ts
    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]
      t.life -= dt
      t.mat.opacity = Math.max(0, t.life / t.maxLife) * 0.9
      if (t.life <= 0) {
        this.scene.remove(t.line)
        t.line.geometry.dispose()
        t.mat.dispose()
        this.tracers.splice(i, 1)
      }
    }
```

- [ ] **Step 4: Dispose tracers in clear()**

In `clear()`, add before the final closing brace (after the explosions disposal):

```ts
    for (const t of this.tracers) {
      this.scene.remove(t.line)
      t.line.geometry.dispose()
      t.mat.dispose()
    }
    this.tracers = []
```

- [ ] **Step 5: Run the effects tests + type-check**

Run: `npx vitest run src/effects/__tests__/ParticleSystem.test.ts && npx tsc -b`
Expected: existing ParticleSystem tests PASS; tsc shows only the (still-expected) App.tsx integration errors until Task 9.

- [ ] **Step 6: Commit**

```bash
git add src/effects/ParticleSystem.ts
git commit -m "feat: add fading tracer effect for enemy hitscan shots

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: First-person viewmodel

**Files:**
- Create: `src/weapons/Viewmodel.ts`

- [ ] **Step 1: Implement the Viewmodel**

Create `src/weapons/Viewmodel.ts`:

```ts
import * as THREE from 'three'
import type { WeaponType } from '../types'

const BASE = new THREE.Vector3(0.32, -0.32, -0.7)

/** First-person gun model parented to the camera, with bob and recoil. */
export class Viewmodel {
  group: THREE.Group
  private models: Record<WeaponType, THREE.Group>
  private recoil = 0
  private bobTime = 0

  constructor(camera: THREE.Camera) {
    this.group = new THREE.Group()
    this.models = {
      pistol: this.buildGun(0.35, 0x303030),
      shotgun: this.buildGun(0.6, 0x5a3a1a),
      rifle: this.buildGun(0.8, 0x2a2a2a),
    }
    for (const m of Object.values(this.models)) {
      m.visible = false
      this.group.add(m)
    }
    this.group.position.copy(BASE)
    camera.add(this.group)
    this.setWeapon('pistol')
  }

  private buildGun(barrelLen: number, color: number): THREE.Group {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.3), mat)
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, barrelLen), mat)
    barrel.position.set(0, 0.02, -0.15 - barrelLen / 2)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), mat)
    grip.position.set(0, -0.14, 0.08)
    grip.rotation.x = 0.2
    g.add(body, barrel, grip)
    return g
  }

  setWeapon(type: WeaponType) {
    for (const [k, m] of Object.entries(this.models)) {
      m.visible = k === type
    }
  }

  fire() {
    this.recoil = 1
  }

  update(dt: number, moving: boolean) {
    this.recoil = THREE.MathUtils.lerp(this.recoil, 0, Math.min(1, dt * 12))
    if (moving) this.bobTime += dt * 10
    const amp = moving ? 1 : 0
    const bobX = Math.cos(this.bobTime * 0.5) * 0.012 * amp
    const bobY = Math.sin(this.bobTime) * 0.012 * amp
    this.group.position.set(
      BASE.x + bobX,
      BASE.y + bobY + this.recoil * 0.03,
      BASE.z + this.recoil * 0.09
    )
    this.group.rotation.x = this.recoil * 0.25
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: only the (still-expected) App.tsx integration errors remain.

- [ ] **Step 3: Commit**

```bash
git add src/weapons/Viewmodel.ts
git commit -m "feat: first-person weapon viewmodel with bob and recoil

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Wire everything into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add new imports**

At the top of `src/App.tsx`, add after the existing `Enemy` import (line 8):

```ts
import { Viewmodel } from './weapons/Viewmodel'
import type { CollisionWorld } from './engine/CollisionWorld'
```

- [ ] **Step 2: Add collisionWorld and viewmodel to the game data ref**

In the `gameDataRef` object literal (lines 53-66), add these two fields (after `particleSystem`):

```ts
    collisionWorld: null as CollisionWorld | null,
    viewmodel: null as Viewmodel | null,
```

- [ ] **Step 3: Capture the world, add camera to scene, create the viewmodel**

In the `useEffect` setup block, replace the line `createArena(engine.scene)` (line 112) with:

```ts
    const data = gameDataRef.current
    data.collisionWorld = createArena(engine.scene)
    engine.scene.add(engine.camera) // so the camera-parented viewmodel renders
    data.viewmodel = new Viewmodel(engine.camera)
```

Then delete the now-duplicate `const data = gameDataRef.current` line that immediately followed (original line 114), since `data` is now declared above.

- [ ] **Step 4: Set the viewmodel weapon on game start**

In `startGame`, after `setWeaponName('Pistol')` (line 90), add:

```ts
    gameDataRef.current.viewmodel?.setWeapon('pistol')
```

- [ ] **Step 5: Drive player collision + viewmodel update each frame**

In the `engine.onUpdate` callback, replace the player-movement + camera block (lines 158-162):

```ts
      player.update(dt, controls.getMovement(), ARENA_SIZE)

      engine.camera.position.copy(player.position)
      engine.camera.rotation.copy(player.rotation)
      data.audio.updateListenerPosition(player.position.x, player.position.y, player.position.z)
```

with:

```ts
      const movement = controls.getMovement()
      player.update(dt, movement, ARENA_SIZE)
      if (data.collisionWorld) data.collisionWorld.resolve(player.position, 0.5)

      engine.camera.position.copy(player.position)
      engine.camera.rotation.copy(player.rotation)
      data.audio.updateListenerPosition(player.position.x, player.position.y, player.position.z)

      const isMoving = movement.forward || movement.backward || movement.left || movement.right
      data.viewmodel?.update(dt, isMoving)
```

- [ ] **Step 6: Trigger viewmodel recoil when the player shoots**

In the player-shoot block, right after `weaponManager.current.shoot()` (line 167), add:

```ts
        data.viewmodel?.fire()
```

- [ ] **Step 7: Set the viewmodel weapon on weapon switch**

In `handleKeyDown`, inside the weapon-switch block, after `setAmmo(data.weaponManager.current.ammo)` (line 342), add:

```ts
        data.viewmodel?.setWeapon(data.weaponManager.current.type)
```

- [ ] **Step 8: Handle the enemy action union (melee + shoot) and pass the world**

Replace the per-enemy update/result block (lines 204-241, from `for (let i = data.enemies.length - 1; ...` through the matching closing of that loop body's `if (result) { ... }`) with:

```ts
      const enemyPosArr: THREE.Vector3[] = []
      for (let i = data.enemies.length - 1; i >= 0; i--) {
        const enemy = data.enemies[i]
        const result = enemy.update(dt, player.position, data.collisionWorld ?? undefined)

        if (enemy.isDead) {
          if (enemy.deathTimer <= 0) {
            engine.scene.remove(enemy.mesh)
            enemy.dispose()
            data.enemies.splice(i, 1)
          }
          continue
        }

        enemyPosArr.push(enemy.mesh.position)

        // Telegraph cue: brief muzzle flash when a ranged enemy starts aiming.
        if (enemy.telegraphCue) {
          particleSystem.muzzleFlash(
            enemy.mesh.position.clone().setY(1.35),
            new THREE.Vector3(0, 0, -1)
          )
        }

        if (result) {
          if (result.type === 'shoot') {
            data.audio.playWeaponShoot('rifle', result.from)
            const endpoint = result.hit ? player.position.clone() : result.to
            particleSystem.tracer(result.from, endpoint)
            if (result.hit) {
              player.takeDamage(result.damage)
              data.audio.playPlayerHit()
              setHealth(player.health)
              data.damageIndicator = triggerDamage(
                enemy.mesh.position.clone(),
                player.position.clone(),
                player.rotation.y
              )
              setDamageIndicator({ ...data.damageIndicator })
            }
          } else {
            player.takeDamage(result.damage)
            data.audio.playPlayerHit()
            setHealth(player.health)
            data.damageIndicator = triggerDamage(
              enemy.mesh.position.clone(),
              player.position.clone(),
              player.rotation.y
            )
            setDamageIndicator({ ...data.damageIndicator })
          }

          if (player.isDead) {
            document.exitPointerLock()
            data.audio.playPlayerDeath()
            data.scoreSystem.saveHighScore()
            setHighScore(data.scoreSystem.highScore)
            engine.stop()
            updateGameState('gameover')
            return
          }
        }
      }
```

- [ ] **Step 9: Refine checkHit so walls block the player's shots (LOS)**

Replace the entire `checkHit` function (lines 282-317) with:

```ts
    function checkHit(
      origin: THREE.Vector3,
      direction: THREE.Vector3,
      range: number,
      data: typeof gameDataRef.current,
      engine: GameEngine
    ) {
      void engine
      shootRaycaster.set(origin, direction)
      shootRaycaster.far = range

      let nearestEnemy: Enemy | null = null
      let nearestDist = Infinity
      let hitPoint: THREE.Vector3 | null = null

      for (const enemy of data.enemies) {
        if (enemy.isDead) continue
        const intersects = shootRaycaster.intersectObject(enemy.mesh, true)
        if (intersects.length > 0 && intersects[0].distance < nearestDist) {
          nearestDist = intersects[0].distance
          nearestEnemy = enemy
          hitPoint = intersects[0].point
        }
      }

      const wallDist = data.collisionWorld
        ? data.collisionWorld.segmentBlocked(origin, origin.clone().addScaledVector(direction, range))
        : null

      if (nearestEnemy && (wallDist === null || nearestDist < wallDist)) {
        const killed = nearestEnemy.takeDamage(data.weaponManager.current.def.damage)
        if (killed) {
          data.scoreSystem.addKill(nearestEnemy.def.scoreValue)
          setScore(data.scoreSystem.score)
          data.waveManager.onEnemyKilled()
          data.particleSystem!.explosion(nearestEnemy.mesh.position.clone(), nearestEnemy.type)
          data.audio.playEnemyDeath(nearestEnemy.mesh.position.clone())
        } else if (hitPoint) {
          data.particleSystem!.bloodSplatter(hitPoint)
          data.audio.playEnemyHit(hitPoint)
        }
        return
      }

      if (wallDist !== null) {
        data.particleSystem!.bulletImpact(origin.clone().addScaledVector(direction, wallDist))
      }
    }
```

- [ ] **Step 10: Type-check and run the full unit suite**

Run: `npx tsc -b && npx vitest run`
Expected: no TypeScript errors; all unit tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire collision, shooting enemies, tracers, and viewmodel into game

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors. Fix any reported (e.g. unused vars) and re-run.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `tsc -b && vite build` completes with no errors.

- [ ] **Step 3: Unit tests**

Run: `npm run test`
Expected: all suites PASS.

- [ ] **Step 4: E2E tests**

Run: `npm run test:e2e`
Expected: existing Playwright specs PASS. If a spec asserts on old behavior (e.g. box enemies) and fails legitimately, report it rather than weakening the test.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, open the served URL, click START, and confirm:
- The map has crates/walls/cover and a viewmodel gun is visible lower-right.
- You collide with walls/crates (cannot walk through them).
- Humanoid enemies appear; ranged ones stop, briefly flash, then fire a tracer; taking cover behind a wall blocks their shots.
- Your shots are blocked by walls but hit enemies in the open.

- [ ] **Step 6: Final commit (only if Steps 1-4 required fixes)**

```bash
git add -A
git commit -m "chore: lint/build/test fixes for CS-style combat

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** map+cover (Task 2), collision+LOS (Task 1, 5, 9), humanoid models (Task 3), ranged hitscan+tracer+telegraph (Task 4-7, 9), viewmodel (Task 8-9), player-shot LOS (Task 9), waves keep working (Task 6). Fullscreen intentionally untouched.
- **Type consistency:** `EnemyAction` union (`'melee'`/`'shoot'`) defined in Task 4 is produced by `Enemy.update` in Task 5 and consumed in Task 9. `Enemy.mesh` is `THREE.Group` everywhere (model in Task 3, raycast `intersectObject(enemy.mesh, true)` in Task 9). `Viewmodel.setWeapon` takes `WeaponType` matching `weaponManager.current.type`.
- **No placeholders:** every code step contains full code; commands have expected output.
