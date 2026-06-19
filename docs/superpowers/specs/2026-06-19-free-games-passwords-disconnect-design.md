# Free (drop-in) games, password protection, and disconnect handling

**Date:** 2026-06-19
**Status:** Approved design, ready for implementation planning

## Problem

Today a multiplayer game can only be created in **lobby mode**: the host creates a
room, players gather in a lobby, and the host presses **Start** to begin. Three gaps:

1. **No drop-in ("free") games.** Players cannot join a match that has already
   started. The host broadcasts `start` exactly once; a client who connects afterward
   receives a `welcome` but never a `start`, so it is stranded on the lobby screen.
2. **No password protection.** There is no way to restrict who can join a game.
3. **No disconnect handling.** `NetHost.removeClient()` exists but is never called.
   `PeerConnection` does not listen for peerjs's `close` event, so when any peer drops,
   nothing happens — stale players linger and clients of a dead host hang.

## Goals

- Add a **join policy** axis (`lobby` | `free`) chosen at room creation, independent of
  game mode (coop / pvp / hybrid / competitive).
- **Free** games allow drop-in: a joiner does a quick CS-style team select, then spawns
  directly into the live match.
- A **free** game may carry an optional **password**. The password gates joining and is
  validated by the host. The server list shows which games are protected.
- Handle disconnects CS-style: a dropped client is removed and the match continues; a
  dropped host returns every client to the multiplayer menu with a notice.

## Non-goals

- Reconnect / grace periods. A dropped player is simply gone (CS behavior).
- Host migration. When the host leaves, the game ends.
- Passwords on **lobby** games (only **free** games can be protected).

## Background: current flow

- Host: `App.hostGame()` → `PeerHost.start()` (returns room code) → `HostDirectory.start()`
  registers a `DirectoryEntry` with `status: 'lobby'`. On **Start**, `App` calls
  `hostDirectory.setStatus('in-progress')` and `NetHost.startMatch()` broadcasts `start`.
- Client: `App.joinGame(code)` → `PeerClient.connect(code)` → `NetClient` → sends
  `join {name, team}`. Host's `onClientConnect` handler calls `NetHost.addClient()`,
  which sends `welcome` and broadcasts `playerJoined`. Client waits for `start`.
- Directory: `DirectoryEntry { roomCode, hostName, players, maxPlayers, status, mode }`
  is heartbeated every 5s and expires after 15s. Runs on a **public** PeerJS broker id,
  so any client can list every entry — entries must not contain secrets.

## Design

### 1. Join policy and password at creation

Extend `MatchConfig`:

```ts
export type JoinPolicy = 'lobby' | 'free'

export interface MatchConfig {
  // …existing fields…
  joinPolicy?: JoinPolicy   // default 'lobby'
  password?: string         // only meaningful when joinPolicy === 'free'; '' / undefined = open
}
```

`MatchSetup.tsx` gains:
- A **JOIN POLICY** selector: `Lobby` | `Free`.
- When `Free` is selected, a **password** text input appears (optional; blank = open).

`defaultMatchConfig()` / `defaultCompetitiveConfig()` set `joinPolicy: 'lobby'`.

### 2. Directory: public flags only (no secret)

The password is **never** placed in a `DirectoryEntry` — the directory is world-readable.
Extend the entry with public flags only:

```ts
export interface DirectoryEntry {
  // …existing fields…
  joinPolicy?: JoinPolicy   // 'lobby' | 'free'
  protected?: boolean       // true when the free game has a non-empty password
}
```

`App.hostGame()` populates `joinPolicy` from the config and `protected = !!config.password`.
`heartbeat` carries these through unchanged (they are static for a room's life, so they can
ride along on the existing register/heartbeat messages; add to `DirMessage` register entry
and optionally heartbeat — register is sufficient since they never change).

### 3. Server list and pre-join prompt (client)

`ServerList.tsx`:
- Show a 🔒 indicator on rows where `protected` is true.
- Show the join policy (`Lobby` / `Free`) as a tag (reuse the existing status cell area).

On **Join**:
- **Lobby game** (`joinPolicy !== 'free'`): unchanged — connect and enter the lobby.
- **Free game**: open a **pre-join prompt** (small modal) with:
  - CT / T team buttons (reuse the existing lobby team-select buttons, restyled as a modal).
  - A password input **only if** the row is `protected`.
  - **Join Match** / **Cancel** buttons.
  On confirm, connect and send `join {name, team, password}`.

The pre-join prompt lives in the multiplayer UI (`MultiplayerMenu.tsx` or a small new
component it renders). `App` drives it via state (selected room + its `protected` flag).

### 4. Drop-in handshake (protocol)

Extend `protocol.ts`:

```ts
// join gains an optional password
| { type: 'join'; name: string; team?: Team; password?: string }

// welcome reports whether the match is already running
| { type: 'welcome'; playerId; mode; config; players; started: boolean }

// new: host rejects a join
| { type: 'joinRejected'; reason: 'badPassword' | 'full' }
```

Host (`NetHost` + `App` host glue):
- The host knows its own password (from `MatchConfig`) and whether the match has started.
- On receiving `join`:
  - If the game is password-protected and `msg.password` does not match → send
    `joinRejected {reason:'badPassword'}` and close that transport. Do **not** add the player.
  - (Optional, cheap) if `players >= maxPlayers` → `joinRejected {reason:'full'}` + close.
  - Otherwise `addClient()` as today; `welcome` now includes `started`.
