# Follow-up: heartbeat-based disconnect detection

**Date:** 2026-06-19
**Status:** Tracked follow-up (not yet implemented)
**Parent:** `2026-06-19-free-games-passwords-disconnect-design.md`

## Problem

The shipped disconnect handling detects drops via the transport's `onClose` hook, which
is wired to peerjs's `DataConnection` `'close'` event. In practice peerjs only fires
`'close'` on a **graceful** close (an explicit `conn.close()` / `peer.destroy()` that gets
signalled). It does **not** fire on the surviving peer when the remote disappears
**abruptly** — closing the browser tab/window, a crash, or a network drop. WebRTC's own ICE
failure detection is slow and unreliable across browsers.

Evidence: the e2e `host disconnect returns the client to the menu`
(`e2e/free-games.spec.ts`, marked `test.fixme`) connects two real peers, then closes the
host context. The client stays in-game (HUD visible) indefinitely with no "Host
disconnected" notice. The unit tests pass because they invoke the synthetic
`LoopbackTransport.close()` directly, which does not exercise the peerjs gap.

So the common, important disconnect cases (host closes tab; client closes tab) are not
detected. Graceful in-app teardown is handled.

## Goal

Detect **all** disconnect types — abrupt included — within a few seconds, without relying
on peerjs `'close'`.

## Approach: heartbeat / liveness timeout

Reuse the traffic already flowing over the data channel.

- **Client detects host drop:** the host streams snapshots continuously
  (`NetHost.broadcastSnapshot`). The client (`NetClient`) records the timestamp of the last
  received snapshot. A lightweight timer checks it; if no snapshot has arrived for
  `HOST_TIMEOUT_MS` (suggest ~4–5 s), fire the existing `onDisconnect` path
  (→ "Host disconnected" notice + return to menu). This is the same outcome as today's
  `onClose`, just triggered by silence instead of a `'close'` event.

- **Host detects client drop:** the host already pings clients and receives `input`/`pong`.
  Track the last-seen time per client (`NetHost` already has `pings`/`lastSeq` maps to hang
  this on). A timer removes any client silent for `CLIENT_TIMEOUT_MS` via the existing
  `removeClient(playerId)` (which already broadcasts `playerLeft` and the controller updates
  roster + directory count).

Keep the existing `onClose` wiring as a fast path for graceful closes — the heartbeat is the
backstop for abrupt ones. Whichever fires first wins; make both idempotent (the host-notice
path is already idempotent via `data.role` reset; `removeClient` is filter-based so a double
call is safe, but guard it).

## Considerations

- **Tuning vs. false positives:** the timeout must exceed normal snapshot/ping cadence plus
  realistic lag spikes. Snapshots are frequent; a 4–5 s timeout is conservative. Make it a
  named constant alongside `HEARTBEAT_MS`.
- **Backgrounded tabs:** a backgrounded host throttles timers and may stop broadcasting,
  which would look like a drop. The existing tests already note hosts keep broadcasting while
  backgrounded; verify timer throttling doesn't cause spurious client-side timeouts (consider
  using snapshot arrival, which continues, rather than a host-side wall clock).
- **Pause/buy phases:** confirm snapshots keep flowing during non-playing phases so the
  client timer isn't starved.

## Testing

- Unit: `NetClient` fires `onDisconnect` after `HOST_TIMEOUT_MS` of snapshot silence (drive a
  fake clock). `NetHost` removes a client after `CLIENT_TIMEOUT_MS` of input/pong silence.
- e2e: remove `.fixme` from `host disconnect returns the client to the menu`; add a
  client-drop scenario asserting the host roster/count decrements after a client context
  closes.

## Out of scope

Reconnect, grace-period rejoin, and host migration remain out of scope (unchanged from the
parent spec).
