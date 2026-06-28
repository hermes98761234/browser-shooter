# Planetary Mode Shooting Animations Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add full shooting feedback (recoil, muzzle flash, sound, crosshair bloom, weapon model sync) to planetary mode so it matches the main game.

**Architecture:** Wire `ParticleSystem` + `SoundEffects` into `PlanetaryMode.tsx`'s engine-ready callback, detect "fired this frame" in the game loop (same pattern as `App.tsx:1111-1118`), and call the same feedback methods. Add crosshair bloom state driven by `stepBloom`. Sync viewmodel weapon on buy and cycle.

**Tech Stack:** React, Three.js, Vitest, `ParticleSystem`, `SoundEffects`, `Viewmodel`, `CrosshairBloom`

---

## Task 1: Add imports and refs for feedback systems

**Objective:** Import ParticleSystem, SoundEffects, AudioManager, weaponVisual, stepBloom, BLOOM_PIXELS and add refs to hold them.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx:1-18` (imports)
- Modify: `src/planetary/PlanetaryMode.tsx:34-42` (refs)

**Step 1: Add imports after line 18**

```ts
import { ParticleSystem } from '../effects/ParticleSystem'
import { SoundEffects } from '../audio/SoundEffects'
import { AudioManager } from '../audio/AudioManager'
import { weaponVisual } from '../weapons/WeaponDefs'
import { stepBloom, BLOOM_PIXELS } from '../weapons/CrosshairBloom'
```

**Step 2: Add refs after line 42 (desktopControlsRef)**

```ts
  const particleSystemRef = useRef<ParticleSystem | null>(null)
  const audioRef = useRef<SoundEffects | null>(null)
```

**Step 3: Verify build**

Run: `cd /home/user/projects/browser-shooter && npx tsc -b`
Expected: exit 0, no errors

**Step 4: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): add feedback system imports and refs"
```

---

## Task 2: Create feedback systems in engine-ready callback

**Objective:** Instantiate ParticleSystem and SoundEffects when the engine is ready, store them in refs.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx:116-117` (after viewmodel creation)

**Step 1: Add after line 117 (`engine.scene.add(engine.camera)`)**

```ts
      // Create feedback systems for shooting (muzzle flash, audio)
      const particleSystem = new ParticleSystem(engine.scene)
      const audio = new SoundEffects(new AudioManager())
      particleSystemRef.current = particleSystem
      audioRef.current = audio
```

**Step 2: Verify build**

Run: `npx tsc -b`
Expected: exit 0

**Step 3: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): create ParticleSystem and SoundEffects on engine ready"
```

---

## Task 3: Detect fired-this-frame and apply recoil + flash + sound

**Objective:** In the game loop, detect when a shot was fired this frame and call viewmodel.fire(), play gunshot audio, and spawn muzzle flash.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx:288-290` (after `engine.render()` call area, before `viewmodel.update`)

**Step 1: Replace the `viewmodel.update(dt, false)` line (line 290) with fire detection + feedback + update**

Replace:
```ts
        // 9. Draw the FPS scene (lazily creates the WebGL canvas on first frame).
        engine.render()
        viewmodel.update(dt, false)
```

With:
```ts
        // 9. Draw the FPS scene (lazily creates the WebGL canvas on first frame).
        engine.render()

        // 10. Shooting feedback: detect fired-this-frame (same pattern as App.tsx).
        //     Weapon.shoot() resets fireTimer = def.fireRate, so after step() the
        //     timer sits at fireRate - dt exactly once per shot.
        let firedThisFrame = false
        const weapon = session.weaponManager.current
        if (!session.player.isDead && input.shoot && weapon.fireTimer > weapon.def.fireRate - dt) {
          firedThisFrame = true
          viewmodel.fire()
          audioRef.current?.playWeaponShoot(weaponVisual(weapon.type), session.player.position)
          const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(engine.camera.quaternion)
          particleSystemRef.current?.muzzleFlash(session.player.position.clone().add(fwd), fwd)
        }

        // 11. Update audio listener position for 3D positional sound.
        if (audioRef.current) {
          const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(engine.camera.quaternion)
          audioRef.current.updateListenerPosition(p.x, p.y, p.z)
          audioRef.current.updateListenerOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0)
        }

        viewmodel.update(dt, false)
```

**Step 2: Verify build**

Run: `npx tsc -b`
Expected: exit 0

**Step 3: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): add recoil, muzzle flash, and gunshot audio on fire"
```

---

## Task 4: Add crosshair bloom state and drive it from the loop

**Objective:** Add bloom state, advance it each frame with stepBloom, and apply it to the crosshair gap.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx:44-61` (state declarations)
- Modify: `src/planetary/PlanetaryMode.tsx` (in the loop, after firedThisFrame detection)
- Modify: `src/planetary/PlanetaryMode.tsx:430-440` (crosshair JSX)

**Step 1: Add bloom state after line 61 (csMode state)**

```ts
  const [bloom, setBloom] = useState(0)
```

**Step 2: After the firedThisFrame block (after the audio listener update, before `viewmodel.update`), add bloom advance**

```ts
        // 12. Crosshair bloom: grow on fire/movement/jump, recover when still.
        setBloom(prev => stepBloom(prev, dt, {
          moving: Math.hypot(session.player.velocity.x, session.player.velocity.z) > 1.5,
          airborne: !session.player.isGrounded,
          shotsFired: firedThisFrame ? 1 : 0,
          weaponSpread: weapon.def.spread,
        }))