- For a **free** game whose match has **already started**, immediately after `welcome` the
  host sends `start` to that one client (not a broadcast) so it spawns into the live match.
  Team was already chosen in the pre-join prompt and sent in `join`.

Client (`NetClient` + `App`):
- `onWelcome` exposes `started`. `onJoinRejected(cb)` is new.
- Pre-join prompt path: on `joinRejected:'badPassword'`, show "Wrong password" in the prompt
  and let the user retry; on `'full'`, show "Game is full".
- On `start` (whether broadcast or the targeted drop-in send), enter the game as today.

Lobby games are unaffected: `started` is `false`, no targeted `start`, client waits in lobby.

### 5. Disconnect handling

Add close propagation to the transport layer:

- `Transport` interface gains `onClose(cb: () => void): void`.
- `PeerConnection.onClose()` wires to the peerjs `DataConnection` `'close'` event.

**Client drops** (host side):
- `PeerHost`'s connection handler already creates a `PeerConnection` per client. When that
  connection closes, surface it so the host can call `NetHost.removeClient(playerId)`
  (removes the entity, broadcasts `playerLeft`) and update the directory player count
  (`hostDirectory.setPlayers(n)`), and update lobby roster state in `App`. The match
  continues for everyone else.
- Mapping transport → playerId: the host assigns `playerId` in its `join` handler; capture
  it in that closure so the `onClose` handler can remove the right player.

**Host drops** (client side):
- `NetClient` exposes `onDisconnect(cb)` driven by its transport's `onClose`.
- `App` responds by tearing down networking (`resetNetworking()`), returning to the
  multiplayer menu, and showing a **"Host disconnected"** notice.
- The room disappears from the directory naturally: the host's `HostDirectory` heartbeat
  stops and the entry expires after `ENTRY_TTL_MS`.

## Components and responsibilities

| Unit | Change |
| --- | --- |
| `session/MatchConfig.ts` | `JoinPolicy` type; `joinPolicy`, `password` fields; defaults |
| `ui/MatchSetup.tsx` | Join-policy selector + conditional password input |
| `net/directoryProtocol.ts` | `joinPolicy`, `protected` on `DirectoryEntry`; carry in register |
| `net/DirectoryRoster.ts` | Preserve new fields through upsert/list |
| `ui/ServerList.tsx` | 🔒 indicator + policy tag |
| `ui/MultiplayerMenu.tsx` | Pre-join prompt (team + optional password) for free games |
| `session/protocol.ts` | `password` on `join`; `started` on `welcome`; `joinRejected` |
| `net/NetHost.ts` | Validate password; `started`-aware welcome; targeted drop-in `start`; reject path |
| `net/NetClient.ts` | `started` in welcome cb; `onJoinRejected`; `onDisconnect` |
| `session/Transport.ts` | `onClose` on the interface |
| `net/PeerConnection.ts` | Implement `onClose` via peerjs `close` event |
| `net/PeerHost.ts` | Surface per-client close to host glue |
| `net/PeerClient.ts` / `PeerConnection.ts` | Surface host close to `NetClient` |
| `App.tsx` | Wire creation flags, pre-join prompt, drop-in, disconnect on both sides |

## Data flow

**Create free+password game:** MatchSetup → `MatchConfig{joinPolicy:'free', password}` →
`hostGame` → `PeerHost.start` → `HostDirectory.start(entry{joinPolicy:'free', protected:true})`.
Host holds `password` locally. The host still sees the lobby and presses **Start** to begin
(same UI for both policies); the only difference is that for a **free** game, clients who
join **after** Start drop straight in instead of being stranded. "Match already started" =
the host has pressed Start (directory `status === 'in-progress'`).

**Join protected free game in progress:** ServerList (🔒) → pre-join prompt (team + password)
→ `PeerClient.connect` → `join{name, team, password}` → host validates →
`welcome{started:true}` + targeted `start` → client spawns into live match.

**Client disconnect:** peerjs `close` → `PeerConnection.onClose` → host glue →
`NetHost.removeClient` (broadcast `playerLeft`) + `hostDirectory.setPlayers(n)`.

**Host disconnect:** peerjs `close` → `PeerConnection.onClose` → `NetClient.onDisconnect`
→ `App` resets networking, returns to menu, shows "Host disconnected".

## Error handling

- Wrong password: `joinRejected:'badPassword'` → retry in prompt.
- Full game (optional): `joinRejected:'full'` → "Game is full".
- Host gone: client notice + return to menu; entry TTL-expires from directory.
- Client gone: removed from session/roster/count; match continues.

## Testing

- `MatchConfig`: defaults include `joinPolicy:'lobby'`; free config carries password.
- `DirectoryRoster`: `joinPolicy` / `protected` survive upsert → list.
- `NetHost`: rejects bad password (no player added, `joinRejected` sent); accepts correct
  password; sends targeted `start` for a free in-progress join; `removeClient` on close
  broadcasts `playerLeft`.
- `NetClient`: surfaces `started`; fires `onJoinRejected`; fires `onDisconnect` on transport close.
- `PeerConnection`: `onClose` invoked on peerjs `close` event (mock `DataConnection`).
- e2e (`e2e/multiplayer.spec.ts` extension): create free game → second client drops in mid-match;
  protected game rejects wrong password then accepts correct; client disconnect updates roster;
  host disconnect returns client to menu.
