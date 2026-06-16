# Multiplayer Bots & Player-Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop bots auto-spawning in multiplayer, let the host spawn a wave on demand with **G**, and stop remote players stacking at the arena center.

**Architecture:** Add an `auto` flag to `WaveManager` that gates automatic wave start/advance (default `true` = current single-player behavior); add `spawnNextWave()` for on-demand spawning. Disperse *joining* players onto a ring in `GameSession.addPlayer()` while leaving the host/local player at origin. Wire both into `App.tsx`: disable `auto` on host setup and bind **G**.

**Tech Stack:** TypeScript, Three.js, React, Vitest (`npm test` → `vitest run`).

---

## File Structure

- `src/enemies/WaveManager.ts` — add `auto` flag + `spawnNextWave()`; gate auto-progression. (Tasks 1, 2)
- `src/enemies/__tests__/WaveManager.test.ts` — new tests for `auto` + `spawnNextWave()`. (Tasks 1, 2)
- `src/session/GameSession.ts` — disperse joining players in `addPlayer()`. (Task 3)
- `src/session/__tests__/GameSession.players.test.ts` — new dispersion test. (Task 3)
- `src/App.tsx` — set `waveManager.auto = false` on host; add **G** hotkey. (Task 4)

Existing single-player behavior must stay green: local player stays at origin `(0,2,0)`; `WaveManager` defaults are unchanged.

---

### Task 1: WaveManager `auto` flag gates auto-progression

**Files:**
- Modify: `src/enemies/WaveManager.ts:13-21` (field), `:53-60` (update gate)
- Test: `src/enemies/__tests__/WaveManager.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/enemies/__tests__/WaveManager.test.ts` (inside the top-level `describe`):

```ts
  it('auto defaults to true and auto-starts wave 1 on update', () => {
    const m = new WaveManager()
    m.update(1, 30)
    expect(m.currentWave).toBe(1)
    expect(m.waveActive).toBe(true)
  })

  it('does not auto-start a wave when auto is false', () => {
    const m = new WaveManager()
    m.auto = false
    m.update(1, 30)
    expect(m.currentWave).toBe(0)
    expect(m.waveActive).toBe(false)
    expect(m.spawnQueue.length).toBe(0)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/enemies/__tests__/WaveManager.test.ts`
Expected: the `auto is false` test FAILS (currentWave becomes 1) because the flag doesn't exist yet. (`Property 'auto' does not exist` at type-check, or a runtime assertion failure.)

- [ ] **Step 3: Add the `auto` field**

In `src/enemies/WaveManager.ts`, add the field to the class (after line 19 `wavePauseTimer: number = 0`):

```ts
  /** When false, waves never auto-start or auto-advance; use spawnNextWave() instead. */
  auto: boolean = true
```

- [ ] **Step 4: Gate auto-progression in `update()`**

Replace the `!this.waveActive` block in `update()` (currently lines 54-60):

```ts
    if (!this.waveActive) {
      this.wavePauseTimer -= dt
      if (this.wavePauseTimer <= 0) {
        this.startWave()
      }
      return null
    }
```

with:

```ts
    if (!this.waveActive) {
      if (!this.auto) return null
      this.wavePauseTimer -= dt
      if (this.wavePauseTimer <= 0) {
        this.startWave()
      }
      return null
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/enemies/__tests__/WaveManager.test.ts`
Expected: PASS (all existing WaveManager tests + the two new ones).

- [ ] **Step 6: Commit**

```bash
git add src/enemies/WaveManager.ts src/enemies/__tests__/WaveManager.test.ts
git commit -m "feat(waves): add auto flag gating WaveManager auto-progression"
```

---

### Task 2: WaveManager `spawnNextWave()` on-demand spawning

**Files:**
- Modify: `src/enemies/WaveManager.ts` (new method near `startWave()`, ~line 51)
- Test: `src/enemies/__tests__/WaveManager.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/enemies/__tests__/WaveManager.test.ts`:

```ts
  it('spawnNextWave enqueues the next wave on demand even when auto is false', () => {
    const m = new WaveManager()
    m.auto = false
    expect(m.currentWave).toBe(0)
    m.spawnNextWave()
    expect(m.currentWave).toBe(1)
    expect(m.waveActive).toBe(true)
    expect(m.spawnQueue.length).toBe(5) // wave 1 = 5 grunts

    m.spawnNextWave()
    expect(m.currentWave).toBe(2)
  })

  it('does not auto-advance after a manual wave is cleared when auto is false', () => {
    const m = new WaveManager()
    m.auto = false
    m.spawnNextWave()        // wave 1 active
    m.spawnQueue = []        // drain the spawn queue
    m.enemiesRemaining = 0
    m.onEnemyKilled()        // marks the wave complete (waveActive -> false)
    expect(m.waveActive).toBe(false)
    m.update(10, 30)         // long dt would auto-advance if auto were true
    expect(m.currentWave).toBe(1) // stayed on wave 1
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/enemies/__tests__/WaveManager.test.ts`
Expected: FAIL — `spawnNextWave is not a function` / type error.

- [ ] **Step 3: Add `spawnNextWave()`**

In `src/enemies/WaveManager.ts`, add immediately after the `startWave()` method (after current line 51):

```ts
  /** Manually start the next wave (host-triggered in multiplayer). */
  spawnNextWave() {
    this.startWave()
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/enemies/__tests__/WaveManager.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/enemies/WaveManager.ts src/enemies/__tests__/WaveManager.test.ts
git commit -m "feat(waves): add spawnNextWave for on-demand spawning"
```

---

### Task 3: Disperse joining players around the host

