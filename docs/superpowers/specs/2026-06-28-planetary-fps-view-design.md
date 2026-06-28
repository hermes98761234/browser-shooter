# Planetary Mode: True First-Person View

**Date:** 2026-06-28
**Status:** Draft
**Related:** PR #36 (feat: full CS-style gameplay on real-world map)

---

## Problem

Planetary Mode currently renders the scene using MapLibre's 3D camera directly — the Three.js camera is forced to identity (position 0,0,0, no rotation) and MapLibre's modelViewProjection matrix handles everything. This produces a top-down map view (pitch 60°) rather than a first-person eye-level view. The player cannot walk between buildings in a true FPS manner because:

1. The camera is overhead, not at eye level
2. Mouse movement rotates the map (bearing/pitch), not the player's view
3. Movement direction is derived from map bearing, not from where the player is looking
4. `session.player.rotation` is never connected to the actual render camera

The goal: make Planetary Mode look and feel exactly like multiplayer PvP — first-person eye-level view, mouse-look, WASD movement relative to look direction, walking between buildings.

---

## Architecture Overview

```
Current (broken):
  MapLibre camera → MVP matrix → Three.js camera (identity) → render
  Player rotation → unused for rendering
  Mouse → map bearing/pitch → top-down view

Fixed:
  MapLibre → projection matrix only (Mercator → clip)
  Player position + rotation → Three.js camera transform (view matrix)
  Mouse → player yaw/pitch → FPS look
  WASD → movement relative to player yaw → walks between buildings
```

---

## Design

### 1. PlanetaryEngine — Camera Transform from Player State

**File:** `src/planetary/PlanetaryEngine.ts`

Add a method `setViewFromPlayer(playerPos: THREE.Vector3, playerQuat: THREE.Vector3)` that the game loop calls each frame:

```
setViewFromPlayer(playerPos: THREE.Vector3, yaw: number, pitch: number): void {
  // Convert local game position to Mercator world position
  const mercatorX = this.originMercator[0] + playerPos.x
  const mercatorZ = this.originMercator[1] - playerPos.z
  const eyeY = playerPos.y  // already includes EYE_HEIGHT from Player

  // Set camera position in Mercator world space
  this.camera.position.set(mercatorX, eyeY, mercatorZ)

  // Set camera rotation from player yaw/pitch
  this.camera.rotation.set(pitch, yaw, 0, 'YXZ')
  this.camera.updateMatrixWorld(true)
}
```

In the custom layer `render()` callback:
- Do NOT reset camera position/rotation to identity — they are set by `setViewFromPlayer()`
- Set `this.camera.projectionMatrix.fromArray(matrix)` — MapLibre's matrix provides the full clip-space transform which we use as projection
- Set `this.camera.matrixWorld` from the player's Mercator position/rotation (the view matrix is `matrixWorldInverse` which Three.js computes)
- Call `this.camera.updateMatrixWorld(true)` to ensure `matrixWorldInverse` is fresh

**Critical detail (avoids double-transform):** MapLibre's `matrix` is a full MVP that converts Mercator → clip space. The existing approach works because the camera is at identity (no additional transform). When we move the camera to the player's position, we must NOT also let MapLibre's view transform apply. The trick: set `camera.projectionMatrix` from MapLibre's matrix, then manually set `camera.position` and `camera.quaternion` so that Three.js computes a `matrixWorld` that is the IDENTITY in MapLibre's camera space. In practice this means expressing the player's Mercator position *relative to MapLibre's current camera position* (which is the map center at the configured pitch/bearing). See Risk 1 for the concrete formula.

### 2. GeoControls — FPS Look Instead of Map Rotation

**File:** `src/planetary/GeoControls.ts`

Change from modifying map bearing/pitch to accumulating player yaw/pitch:

```
class GeoControls {
  yaw: number = 0      // player look yaw (radians)
  pitch: number = 0    // player look pitch (radians)

  // Called by PlanetaryMode with initial values from session.player.rotation
  setLook(yaw: number, pitch: number): void {
    this.yaw = yaw
    this.pitch = pitch
  }

  private onMouseMove(e: MouseEvent): void {
    this.yaw -= e.movementX * MOUSE_SENS   // radians per pixel
    this.pitch -= e.movementY * MOUSE_SENS
    this.pitch = clamp(this.pitch, -PI/2 + 0.01, PI/2 - 0.01)
    // Do NOT call map.setBearing() or map.setPitch()
  }
}
```

The keyboard input (WASD) stays the same — it already outputs booleans for movement.

### 3. PlanetaryMode — Wire Player Rotation to Camera

**File:** `src/planetary/PlanetaryMode.tsx`

In the game loop, after getting input and before stepping the session:

