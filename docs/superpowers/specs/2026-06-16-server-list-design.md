# Server List (auto-elect directory) — Design

**Date:** 2026-06-16
**Status:** Approved, pending implementation plan

## Problem

The game has multiplayer (co-op), but the only way to join another player's
game is to obtain their room code out-of-band and type it in. There is no way
to discover open games. This spec adds a **server list / game browser**.

Multiplayer today rides on PeerJS: a host's peer id *is* its room code
(`src/net/PeerHost.ts`), and a client dials it directly
(`src/net/PeerClient.ts`). There is no discovery layer. A server list needs a
shared place where hosts announce themselves and clients read that back.

## Decisions (locked)

- **Discovery model:** Well-known directory peer (pure-client, no traditional
  backend service).
- **Who runs the directory:** Auto-elect — the first host to claim a fixed
  PeerJS id becomes the directory; everyone else registers to it. Accepted
  trade-off: the list blips when the elected host leaves, then self-heals via
  re-election.
- **Row contents:** Host name, player count (n/max), status (lobby /
  in-progress), and ping.
- **Manual join:** Keep both — the server list is the primary path, but the
  room-code input + Join button stay as a fallback (direct/private/unlisted
  joins, and joining during a re-election gap).
- **Defaults:** directory id `browser-shooter-directory-v1`; entry TTL 15s;
  host heartbeat 5s; soft capacity `maxPlayers = 8`.

## Architecture overview

A **well-known directory peer** holds a roster of open games. It is claimed by
auto-election: the first host to grab the fixed PeerJS id becomes the
directory; everyone else registers to it. Browsing clients read the roster
from it. Joining still uses the existing `PeerClient.connect(roomCode)`
unchanged — the directory only handles *discovery*, never gameplay traffic.

The fixed id is a **global singleton on the shared PeerJS cloud broker**: every
player of the app worldwide shares one list. For a co-op hobby game this is the
desired behavior. The version suffix (`-v1`) lets us rotate the namespace.

Caveat: anyone can squat the fixed id, and the shared cloud broker is
best-effort. Acceptable at this scale; re-election self-heals when the holder
disappears.

## Components

All new code lives under `src/net/`. PeerJS-specific pieces are thin adapters;
all logic sits behind the existing `Transport` interface
(`src/session/Transport.ts`) so tests can use `createLinkedTransports()` with no
real network.

- **`directoryProtocol.ts`** — message types for the directory channel, kept
  separate from the game `NetMessage` protocol:
  - `register { roomCode, hostName, players, maxPlayers, status }`
  - `heartbeat { roomCode, players, status }`
  - `unregister { roomCode }`
  - `listRequest {}`
  - `listResponse { entries: DirectoryEntry[] }`

  `DirectoryEntry = { roomCode, hostName, players, maxPlayers, status }` where
  `status` is `'lobby' | 'in-progress'`.

  Ping `probe`/`probeAck` messages are **not** part of this protocol — they
  travel over the game peer connection and are added to the game `NetMessage`
  protocol (`src/session/protocol.ts`); see Ping below.

- **`DirectoryRoster.ts`** — pure, PeerJS-free class. Holds
  `Map<roomCode, { hostName, players, maxPlayers, status, lastSeen }>`.
  Methods: `upsert(entry, now)`, `remove(roomCode)`, `list()`,
  `expire(ttlMs, now)`. **This is the unit-tested core of the feature.**

- **`DirectoryServer.ts`** — wraps a `Transport`-accepting peer. Routes incoming
  directory messages into a `DirectoryRoster`. Expires stale entries (TTL 15s)
  on a timer. Answers `listRequest` with the current roster.

- **`DirectoryClient.ts`** — connects to the directory id.
  - Host mode: `register()` then a heartbeat loop (5s).
  - Browser mode: `fetchList()` → `DirectoryEntry[]`.
  - Handles "directory absent" (connect error → empty list) and
    connection-close (host mode triggers re-election).

