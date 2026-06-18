**Status**: success
**Summary**: Added grenade keybindings (4/5/6 for HE/Flash/Smoke), G to cycle, and right-click short throw to Controls class.

**Deliverable**: `src/player/Controls.ts` now exposes `onThrowGrenade`, `onSelectGrenade`, and `onCycleGrenade` callbacks, wired to keyboard (Digit4/5/6, KeyG) and mouse (left-click long throw, right-click short throw) events.

**Files touched**: `src/player/Controls.ts`

**Findings worth promoting**:
- The project uses `tsc -b` for type checking (no dedicated typecheck script); `npm run build` runs `tsc -b && vite build`
- Left-click fires both `shoot = true` and `onThrowGrenade?.('long')` — the game loop should decide which takes effect based on active weapon