```
// 2. Look: write GeoControls yaw/pitch into player rotation
const gc = controlsRef.current!
session.player.rotation.y = gc.yaw
session.player.rotation.x = gc.pitch

// 3. Apply input and step (movement now uses player.rotation.y for direction)
session.applyInput(session.localId, input)
const events = session.step(dt)

// 4. Update the Three.js camera from player state
const p = session.player.position
engine.setViewFromPlayer(p, session.player.rotation.y, session.player.rotation.x)

// 5. Keep map centered on player for tile loading (but don't control view)
const [lng, lat] = engine.localToLngLat(p.x, p.z)
engine.map.setCenter([lng, lat])
// Keep map pitch fixed at ~80° (near-horizontal) so the projection is stable
// The actual view direction comes from the Three.js camera, not the map
```

**Map pitch:** Set once on init to 80° (almost looking forward from above). The map's pitch affects the projection matrix — a near-horizontal pitch gives a perspective that looks natural from eye level. The map's bearing is irrelevant since we're not using its view matrix.

### 4. Initial Look Direction

On game start, initialize `GeoControls.yaw` to a sensible default (e.g., 0 = looking north/-Z). The player can then rotate with the mouse.

### 5. Viewmodel & Weapons

The `Viewmodel` (first-person gun) is already added to `engine.camera` in PlanetaryMode. Since we're now properly setting the camera transform, the viewmodel will follow the player's view correctly — no changes needed.

### 6. Collision & Walking Between Buildings

No changes needed to collision. `PlanetaryCollision` already produces collision boxes in local space around the player. `Player.update()` already uses `world.resolve()` and `world.supportHeight()`. Once the player's movement direction is driven by `session.player.rotation.y` (which now comes from mouse look), WASD will move the player in the direction they're looking, and collision will push them around buildings.

---

## Files Changed

| File | Change |
|------|--------|
| `src/planetary/PlanetaryEngine.ts` | Add `setViewFromPlayer()` method; modify `render()` to not reset camera transform |
| `src/planetary/GeoControls.ts` | Replace map bearing/pitch with player yaw/pitch accumulation |
| `src/planetary/PlanetaryMode.tsx` | Wire player rotation to camera; set map pitch once; remove map bearing coupling |

---

## Risks & Mitigations

**Risk 1: MapLibre's matrix is a full MVP, not just projection**
MapLibre's custom layer `matrix` converts from Mercator meters directly to clip space (it bakes in the camera view). If we naively set `camera.projectionMatrix = matrix` AND move the camera, transforms compound.

**Solution — express everything in MapLibre's camera space:**
MapLibre's matrix maps Mercator → clip. The Three.js scene objects are positioned in Mercator coordinates (via `localToMercator()`). For the camera, we need its `matrixWorld` to represent: "transform from world space into MapLibre's camera space". 

The correct approach:
1. Compute the player's Mercator position: `playerMerc = (originMercator[0] + px, eyeY, originMercator[1] - pz)`
2. MapLibre's camera in Mercator space = `mapCenterMercator` at the current pitch/bearing
3. Compute relative position: ` rel = playerMerc - mapCenterMercator`
4. Rotate `rel` by the inverse of MapLibre's camera bearing to get camera-space offset
5. Set `camera.position = rotated_rel`, `camera.quaternion` from player yaw/pitch (offset by map bearing)
6. Set `camera.projectionMatrix.fromArray(matrix)`
7. Three.js renders objects in Mercator space, the camera offset + projection handle the rest

**Alternative simpler approach (recommended for implementation):**
Keep the map centered exactly on the player each frame (`map.setCenter([playerLng, playerLat])`). This makes `rel` always `(0, eyeY, 0)` minus the map center. Since MapLibre's camera looks at the center from pitch/bearing, and the player IS at center, the camera offset is purely vertical + the small yaw/pitch from look direction. Set:
- `camera.position.set(0, 0, 0)` in the `render()` callback
- Override after render: position = `(0, 0, 0)`, rotation = player yaw/pitch relative to map bearing
- Since map.center = player position, the Mercator-to-clip matrix already places the player at screen center; we only add the look rotation on top

This is the cleanest approach and what the implementation plan should follow.

**Risk 2: MapLibre pitch affects what tiles load**
At pitch 80°, MapLibre loads tiles far into the distance. This is fine for gameplay but may increase bandwidth.

*Mitigation:* Use pitch 75° as a compromise. Tiles still load around the player.

**Risk 3: Mouse look sensitivity**
The current `MOUSE_SENSITIVITY = 0.3` is in degrees/pixel for map bearing. For FPS look in radians, we need a different scale.

*Mitigation:* Use `0.002` radians/pixel (matching the multiplayer `onMouseMove` handler in App.tsx).

---

## Verification

1. Enter Planetary Mode, pick a location with buildings
2. Camera should be at eye level (~2m above ground), looking horizontally forward
3. Mouse movement should look left/right/up/down (FPS style)
4. W should move forward in the direction you're looking
5. Player should be able to walk between buildings (collision pushes around them)
6. Player should NOT be able to walk through buildings
7. Map should stay centered on player as they move (tiles load correctly)
8. Viewmodel (gun) should be visible and follow view direction