- **`elect.ts`** — `tryBecomeDirectory()`: creates `new Peer(FIXED_ID)`;
  resolves a `DirectoryServer` on `open`, or resolves `null` on the
  `unavailable-id` error (another peer already owns the directory).

## Data flow

### Host (`App.hostGame`)

1. `peerHost.start()` yields the room code (as today).
2. Run `tryBecomeDirectory()`.
   - If **elected**: keep the `DirectoryServer` running and also point a local
     `DirectoryClient` at self.
   - If **not elected**: open a `DirectoryClient` to the existing directory.
3. Either way, `register({ roomCode, hostName, players, maxPlayers: 8,
   status: 'lobby' })`, then heartbeat every 5s.
4. On match start → heartbeat with `status: 'in-progress'`.
5. On leave → `unregister` + destroy peers (game host peer and, if elected, the
   directory peer).
6. If the directory connection closes (the elected host quit), retry election
   after a small backoff. The list blips empty, then self-heals once a new
   directory is elected and hosts re-register. (Accepted trade-off.)

### Browser (multiplayer menu)

1. On open / Refresh, `DirectoryClient.fetchList()`.
2. For each row, fire a transient **ping probe** (see below).
3. Clicking a row calls the existing `onJoin(code)` path — no change to the
   join/gameplay flow.

### Ping (transient probe)

- The browser opens a short-lived PeerJS `DataConnection` to the **host's game
  peer** (the room code), sends `probe { t }`, the host replies
  `probeAck { t }`, the browser computes RTT = `now - t`, then closes the
  connection.
- Probes are concurrency-capped and use a ~3s timeout. On timeout the row shows
  `—` and remains joinable.
- The host answers probes in its existing per-connection message router
  (`App.hostGame`'s `onClientConnect` handler, which already branches on
  `msg.type === 'join'`). A new `probe` branch replies `probeAck` on the same
  transport without registering a client. `probe`/`probeAck` are added to the
  game `NetMessage` protocol.

## UI (`src/ui/MultiplayerMenu.tsx`)

The non-lobby screen gains a **server list** as the primary path:

- A table/list with columns: **Host name · Players (n/8) · Status · Ping**.
- A **Refresh** button.
- A "No games found" empty state.
- Below the list, the existing **room-code input + Join** button stays as a
  fallback (keep both).

The lobby screen is unchanged. Consider extracting the server-list table into
its own `ServerList` component for isolated component testing.

## Error handling

- **No directory up** → empty list, not an error.
- **Election race** (two hosts claim simultaneously) → the loser receives
  `unavailable-id` and falls back to registering. PeerJS guarantees a single
  winner of a fixed id.
- **Stale entries** (host crashed without `unregister`) → TTL expiry removes
  them within 15s.
- **Probe timeout** → `—` ping; row still joinable.

## Testing

- **Unit:**
  - `DirectoryRoster` — upsert, expire (TTL), list ordering/shape.
  - `DirectoryServer` ↔ `DirectoryClient` register → list round-trip over
    `createLinkedTransports()`.
  - Heartbeat refreshes `lastSeen` and prevents expiry; missed heartbeats lead
    to expiry.
- **Component:**
  - `ServerList` renders rows from entries, click → `onJoin(code)`, Refresh
    re-fetches, empty state renders when there are no entries.
- **e2e (`e2e/multiplayer.spec.ts`):**
  - A hosted game appears in a second client's server list and is joinable from
    the list.
- Election and PeerJS adapters stay thin and are exercised via e2e rather than
  mocked unit tests.

## Scope guardrails (YAGNI)

Out of scope for this iteration:

- Passwords / private-game flags.
- Regions / matchmaking.
- A persistent backend or database.
- Spectators.
- Hard capacity enforcement — `maxPlayers` is a soft display value; the host
  does not reject overflow joins in this iteration.
