# Fix: CS Mode Button on Mobile + Map Picker Phantom Dot

**Date:** 2026-06-28
**Status:** Approved

## Summary

Two bugs in the planetary / competitive mode flow:

1. **Mobile:** Clicking the `[V] View CS Mode` button does nothing because the TouchControls look pad intercepts all touches.
2. **Map picker:** User sees an unexplained dot on the map when choosing where to jump.

## Bug 1 — Mobile: CS Mode Button Unresponsive

### Root Cause

`TouchControls` renders a full-screen look pad (`position: absolute, inset: 0, pointerEvents: auto, zIndex: 25`) that captures all touch events for camera control. The overlay buttons (`[M] Map`, `[V] View CS Mode`, `Exit`) in `PlanetaryMode.tsx` have no explicit zIndex and use plain `onClick`. On mobile, the look pad's `onTouchStart` fires first and the event never reaches the button's click handler.

### Fix

In `PlanetaryMode.tsx`, for all three overlay buttons:

1. Add `zIndex: 100` to the inline style (above TouchControls' zIndex 25)
2. Add `onPointerDown={(e) => e.stopPropagation()}` so the touch event does not propagate to the look pad underneath

This is a minimal, surgical fix — no changes to TouchControls, no new state. The buttons sit above the touch overlay in the stacking order and pointer events are stopped before they reach the look pad.

**Files changed:**
- `src/planetary/PlanetaryMode.tsx` — lines 514-545 (three buttons)

## Bug 2 — Map Picker Phantom Dot

### Root Cause

`MapPicker` receives `playerPositions={[]}` from `PlanetaryMode`, so no markers are intentionally rendered. The dot the user sees is likely a browser geolocation indicator or a rendering artifact.

### Fix

Two-pronged approach:

1. **Show the selected location as an intentional dot** — After the user clicks the map, render a green "drop point" marker at the clicked location. This makes the dot useful (confirms where you'll land) and only appears after a click, not on initial load.
2. **Defensive marker cleanup** — Ensure markers are properly removed on unmount and when `playerPositions` changes.

**Implementation:**

- Add `selectedLocation: [number, number] | null` state in `MapPicker`
- In the map `click` handler, set `selectedLocation` before calling `onTeleport`
- Render a green dot marker at `selectedLocation` (separate from `playerPositions` markers)
- Clear `selectedLocation` when the picker closes (`onClose` or unmount)

**Files changed:**
- `src/planetary/MapPicker.tsx` — add selectedLocation state and green dot rendering

## Verification

1. **Mobile button test:** On a touch device, open planetary mode, tap `[V] View CS Mode` — should respond immediately (not blocked by look pad).
2. **Map picker test:** Open the map picker — no dot should be visible initially. Click anywhere — a green dot appears at the clicked location confirming the drop point.
3. **Regression:** Desktop behavior unchanged — buttons still work with mouse, map click still triggers teleport.
