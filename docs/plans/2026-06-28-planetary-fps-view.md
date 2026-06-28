# Planetary Mode: True First-Person View Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Convert Planetary Mode from a top-down MapLibre camera view to a true first-person eye-level FPS view, where the player walks between buildings using WASD + mouse-look, identical to multiplayer PvP.

**Architecture:** Decouple the Three.js camera from MapLibre's MVP matrix. MapLibre provides the projection (Mercator-to-clip) and renders the map tiles; the Three.js camera is positioned at the player's Mercator-world eye position and rotated by the player's yaw/pitch. The map center follows the player each frame for tile loading, and the map pitch is fixed near-horizontal.

**Tech Stack:** Three.js, MapLibre GL, TypeScript, React

---

## Task 1: Add `setViewFromPlayer()` to PlanetaryEngine

**Objective:** Add a method that positions and orients the Three.js camera from player state, and modify the `render()` callback to stop forcing the camera to identity.

**Files:**
- Modify: `src/planetary/PlanetaryEngine.ts`

**Step 1: Add `setViewFromPlayer()` method to PlanetaryEngine**

Add this method to the `PlanetaryEngine` class (after `localToLngLat`):

```typescript
/**
 * Position and orient the Three.js camera from the player's game-space state.
 * Called every frame before the custom layer render callback.
 *
 * @param playerPos  Player position in local game space (meters from drop point, y = eye)
 * @param yaw        Player look yaw in radians (0 = facing -Z/north)
 * @param pitch      Player look pitch in radians (0 = level, + = up)
 * @param mapBearing MapLibre's current bearing in radians (to offset look direction)
 */
setViewFromPlayer(playerPos: THREE.Vector3, yaw: number, pitch: number, mapBearing: number): void {
  // Convert local game position to Mercator world position
  const mercatorX = this.originMercator[0] + playerPos.x
  const mercatorZ = this.originMercator[1] - playerPos.z

  // The Three.js scene objects are positioned in Mercator coordinates.
  // MapLibre's MVP matrix (used as projection) assumes the camera is at
  // maplibre-camera-LookAt(center). Since we keep map.center = player position,
  // the "natural" camera position that makes MVP work is identity (0,0,0,no-rot).
  // We add the eye height offset and look rotation on top:
  this.camera.position.set(0, playerPos.y, 0)

  // YXZ Euler: yaw around Y, then pitch around X. Offset yaw by map bearing
  // so the look direction is consistent with the map's orientation.
  const euler = new THREE.Euler(pitch, yaw + mapBearing, 0, 'YXZ')
  this.camera.quaternion.setFromEuler(euler)

  this.camera.updateMatrixWorld(true)
}
```

**Step 2: Remove identity camera reset from `render()` callback**

In the `render:` function inside `addGameObjects()`, remove these lines:
```typescript
this.camera.position.set(0, 0, 0)
this.camera.rotation.set(0, 0, 0)
```

So the render callback becomes:
```typescript
render: (_gl: WebGL2RenderingContext, matrix: number[]) => {
  this.camera.projectionMatrix.fromArray(matrix)
  this.camera.updateMatrixWorld(true)
  this.threeRenderer?.resetState()
  this.threeRenderer?.render(this.scene, this.camera)
},
```

**Step 3: Commit**

```bash
git add src/planetary/PlanetaryEngine.ts
git commit -m "feat(planetary): add setViewFromPlayer for FPS camera"
```

---

## Task 2: Convert GeoControls to FPS-style look accumulation

**Objective:** Change GeoControls from modifying MapLibre bearing/pitch to accumulating player yaw/pitch for first-person look.

**Files:**
- Modify: `src/planetary/GeoControls.ts`

**Step 1: Replace the GeoControls implementation**

Replace the entire file content:

```typescript
import type maplibregl from 'maplibre-gl'
import { emptyInput, type PlayerInput } from '../session/protocol'

const MOUSE_SENSITIVITY = 0.002 // radians per pixel (matches multiplayer onMouseMove)
const PITCH_MIN = -Math.PI / 2 + 0.01
const PITCH_MAX = Math.PI / 2 - 0.01

/**
 * FPS-style input for Planetary Mode. WASD for movement, mouse for look.
 * Does NOT modify the MapLibre camera — that is driven by the Three.js camera.
 */
export class GeoControls {
  yaw: number = 0
  pitch: number = 0
  private keys = new Set<string>()
  private attached = false

  constructor(private container: HTMLElement) {}

  attach(): void {
    if (this.attached) return
    this.attached = true
    this.container.addEventListener('keydown', this.onKeyDown)
    this.container.addEventListener('keyup', this.onKeyUp)
    this.container.addEventListener('mousemove', this.onMouseMove)
  }

  detach(): void {
    if (!this.attached) return
    this.attached = false
    this.container.removeEventListener('keydown', this.onKeyDown)
    this.container.removeEventListener('keyup', this.onKeyUp)
    this.container.removeEventListener('mousemove', this.onMouseMove)
    this.keys.clear()
  }

  /** Initialize look direction from current player rotation */
  setLook(yaw: number, pitch: number): void {
    this.yaw = yaw
    this.pitch = pitch
  }

  getInput(): PlayerInput {
    return {
      ...emptyInput(),
      forward: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      backward: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
      jump: this.keys.has('Space'),
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => { this.keys.add(e.code) }
  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.code) }

  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement !== this.container) return
    this.yaw -= e.movementX * MOUSE_SENSITIVITY
    this.pitch -= e.movementY * MOUSE_SENSITIVITY
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch))
  }
}
```

