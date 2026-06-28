---
title: "Fix planetary mode: CS Mode toggle + remove bots"
status: approved
date: 2026-06-28
---

# Fix planetary mode: CS Mode toggle + remove bots

## Summary

Two issues in `src/planetary/PlanetaryMode.tsx`:

1. **"View CS Mode" button exits to main menu** — button's `onClick` was wired to `onExit` instead of toggling a visual mode.
2. **Planetary mode spawns 5 AI bots** — user wants planetary mode reserved for network multiplayer only (no bots).

## Changes

### 1. Fix "View CS Mode" button

**File:** `src/planetary/PlanetaryMode.tsx` (around lines 530-541)

- Add `const [csMode, setCsMode] = useState(false)`
- Change button `onClick` from `onExit` to `() => setCsMode(v => !v)`
- Toggle button label: `"[V] View CS Mode"` ↔ `"[V] View Default Mode"`
- Apply `csMode` state to container styling (CSS class or inline style switch for darker HUD palette)

### 2. Remove bots from planetary mode

**File:** `src/planetary/PlanetaryMode.tsx`

Remove the following blocks:

- Lines 104-105: `for (let i = 0; i < 3; i++) session.addBot('ct')` and `for (let i = 0; i < 2; i++) session.addBot('t')`
- Lines 116-125: `botMeshes` Map declaration and character mesh building loop for non-local players
- Lines 291-301: Render loop sync for bot mesh positions

## Verification

- Enter planetary mode → no bots present in scoreboard or 3D scene
- Click "View CS Mode" button → visual style changes, stays in planetary mode
- Click again → returns to default style
- Click "Exit" button → still returns to main menu (unchanged)
