# Mobile UI/UX Redesign — Design Spec

**Date:** 2026-06-19
**Status:** Approved (autonomous goal execution)

## Problem

The game ships with on-screen touch controls and renders all menus, but the UI
was built desktop-first. A mobile audit surfaced concrete problems that make the
game awkward or broken on phones:

- **Viewport:** `index.html` only sets `width=device-width, initial-scale=1`. Pinch
  and double-tap zoom are enabled (bad for a game), and notch/safe-area insets are
  ignored, so controls and HUD can sit under the status bar or home indicator.
- **Touch controls:** positioned with raw pixel offsets (no safe-area awareness),
  the scoreboard/TAB toggle is only 40px tall (below the 44px tap-target minimum),
  and buttons give no pressed-state feedback.
- **Menus overflow narrow screens:** fixed widths overflow phones <480px —
  Scoreboard `minWidth:480`, BuyMenu `minWidth:600`, SettingsMenu `minWidth:360`,
  MainMenu title `fontSize:64`, MultiplayerMenu/MatchSetup fixed columns/inputs.
- **Hover-only interactions:** PauseMenu uses `onMouseEnter/onMouseLeave` for the
  only visual button feedback; BuyMenu reveals its 3D preview on hover. Neither
  fires on touch.
- **Orientation:** a first-person shooter is far more playable in landscape, but
  there is no guidance when a mobile player holds the phone in portrait.

## Goals

1. Prevent accidental zoom and respect device safe areas (notches/home indicator).
2. Make every menu fit and remain usable on a 360px-wide portrait phone.
3. Ensure all interactive elements are touch-sized (≥44px) with pressed feedback.
4. Replace hover-only affordances with touch-compatible equivalents.
5. Nudge mobile players toward landscape during gameplay without hard-locking.

## Non-Goals (YAGNI)

- No new gameplay mechanics or control schemes.
- No full design-system / theming rewrite — minimal shared helpers only.
- No PWA install manifest, service worker, or offline support.
- No haptics / vibration API integration.

## Approach

Incremental, layered fixes that reuse the existing inline-style architecture. No
new dependencies. Each unit is independently verifiable.

### 1. Viewport & CSS foundation

- `index.html`: viewport →
  `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`.
- `src/index.css`: add safe-area-inset CSS vars; disable user text selection,
  iOS tap highlight, callout, and overscroll bounce on the app root for an
  app-like feel. Keep selection enabled for text inputs.

### 2. TouchControls (`src/ui/TouchControls.tsx`)

- Offset joystick / action clusters by `env(safe-area-inset-*)` so they clear
  notches and the home indicator.
- Raise minimum action-button size to 56px; fix the TAB toggle to ≥44px tall.
- Add a pressed visual state (opacity/scale change on touchstart) for tactile feedback.

### 3. Responsive menus

Convert fixed widths to fluid equivalents so nothing overflows a 360px screen:

- Pattern: `width: min(<desktop-px>, calc(100vw - 32px))`, and titles use
  `clamp(<min>, <vw>, <max>)`.
- Files: `MainMenu.tsx`, `MultiplayerMenu.tsx`, `MatchSetup.tsx`,
  `SettingsMenu.tsx`, `TeamSelect.tsx`, `AboutModal.tsx`. Add vertical scroll
  (`overflow:auto`, `maxHeight`) to tall modals.

### 4. Scoreboard & BuyMenu

- `Scoreboard.tsx`: container `min(480px, calc(100vw - 24px))`; allow horizontal
  scroll of the column grid as a fallback on very narrow screens; bump tiny fonts.
- `BuyMenu.tsx`: container fluid width; selecting an item (tap/click) also drives
  the preview, so the preview is reachable without hover; stack the preview panel
  below the grid on narrow widths.

### 5. HUD (`src/ui/HUD.tsx`)

- Health/plant/defuse bar widths use `min(200px, 40vw)`.
- Offset bottom/edge HUD clusters by safe-area insets so they don't collide with
  touch controls or notches.

### 6. PauseMenu (`src/ui/PauseMenu.tsx`)

- Remove `onMouseEnter/onMouseLeave` inline handlers; replace with a shared button
  style and `:active`/`:hover` via a small injected style or onPointer handlers
  that work for both mouse and touch.

### 7. Orientation hint

- Add a `RotateHint` overlay shown only on touch devices during gameplay when
  `window.innerHeight > window.innerWidth` (portrait). Non-blocking, dismisses
  automatically on rotation to landscape. Listens to `resize`/`orientationchange`.

## Testing

- Existing unit tests (vitest) and e2e (playwright) must continue to pass.
- Add/adjust a unit test for the new `RotateHint` (renders only in portrait on
  touch) and for `mobileControlsActive` if behavior touched.
- Manual verification: run dev server, emulate a 390×844 device, confirm menus
  fit, controls clear safe areas, no zoom on double-tap, and rotate hint toggles.

## Rollout

Implement on a feature branch, run the full test suite + typecheck/lint, then
merge to `main` and push (matches the repo's existing merge-to-main workflow).
