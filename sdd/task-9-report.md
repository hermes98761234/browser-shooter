# Task 9: E2E Test for Competitive Mode — Report

## Status: DONE

## What was implemented

Created `e2e/competitive.spec.ts` with 3 E2E tests for competitive mode:

1. **`can start competitive match`** — Navigates Multiplayer → Host Game → selects Competitive (CS-style) → Create Room → verifies Lobby appears. Single-page test, no WebRTC needed.

2. **`shows buy phase timer`** — Two-browser-context test: host creates competitive room, joiner connects via room code, host starts match. Verifies "BUY PHASE" text appears on the HUD.

3. **`shows round timer after buy phase`** — Same setup as above, but waits for the 15-second buy phase to expire, then verifies the round countdown timer (e.g. "114s") appears.

## Test results

All 3 tests pass (29.1s total):
```
✓  can start competitive match (3.0s)
✓  shows buy phase timer (6.1s)
✓  shows round timer after buy phase (21.4s)
```

## Design decisions

- Followed existing E2E conventions: `clickButton` helper for menu navigation, `force: true` clicks where needed, try/catch skip pattern for WebRTC failures (matching `multiplayer.spec.ts`).
- Tests 2 and 3 use two browser contexts (host + joiner) since competitive mode requires multiplayer.
- The round timer assertion uses a regex filter for the `\d+s` pattern matching the HUD's `Math.ceil(roundTimer) + 's'` format.

## Commit

- `06289cf` — `test: add E2E tests for competitive mode`
