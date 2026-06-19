# Push-to-Talk Voice Chat — Design

**Date:** 2026-06-19
**Status:** Approved (design); pending implementation plan

## Summary

Add CS-style push-to-talk (walkie-talkie) voice chat. A player holds **K** to
transmit live microphone audio to their teammates and releases it to stop. While
anyone on the team is talking, a stacked list of active speakers (mic icon +
nickname) appears in the bottom-left corner of the screen.

Voice is real WebRTC audio over the existing PeerJS infrastructure, team-scoped,
and flat (non-positional, like CS team comms).

## Goals

- Hold **K** → capture microphone → stream live voice to **teammates only**.
- Release **K** → stop transmitting.
- Bottom-left shows **all currently-active speakers** (local player + talking
  teammates), each as a mic icon + nickname. Entries appear on key-down and
  clear on key-up (with a short fade to avoid flicker).
- Microphone permission requested **lazily on first K press**; denial shows a
  brief notice and disables PTT without affecting the game.
- **K** is a single hardcoded constant, matching how WASD/B/Tab are handled today.

## Non-Goals (YAGNI for this iteration)

- Rebindable keys / settings UI (other keys are hardcoded today; rebinding is a
  later feature).
- Positional/3D teammate voice (team comms are intentionally flat, like CS).
- All-chat / enemy-audible voice or a separate all-chat key.
- Voice activity detection / open-mic mode.
- Per-player volume controls, mute lists, recording.

## Context (existing system)

- **Stack:** React 19 + TypeScript + Three.js, built with Vite.
- **Networking:** PeerJS (WebRTC P2P), host-authoritative star topology. Clients
  connect to a host who relays game snapshots each tick.
- **Audio today:** Spatial sound effects only (Web Audio API). No
  `getUserMedia`/microphone usage anywhere.
- **Input:** `src/player/Controls.ts` handles keyboard; **K** is currently unused.
- **Identity:** Each player has a `name` (nickname) and `team`; the host knows
  every client's PeerJS peer id (the `DataConnection.peer`).
- **UI overlays:** React HUD components absolutely positioned over the canvas.

## Architecture: two planes

The design separates a **control plane** (through the host) from a **media
plane** (direct peer-to-peer), because browsers cannot mix/relay audio well but
the host already provides reliable, team-aware data relay.

### Control plane — through the host (reliable data channel)

The host knows everyone's team, so it performs team-filtering centrally.

New protocol messages (`src/session/protocol.ts`):

- `voiceRoster` — host → each client. The client's **current teammates** as
  `{ playerId, peerId, name }[]`. Re-sent whenever team membership changes
  (e.g. competitive side switches) or players join/leave.
- `voiceStart` — client → host, then relayed by the host to that client's
  teammates. Carries the speaker's `playerId`.
- `voiceStop` — client → host, relayed to teammates. Carries the speaker's
  `playerId`.

The control plane drives the **speaker indicator** and **mesh membership**. It
is decoupled from the audio so the indicator is correct even before/independent
of media negotiation.

### Media plane — direct PeerJS mesh (teammates only)

Actual audio travels peer-to-peer between teammates, bypassing the host.

- Each client reuses its existing PeerJS `Peer` instance to place and answer
  calls (`peer.call(peerId, micStream)` / `peer.on('call', …)`).
- **Team-scoped mesh:** a client establishes calls only with the teammates in
  its current `voiceRoster`. On roster changes, calls to ex-teammates are torn
  down and calls to new teammates are opened (mesh reconciliation).
- **No double-calling:** for any pair, the peer with the lexicographically
  smaller `peerId` initiates the call; the other answers. This guarantees a
  single call per pair.
- The host participates as just another node in the mesh.
- The microphone stream is acquired **once**; `track.enabled` is toggled by K so
  audio only flows while the key is held. Incoming teammate streams are played
  through `<audio>` elements (flat, non-positional).
- On a peer disconnect, its call is torn down and it is removed from the speaker
  list.

## Speaker-list state machine

The bottom-left indicator is driven by a small state map of active speakers:

- **Local player:** added on local K key-down, removed on key-up.
- **Remote teammates:** added on receiving `voiceStart`, removed on `voiceStop`.
- **Safety removals:** a speaker is also removed if its peer disconnects, or if
  no stop/refresh is seen within a timeout (guards against a lost `voiceStop`).
- Short fade-out on removal to avoid flicker.

## Modules (new and changed)

### New

- **`src/voice/VoiceChat.ts`** — orchestrator. Responsibilities: acquire the mic
  (lazily), maintain the teammate call mesh, toggle transmission on talk
  start/stop, emit a "speakers changed" event, reconcile the mesh on roster
  changes, and clean up on disconnect. Built behind small **injected
  interfaces** (a media provider for `getUserMedia`, and a peer/call factory)
  so the orchestration logic is unit-testable without real WebRTC.
- **`src/ui/VoiceIndicator.tsx`** — bottom-left overlay rendering the active
  speaker list (mic icon + nickname), driven by React state.

### Changed

- **`src/player/Controls.ts`** — add K key-down/key-up handling that fires
  `onTalkStart` / `onTalkStop` callbacks (guarding against auto-repeat so a held
  key fires start once).
- **`src/session/protocol.ts`** — add `voiceRoster`, `voiceStart`, `voiceStop`
  message types.
- **`src/net/NetHost.ts`** — maintain and broadcast the team-scoped voice
  roster; relay `voiceStart`/`voiceStop` to the speaker's teammates only.
- **`src/net/NetClient.ts`** — surface the roster and remote speaker events to
  the app/`VoiceChat`.
- **`src/App.tsx`** — instantiate and wire `VoiceChat`, connect K callbacks, and
  feed the active speaker list into `VoiceIndicator`.

## Error handling & edge cases

- **Permission denied / no mic:** catch `getUserMedia` failure on first K press,
  show a brief notice, disable PTT, leave the game running.
- **No teammates (e.g. solo):** nothing is transmitted, but the local player
  still sees their own indicator while holding K.
- **Team/side change mid-match:** host re-broadcasts roster; mesh reconciles.
- **Lost `voiceStop`:** speaker auto-expires via timeout.
- **Peer disconnect mid-talk:** call torn down, speaker removed.
- **Auto-repeat key events:** start fires once per physical press.

## Testing approach

- **Unit-testable pure logic** (behind injected fakes, no real WebRTC):
  - teammate gating (who is in the mesh given a roster),
  - speaker-list state machine (add on start; remove on stop / disconnect /
    timeout),
  - initiator-selection rule (smaller `peerId` initiates),
  - mesh reconciliation on roster changes (tear down ex-teammates, open new).
- **Host relay logic:** `voiceStart`/`voiceStop` are relayed only to the
  speaker's teammates; roster is team-scoped.
- **Manual / e2e:** actual audio capture and playback verified manually.
  Optionally a Playwright smoke test of the indicator with a mocked
  `getUserMedia`.

## Open questions

None outstanding. Decisions locked during brainstorming:

- Real voice transmission + indicator (not indicator-only).
- Team-only audience (CS default).
- Indicator lists all active speakers.
- Flat (non-positional) teammate voice.
- K hardcoded (single constant) for this iteration.
