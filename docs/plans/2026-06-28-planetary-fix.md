# Planetary Mode Fix Implementation Plan

> **For Hermes:** Direct execution — this is a small, focused change in a single file.

**Goal:** Fix two bugs in planetary mode — the "View CS Mode" button should toggle a visual style (not exit to menu), and bots should not spawn.

**Architecture:** Surgical edits to `src/planetary/PlanetaryMode.tsx` — add a `useState` for CS mode toggle, remove bot spawning/rendering code.

**Tech Stack:** React, TypeScript, Three.js

---

## Task 1: Fix "View CS Mode" button to toggle visual style

**Objective:** Replace `onExit` with a CS mode toggle state that changes HUD styling.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx`

**Step 1: Add csMode state**

After the existing `useState` calls (around line 80), add:

```typescript
const [csMode, setCsMode] = useState(false)
```

**Step 2: Replace the "View CS Mode" button (lines 530-541)**

Replace:
```tsx
<button
  onClick={onExit}
  onPointerDown={(e) => e.stopPropagation()}
  style={{...}}
>
  [V] View CS Mode
</button>
```

With:
```tsx
<button
  onClick={() => setCsMode(v => !v)}
  onPointerDown={(e) => e.stopPropagation()}
  style={{
    position: 'absolute', top: 52, left: 16, padding: '6px 12px',
    background: csMode ? '#ff6600' : 'rgba(0,0,0,0.6)', color: 'white',
    border: '1px solid #555', borderRadius: 4, cursor: 'pointer',
    fontSize: 12, fontFamily: 'monospace', zIndex: 100,
  }}
>
  [V] {csMode ? 'View Default Mode' : 'View CS Mode'}
</button>
```

**Step 3: Apply csMode styling to container**

Add conditional style to the root `<div>` — when `csMode` is true, apply a darker overlay filter:

```tsx
<div ref={containerRef} style={{
  width: '100%', height: '100%', position: 'relative',
  filter: csMode ? 'saturate(0.7) contrast(1.1)' : 'none',
}}>
```

**Step 4: Verify**

- `npx tsc --noEmit` — no type errors
- Manual: click button → style changes, stays in planetary mode. Click again → reverts.

**Step 5: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "fix(planetary): CS Mode button toggles visual style instead of exiting"
```

---

## Task 2: Remove bots from planetary mode

**Objective:** Remove all bot spawning and bot mesh rendering from planetary mode.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx`

**Step 1: Remove bot spawning (lines 104-105)**

Delete these two lines:
```typescript
for (let i = 0; i < 3; i++) session.addBot('ct')
for (let i = 0; i < 2; i++) session.addBot('t')
```

**Step 2: Remove bot mesh setup (lines 116-125)**

Delete the entire block:
```typescript
// Add bot character models to the Three.js scene
const botMeshes = new Map<string, THREE.Group>()
const TEAM_COLOR = { ct: 0x3a6ea5, t: 0xa5703a } as const
for (const id of session.playerIds()) {
  if (id === session.localId) continue
  const entity = session.getPlayer(id)!
  const mesh = buildCharacter({ tint: TEAM_COLOR[entity.team], name: entity.name })
  engine.scene.add(mesh)
  botMeshes.set(id, mesh)
}
```

**Step 3: Remove bot mesh sync in render loop (lines 291-301)**

Delete:
```typescript
// 9. Sync bot meshes to their Mercator world positions
for (const [id, mesh] of botMeshes) {
  const entity = session.getPlayer(id)
  if (entity) {
    const pos = entity.player.position
    const worldPos = engine.localToMercator(pos.x, pos.z, pos.y)
    mesh.position.copy(worldPos)
    mesh.rotation.y = entity.player.rotation.y
    mesh.visible = !entity.player.isDead
  }
}
```

**Step 4: Verify**

- `npx tsc --noEmit` — no type errors (check that `buildCharacter` import is no longer needed; if so, remove it)
- `npm run test` — existing tests pass
- Manual: enter planetary mode → no bots visible, no bot names in scoreboard

**Step 5: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "fix(planetary): remove AI bots from planetary mode (network-only)"
```

---

## Verification

```bash
npm run test
npm run lint
npm run build
```

## Notes

- `buildCharacter` import may become unused after removing bots — check and clean up if so
- `THREE` import may become unused if no other Three.js calls remain — check and clean up if so