**Step 2: Run lint**

```bash
npm run lint
```

Fix any issues.

**Step 3: Commit**

```bash
git add src/planetary/GeoControls.ts
git commit -m "feat(planetary): convert GeoControls to FPS mouse-look"
```

---

## Task 3: Wire player rotation to camera in PlanetaryMode

**Objective:** Update the game loop in PlanetaryMode to write GeoControls yaw/pitch into player rotation, call `engine.setViewFromPlayer()`, and keep the map centered on the player without controlling view direction.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx`

**Step 1: Create engine lazily and pass initial look direction**

In the `useEffect` that creates the engine (after `engine.onReady`), update the `GeoControls` construction:

Replace:
```typescript
const controls = new GeoControls(engine.map, containerRef.current!)
controls.attach()
```

With:
```typescript
const controls = new GeoControls(containerRef.current!)
controls.attach()
controls.setLook(0, 0) // initial: looking north, level
controlsRef.current = controls
```

Also remove all the `engine.map.disable()` calls (lines 85-89) since GeoControls no longer touches the map. The map controls can stay enabled for potential future use.

**Step 2: Update the game loop's look + camera section**

In the `loop()` function, replace the old "Look" section (lines ~143-154) with:

```typescript
// 2. Look: write GeoControls yaw/pitch into player rotation
const gc = controlsRef.current!
session.player.rotation.y = gc.yaw
session.player.rotation.x = gc.pitch

// Apply look to input for snapshot
input.yaw = gc.yaw
input.pitch = gc.pitch
```

**Step 3: After session.step(), update the Three.js camera**

After `const events = session.step(dt)` (around line 160), add:

```typescript
// 4. Update the Three.js camera from player state
const p = session.player.position
const mapBearing = (engine.map.getBearing() * Math.PI) / 180
engine.setViewFromPlayer(p, session.player.rotation.y, session.player.rotation.x, mapBearing)
```

**Step 4: Update map centering — remove map view override**

Replace the existing map center sync (step 5 in the current loop, ~line 247-248):

Replace:
```typescript
// 5. Sync map center to player's world position
const p = session.player.position
const [lng, lat] = engine.localToLngLat(p.x, p.z)
engine.map.setCenter([lng, lat])
```

With:
```typescript
// 5. Keep map centered on player for tile loading (view direction is from Three.js camera)
const [lng, lat] = engine.localToLngLat(p.x, p.z)
engine.map.setCenter([lng, lat])
// Fix pitch near-horizontal so the projection is stable; bearing stays at 0
engine.map.setPitch(75)
engine.map.setBearing(0)
```

**Step 5: Run lint and build**

```bash
npm run lint
npm run build
```

Fix any issues.

**Step 6: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): wire FPS camera + mouse-look into game loop"
```

---

## Task 4: Verify — build, lint, and playtest

**Objective:** Ensure the project builds, lints, and the FPS view feels right.

**Step 1: Full build**

```bash
npm run build
```

Expected: success, no TypeScript errors.

**Step 2: Full lint**

```bash
npm run lint
```

Expected: no errors.

**Step 3: Run tests**

```bash
npm run test
```

Expected: all pass (existing collision and engine tests should still be valid).

**Step 4: Manual playtest instructions**

1. Start dev server: `npm run dev`
2. Open browser, click "Planetary Mode" in main menu
3. Pick a location with buildings (zoom in to see building outlines on the picker)
4. After drop-in, the view should be at eye level (~2m above ground), looking horizontally forward
5. Move mouse — view should rotate left/right/up/down (FPS look)
6. Press W — player moves forward in the look direction
7. Walk toward a building — player should be blocked by collision, able to walk around it
8. Press Space — player should jump
9. Click — should shoot (if weapon equipped)
10. The map terrain should stay centered beneath the player but the view direction follows mouse

**Step 5: Commit any fixes, then push and create PR**

```bash
git push -u origin fix/planetary-fps-first-person-view
gh pr create --title "fix(planetary): true first-person view with mouse-look and FPS movement" \
  --body "## Problem\nPlanetary Mode used MapLibre's top-down 3D camera. Player couldn't walk between buildings in FPS style.\n\n## Fix\n- Decouple Three.js camera from MapLibre MVP matrix\n- GeoControls accumulates mouse yaw/pitch for FPS look\n- Camera positioned at player Mercator eye position, rotated by player yaw/pitch\n- Map stays centered on player for tile loading but view direction is from Three.js camera\n\n## Files\n- PlanetaryEngine.ts: setViewFromPlayer() + render callback fix\n- GeoControls.ts: FPS mouse-look instead of map bearing/pitch\n- PlanetaryMode.tsx: wire player rotation to camera in game loop"
```