**Files:**
- Modify: `src/session/GameSession.ts:45-50` (`addPlayer`) + new private helper
- Test: `src/session/__tests__/GameSession.players.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/session/__tests__/GameSession.players.test.ts` (inside `describe('GameSession players map'`)):

```ts
  it('keeps the local/host player at origin but disperses joining players', () => {
    const s = new GameSession()
    const host = s.getPlayer(s.localId)!.player.position
    expect(Math.hypot(host.x, host.z)).toBeCloseTo(0)

    s.addPlayer('player-2', 'Bob')
    s.addPlayer('player-3', 'Cara')
    const p2 = s.getPlayer('player-2')!.player.position
    const p3 = s.getPlayer('player-3')!.player.position

    expect(Math.hypot(p2.x, p2.z)).toBeGreaterThan(5) // off-center
    expect(Math.hypot(p3.x, p3.z)).toBeGreaterThan(5)
    expect(p2.distanceTo(p3)).toBeGreaterThan(1)       // not stacked on each other
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/session/__tests__/GameSession.players.test.ts`
Expected: FAIL — joining players are at origin `(0,2,0)`, so `Math.hypot(p2.x, p2.z)` is `0`.

- [ ] **Step 3: Implement dispersion in `addPlayer`**

In `src/session/GameSession.ts`, replace `addPlayer` (lines 45-50):

```ts
  addPlayer(id: string, name: string): PlayerEntity {
    const entity: PlayerEntity = { id, name, player: new Player(), weapons: new WeaponManager() }
    this.playerMap.set(id, entity)
    this.inputs.set(id, emptyInput())
    return entity
  }
```

with:

```ts
  addPlayer(id: string, name: string): PlayerEntity {
    const index = this.playerMap.size // 0 = host/local, kept at origin
    const entity: PlayerEntity = { id, name, player: new Player(), weapons: new WeaponManager() }
    entity.player.position.copy(this.spawnPosition(index))
    this.playerMap.set(id, entity)
    this.inputs.set(id, emptyInput())
    return entity
  }

  /** Host/local at origin; joining players evenly placed on a ring so models never stack. */
  private spawnPosition(index: number): THREE.Vector3 {
    if (index === 0) return new THREE.Vector3(0, 2, 0)
    const angle = (index - 1) * (Math.PI / 4) // 45 degrees apart
    const r = ARENA_SIZE / 3
    return new THREE.Vector3(Math.cos(angle) * r, 2, Math.sin(angle) * r)
  }
```

(`THREE` and `ARENA_SIZE` are already imported/defined in this file.)

- [ ] **Step 4: Run the full suite to verify pass + no regressions**

Run: `npm test`
Expected: PASS. In particular `GameSession.players.test.ts` (movement, snapshot, nearestPlayer) and `GameSession.step.test.ts` still pass — the local player remains at origin, so the enemy-melee-range and `position.x toBeCloseTo(0)` assertions hold.

- [ ] **Step 5: Commit**

```bash
git add src/session/GameSession.ts src/session/__tests__/GameSession.players.test.ts
git commit -m "fix(session): disperse joining players onto a ring to stop model stacking"
```

---

### Task 4: Wire host into App — disable auto-waves, bind G

**Files:**
- Modify: `src/App.tsx:195-196` (host setup), `src/App.tsx:538-540` (key handler)

No unit test (the React render loop / `App.tsx` is not unit-tested in this repo). Verification is type-check + full suite + a manual two-instance run.

- [ ] **Step 1: Disable auto-waves on host setup**

In `src/App.tsx`, in `hostGame`, after the `NetHost` is created and assigned (lines 195-196):

```ts
    const netHost = new NetHost(data.session, 'coop')
    data.netHost = netHost
```

add the line:

```ts
    const netHost = new NetHost(data.session, 'coop')
    data.netHost = netHost
    data.session.waveManager.auto = false // multiplayer: no auto-bots; host adds waves with G
```

- [ ] **Step 2: Add the G hotkey (host-only)**

In `src/App.tsx`, in `handleKeyDown`, after the `KeyR` reload block (lines 538-540):

```ts
      if (e.code === 'KeyR') {
        data.session.weaponManager.current.reload()
      }
```

add:

```ts
      if (e.code === 'KeyG' && gameStateRef.current === 'playing' && data.role === 'host') {
        data.session.waveManager.spawnNextWave()
      }
```

- [ ] **Step 3: Type-check and run the full suite**

Run: `npm run build`
Expected: `tsc -b` completes with no errors.

Run: `npm test`
Expected: PASS (all tests).

- [ ] **Step 4: Manual verification (two instances)**

Run: `npm run dev`. Open two browser tabs. In tab 1 host a game; in tab 2 join with the room code; start the match.
Expected:
- No enemy waves appear automatically.
- Pressing **G** in the host tab spawns a wave of enemies; pressing **G** in the client tab does nothing.
- The other player's character model appears at a separate position (on the ring around center), not stacked on / clipping into your camera. Both players move independently.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): disable auto-waves on host, bind G to spawn a wave"
```

---

## Self-Review notes

- **Spec coverage:** Part 1 (no auto-bots in MP) → Tasks 1 + 4 step 1. Part 2 (host G hotkey, full wave) → Tasks 2 + 4 step 2. Part 3 (remote-player display / spawn dispersion) → Task 3. Testing section → unit tests in Tasks 1-3 + manual run in Task 4.
- **Single-player untouched:** `auto` defaults `true`; local player (index 0) stays at `(0,2,0)`.
- **Type consistency:** `auto` (boolean) and `spawnNextWave()` are referenced identically in `WaveManager`, `GameSession.waveManager`, and `App.tsx`.
