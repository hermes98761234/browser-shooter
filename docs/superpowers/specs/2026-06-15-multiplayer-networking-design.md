# Multiplayer — Networking Layer (Design Spec)

**Date:** 2026-06-15
**Status:** Approved for planning
**Scope:** The networked multiplayer layer (co-op + PvP) built on top of the completed *Phase 1: Local Foundation*.

---

## 1. Background

The project is a React 19 + Three.js (r170) + Vite first-person wave-survival shooter. The **Phase 1: Local Foundation** work is already merged (see `2026-06-15-multiplayer-phase1-local-foundation-design.md`): the simulation lives in a transport-agnostic, host-authoritative `GameSession`; wire-protocol types exist in `src/session/protocol.ts`; a `Transport` interface with a synchronous `LoopbackTransport` exists in `src/session/Transport.ts`; `entities/CharacterModel.ts` builds a zoned humanoid (head/body/legs) ready for remote players; `DamageZones`, Tab weapon cycling, and the B buy-store shell are in place.

This spec adds the actual networking so players can **host/join a match, see and shoot each other, and play co-op against the existing bot waves** — modeled on Counter-Strike.

### Decisions made this session (these supersede the older roadmap where they conflict)

- **Transport:** we **roll our own** `PeerTransport` on top of the **`peerjs`** library (free public broker, no server to run), using [PlayPeerJS](https://github.com/therealPaulPlay/PlayPeerJS) only as a *reference* for host/client roles, room codes, and host migration. We do **not** depend on the `playpeerjs` package.
- **Both modes:** co-op (vs bots) and PvP (vs players), selectable when hosting.
- **Lobby size:** up to **10 players** (host + 9), star topology, host relays.
- **Netcode:** host-authoritative + **client-side prediction + server reconciliation + entity interpolation + server-side lag compensation** (the Gabriel Gambetta model).
- **Connection:** **room codes only** (the host's PeerJS id is the code). No public lobby browser (deferred / YAGNI).
- **Phasing:** **co-op first, PvP last** (revises the older PvP-first roadmap).

### Architecture (unchanged from the foundation): one authoritative session everywhere

The host runs the single authoritative `GameSession`. Single-player/bot mode is that session over `LoopbackTransport` (a host with zero remote peers). Multiplayer host is that session over `PeerTransport`; joining clients run a thin **predict-and-render** layer. One simulation runs everywhere — no single-/multiplayer divergence, anti-cheat for free (host runs all damage), hitboxes/economy written once.

---

## 2. Goals & non-goals

### Goals
- A `PeerTransport` implementing the existing `Transport` interface over `peerjs`, with host/client roles, room-code join, and connection lifecycle events.
- Host-authoritative networked play for up to 10 players with **client prediction + reconciliation**, **remote-player interpolation**, and **server-side lag compensation** for fair hits.
- **See each other:** remote players rendered with the existing `CharacterModel` — interpolated transform, current-weapon model, firing/muzzle visuals, nameplate, death.
- **Start-menu flow:** Singleplayer (bots) vs Multiplayer → Host/Join → lobby → start.
- **Co-op vs bots** (host owns waves) and **PvP** (player-vs-player hits, spawns, friendly-fire toggle, kill feed, frag scoring).
- The whole netcode (`NetHost` + `NetClient`) testable deterministically in-process over `LoopbackTransport`, no real WebRTC in CI.

### Non-goals
- No public/matchmaking lobby browser (room codes only).
- No round-based economy (buy phase gating, money from kills/round wins, T/CT teams as a formal economy) — money stays the per-client stub; PvP uses simple frag scoring. A full economy can be a later spec.
- No dedicated/relay server — pure P2P over the PeerJS public broker.
- No persistence/accounts.

---

## 3. Milestones (each = its own implementation plan)

- **M1 — Transport + co-op, 2 players, dumb clients.** `PeerTransport`, room codes, start-menu + multiplayer menu/lobby, remote-player rendering (seeing-each-other), co-op vs bots, host owns waves. Clients render authoritative snapshots with **interpolation only** (no prediction yet) — proves the pipe end-to-end.
- **M2 — Feel + scale.** Client prediction + server reconciliation for the local player, server-side lag compensation for shots, scale to **10 players**, live player list, **host migration**.
- **M3 — PvP.** Player-vs-player hit registration (zones + lag comp), spawn points + respawn timer, friendly-fire toggle, kill feed, frag scoreboard. Bots optional fill.

---

## 4. Components & file layout

New / changed modules:

| Path | Purpose |
|------|---------|
| `src/net/PeerTransport.ts` | **New.** Implements `Transport` over `peerjs`. Host accepts connections + relays; client dials the room code. Emits join/leave/error. Unreliable/unordered channel for input + snapshots; reliable channel for control msgs. |
| `src/net/NetHost.ts` | **New.** Owns the authoritative `GameSession`. Ingests client inputs, steps a **fixed timestep**, records lag-comp history, broadcasts snapshots + effect events. The host is also a local player. |
| `src/net/NetClient.ts` | **New.** Sends input (seq + render-time), applies snapshots, runs prediction/reconciliation for the local player and interpolation buffers for remotes, replays effect events. |
| `src/net/LagCompensation.ts` | **New (M2).** Ring buffer (~1s) of per-tick entity transforms + a rewind helper for hit detection. |
| `src/net/RemotePlayer.ts` | **New.** Wraps `entities/CharacterModel.ts`: interpolated position/yaw/pitch, current-weapon model, firing/muzzle visuals, nameplate, death/respawn. |
| `src/net/connection.ts` | **New.** Small helpers: room-code generation/validation, PeerJS error → user-facing message mapping. |
| `src/ui/MultiplayerMenu.tsx` | **New.** Host (shows copyable room code; pick Co-op/PvP; friendly-fire toggle) or Join (enter code) → lobby with live player list → host **Start**. |
| `src/ui/Scoreboard.tsx` | **New (M3, used in MP).** Per-player score/kills; co-op shows team total. Shown on hold-Tab in MP. |
| `src/session/protocol.ts` | **Changed.** Extend `EntityState` (yaw, pitch, health, weaponType, firing, dead, name); add envelopes: `join`, `welcome`, `playerJoined`, `playerLeft`, `input{seq,renderTime}`, `snapshot{tick,ack,entities,events}`, `hostMigration`. |
| `src/session/GameSession.ts` | **Changed.** Multiple players keyed by id; **fixed-timestep accumulator**; `mode: 'coop' \| 'pvp'`; optional bots; per-shot hit registration drivable through lag-comp rewind; player respawn (PvP). |
| `src/ui/MainMenu.tsx` | **Changed.** Top-level Singleplayer (bots) vs Multiplayer. |
| `src/player/Controls.ts` | **Changed.** In MP, disable Tab weapon-cycle (use `1–3` + mouse wheel); bind hold-Tab to scoreboard (M3). |
| `src/App.tsx` | **Changed.** Orchestrates three roles: singleplayer (local session, as today), host (`NetHost` + local player view), client (`NetClient`, render from snapshots + own-player prediction). |

---

## 5. Detailed design

### 5.1 Transport (`PeerTransport`)

Implements the existing interface:

```ts
interface Transport { send(msg: NetMessage): void; onMessage(cb: (msg: NetMessage) => void): void; }
```

- **Host:** creates a `Peer`; its id is the **room code**. Accepts incoming `DataConnection`s up to the lobby cap (10). Relays peer↔peer traffic (star). Emits `playerJoined`/`playerLeft`.
- **Client:** creates a `Peer`, dials the host's room code, exchanges `join`/`welcome`.
- **Channels:** PeerJS `DataConnection` is reliable+ordered by default. Use a **second unreliable** connection (`reliable: false`) for high-rate input/snapshot traffic (drop stale by tick/seq); keep the reliable connection for control messages (`join`, `welcome`, `playerJoined/Left`, `hostMigration`).
- **Errors:** PeerJS error events (broker unreachable, `peer-unavailable` for a bad code, network loss) map to user-facing messages via `connection.ts` and surface in `MultiplayerMenu`.

### 5.2 Fixed timestep & snapshots

- Host simulates at a **fixed `1/30 s` tick** via an accumulator (preserving the existing max-dt clamp to avoid tunneling).
- Snapshots broadcast at ~**15–20 Hz** (every 1–2 ticks): `{ tick, ack:{playerId→lastSeq}, entities:[EntityState], events:[…] }`.
- Each `EntityState` carries position, yaw, pitch, health, weaponType, firing, dead, name.

### 5.3 Client prediction + reconciliation (M2)

- Client applies its own `PlayerInput` immediately using the same `Player` movement code the host runs, and keeps a queue of unacked inputs (tagged with `seq`).
- On each snapshot: snap the local player to the authoritative state, then **replay** all inputs with `seq > ack` to re-arrive at the predicted present. Remote players are never predicted.
- Before M2, clients render the local player straight from snapshots (one-RTT input lag — acceptable only as the M1 proof-of-pipe).

### 5.4 Entity interpolation

- Remote players (and, on clients, bots) render ~**100 ms behind** the latest snapshot, interpolating position/yaw/pitch between the two bracketing snapshots in `RemotePlayer`'s buffer. This trades a little latency for smoothness and hides packet jitter/loss.

### 5.5 Lag compensation (M2)

- Each input carries the client's **render-time** (its interpolation timestamp).
- When the host processes a shot, it **rewinds** candidate targets to the world state that shooter actually saw (using `LagCompensation`'s per-tick history), raycasts against the rewound transforms (reusing `DamageZones` head/body/legs multipliers and `CollisionWorld.segmentBlocked` occlusion), then applies damage in the present. This makes "I clearly hit them" register fairly despite latency. Applies to both bot hits (co-op) and player hits (PvP).

### 5.6 Seeing each other (`RemotePlayer`)

Each remote player is a `CharacterModel` instance (already zoned for hitboxes) with: interpolated transform, a nameplate sprite, the current weapon's model, muzzle-flash/tracer on `firing` events, and death (ragdoll-lite shrink/fade as bots do today) + respawn handling for PvP. Team tint is available for future use.

### 5.7 Modes

- **Co-op:** host owns bot waves and AI; bots replicate to clients in snapshots; players cannot damage each other.
- **PvP (M3):** friendly-fire toggle (host-set), player↔player hits via zones + lag comp, spawn points around the arena with a respawn timer, kill feed, frag scoreboard. Bots optionally fill empty slots.

### 5.8 Money & score

- **Money:** stays the per-client local stub (no networked economy in this spec).
- **Score/kills:** per-player fields in the snapshot; `Scoreboard` aggregates a team total for co-op and lists frags for PvP.

### 5.9 Start-menu & lobby flow

`MainMenu` → **Singleplayer (bots)** (today's path) or **Multiplayer** → `MultiplayerMenu`:
- **Host:** displays a copyable room code, mode select, friendly-fire toggle → lobby (live player list) → **Start** (host only). The menu ships **Co-op-only** in M1; the PvP option and friendly-fire toggle become live in M3.
- **Join:** enter room code → lobby → wait for host start.

---

## 6. Data flow

```
Client:  keyboard/mouse → Controls → PlayerInput{seq, renderTime}
         → NetClient.send(input) over PeerTransport (unreliable)
         → [predict locally: applyInput + Player movement]   (M2)
Host:    receive inputs → GameSession.applyInput(playerId, input)
         → every fixed tick: GameSession.step(1/30)  (movement, bots, hits w/ zones + lag-comp rewind)
         → record LagCompensation history
         → broadcast snapshot{tick, ack, entities, events} (unreliable) + effect events
Client:  on snapshot → reconcile local player (snap + replay unacked)   (M2)
                     → push remote/bot states into interpolation buffers
                     → replay effect events (audio/particles)
         render: local player from prediction; remotes/bots interpolated ~100ms behind
```

The host additionally renders as a local player reading session state directly (zero-latency host view).

---

## 7. Error handling & edge cases

- **Bad/unknown room code:** PeerJS `peer-unavailable` → "Room not found" in the menu.
- **Broker unreachable / network loss:** surfaced in the menu; client returns to menu.
- **Host leaves:** M1 ends the match with a notice → back to menu. M2 adds **host migration** — elect the next peer (deterministic order, e.g. lowest peer id), who resumes the authoritative sim from the last snapshot (best-effort; brief hitch acceptable).
- **Lobby full:** reject the 11th connection with a "Room full" control message.
- **Late joiner:** receives a full `welcome` snapshot; buffers render until the first periodic snapshot.
- **Stale/out-of-order packets:** discarded by `tick`/`seq` (unreliable channel).
- **Tab focus:** Tab still `preventDefault()`s; in MP it opens the scoreboard instead of cycling weapons.
- **dt clamp:** preserved inside the fixed-step accumulator.

---

## 8. Testing strategy

**Vitest (unit / in-process integration):**
- `NetHost` + `NetClient` wired over `LoopbackTransport` (no real WebRTC): a client's inputs produce the same authoritative result the host computes.
- **Reconciliation convergence:** given inputs + delayed snapshots, the reconciled local state matches authority (M2).
- **Interpolation:** buffer returns correctly blended transforms for a given render-time.
- **Lag-comp rewind:** a shot at render-time T hits a target at its position-at-T, not its present position (M2).
- **PvP / friendly-fire:** damage applies between players only when friendly-fire is on / mode is PvP (M3).
- **Multi-player stepping:** N players stepping deterministically; join/leave updates the player set.
- `PeerTransport` against a **mocked** `peerjs` Peer/DataConnection: connection lifecycle, room-full rejection, error mapping.

**Playwright (E2E):**
- Two browser contexts: host creates a room, client joins by code, both see each other's models move.
- Co-op: both players damage a bot; host owns the wave.
- (M3) PvP: one player frags another; kill feed + scoreboard update.

**Manual:** two tabs over the real PeerJS public broker as a WebRTC smoke test.

**Regression:** existing single-player tests stay green — the local (loopback) path must be unchanged.

---

## 9. Definition of done

- **M1:** Host/join by room code over `PeerTransport`; start-menu Singleplayer/Multiplayer flow + lobby; co-op vs bots for 2 players; remote players render and move (seeing-each-other); in-process `NetHost`+`NetClient` tests pass.
- **M2:** Local player feels responsive (prediction + reconciliation); hits register fairly (lag compensation); up to 10 players; live player list; host migration.
- **M3:** PvP with player hits (zones + lag comp), spawns/respawn, friendly-fire toggle, kill feed, scoreboard.
- All new unit/E2E tests pass; existing tests green; no regression to single-player.