```

**Step 3: Update the crosshair JSX (lines 430-440) to apply bloom to the gap**

Replace the static crosshair:
```tsx
        <div style={{ width: 2, height: 14, background: '#0f0', position: 'absolute', left: -1, top: -20 }} />
        <div style={{ width: 2, height: 14, background: '#0f0', position: 'absolute', left: -1, top: 10 }} />
        <div style={{ width: 14, height: 2, background: '#0f0', position: 'absolute', top: -1, left: -20 }} />
        <div style={{ width: 14, height: 2, background: '#0f0', position: 'absolute', top: -1, left: 10 }} />
```

With bloom-scaled crosshair:
```tsx
        {(() => {
          const gapScale = 1 + (bloom * BLOOM_PIXELS) / 20
          const hOff = 20 * gapScale  // horizontal line distance from center
          const vOff = 10 * gapScale  // vertical line distance from center
          const lineStyle = { background: '#0f0', position: 'absolute' }
          return (
            <>
              <div style={{ ...lineStyle, width: 2, height: 14, left: -1, top: -vOff - 7 }} />
              <div style={{ ...lineStyle, width: 2, height: 14, left: -1, top: vOff - 7 }} />
              <div style={{ ...lineStyle, width: 14, height: 2, top: -1, left: -hOff - 7 }} />
              <div style={{ ...lineStyle, width: 14, height: 2, top: -1, left: hOff - 7 }} />
            </>
          )
        })()}
```

**Step 4: Verify build**

Run: `npx tsc -b`
Expected: exit 0

**Step 5: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): add dynamic crosshair bloom on fire/movement/jump"
```

---

## Task 5: Sync viewmodel weapon on buy

**Objective:** When the player buys a weapon, update the viewmodel's gun model to match.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx:405-419` (buy handler)

**Step 1: After `applyItem(item, session.player, session.weaponManager)` inside the buy handler, add viewmodel sync**

Replace:
```ts
                  if (item) {
                    session.economy!.spendMoney(item.price)
                    applyItem(item, session.player, session.weaponManager)
                  }
```

With:
```ts
                  if (item) {
                    session.economy!.spendMoney(item.price)
                    applyItem(item, session.player, session.weaponManager)
                    viewmodel.setWeapon(weaponVisual(session.weaponManager.current.type))
                  }
```

**Step 2: Verify build**

Run: `npx tsc -b`
Expected: exit 0

**Step 3: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): sync viewmodel weapon on buy"
```

---

## Task 6: Sync viewmodel weapon on cycle (desktop Q key + mobile)

**Objective:** When the player cycles weapons (Q key or mobile WEAP button), update the viewmodel's gun model.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx:310-324` (keyboard handler)
- Modify: `src/planetary/PlanetaryMode.tsx:549` (onCycleWeapon prop)

**Step 1: Add KeyQ handler inside handleKeyDown (after the KeyE block, before closing brace)**

After line 323 (`sessionRef.current.tryDefuse(...)`), add:
```ts
      } else if (e.code === 'KeyQ') {
        if (sessionRef.current) {
          const wm = sessionRef.current.weaponManager
          wm.cycleNext()
          viewmodel.setWeapon(weaponVisual(wm.current.type))
        }
      }
```

**Step 2: Update onCycleWeapon on TouchControls (line 549)**

Replace:
```tsx
          onCycleWeapon={() => { if (sessionRef.current) sessionRef.current.weaponManager.cycleNext() }}
```

With:
```tsx
          onCycleWeapon={() => {
            if (!sessionRef.current) return
            const wm = sessionRef.current.weaponManager
            wm.cycleNext()
            viewmodel.setWeapon(weaponVisual(wm.current.type))
          }}
```

**Step 3: Verify build**

Run: `npx tsc -b`
Expected: exit 0

**Step 4: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): sync viewmodel weapon on cycle (Q key + mobile)"
```

---

## Task 7: Cleanup feedback systems on unmount

**Objective:** Clear particles when the planetary mode unmounts to avoid leaks.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx:297-304` (effect cleanup)

**Step 1: Add cleanup before `engine.dispose()` in the effect return**

Replace:
```ts
    return () => {
      mounted = false
      cancelAnimationFrame(rafRef.current)
      controlsRef.current?.detach()
      desktopControlsRef.current?.destroy()
      engine.dispose()
      engineRef.current = null
    }
```

With:
```ts
    return () => {
      mounted = false
      cancelAnimationFrame(rafRef.current)
      controlsRef.current?.detach()
      desktopControlsRef.current?.destroy()
      particleSystemRef.current?.clear()
      engine.dispose()
      engineRef.current = null
    }
```

**Step 2: Verify build**

Run: `npx tsc -b`
Expected: exit 0

**Step 3: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): cleanup particle system on unmount"
```

---

## Task 8: Final verification

**Objective:** Run full test suite, lint, and build to confirm everything passes.

**Step 1: Run tests**

Run: `npx vitest run src/ --exclude='**/node_modules/**' --exclude='**/.claude/**' --exclude='**/.mimocode/**' --exclude='**/.sdd/**'`
Expected: all project test files pass (115 files)

**Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors (warnings OK)

**Step 3: Run build**

Run: `npm run build`
Expected: exit 0

**Step 4: Push**

Run: `git push -u origin main`

**Step 5: Check CI**

Run: `gh run list --repo hermes98761234/browser-shooter --branch main --limit 2`
Expected: latest run succeeded
