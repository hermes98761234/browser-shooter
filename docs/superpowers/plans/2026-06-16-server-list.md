# Server List (auto-elect directory) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a discoverable server list (game browser) to multiplayer so players can see and join open games without exchanging room codes manually.

**Architecture:** A well-known PeerJS peer (fixed id) acts as a directory of open games. The first host to claim that id becomes the directory (auto-election); other hosts register to it; browsing clients read the roster. Joining still uses the existing `PeerClient.connect(roomCode)` path — the directory handles discovery only. All directory logic sits behind a generic `Channel<T>` interface so it is unit-testable with in-process linked channels (no real network); PeerJS-bound adapters (election, dialing, ping probes) are thin and covered by e2e.

**Tech Stack:** TypeScript, React 19, PeerJS 1.5, Vitest (unit/component), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-06-16-server-list-design.md`

---

## File Structure

**New files:**
- `src/net/directoryProtocol.ts` — directory message union, `DirectoryEntry`, constants.
- `src/net/Channel.ts` — generic `Channel<T>`, `createLinkedChannels<T>()`, `PeerChannel<T>`.
- `src/net/DirectoryRoster.ts` — pure roster (PeerJS-free, the tested core).
- `src/net/DirectoryServer.ts` — routes directory messages into a roster, answers list requests.
- `src/net/DirectoryClient.ts` — register / heartbeat / unregister / fetchList over a `Channel`.
- `src/net/directoryPeer.ts` — `tryBecomeDirectory()` + `dialDirectory()` (PeerJS adapters).
- `src/net/probePing.ts` — `measurePing(roomCode)` transient pre-join latency probe.
- `src/net/HostDirectory.ts` — orchestration: election, register, heartbeat, re-election, cleanup.
- `src/ui/ServerList.tsx` — the list/table UI component.

**Modified files:**
- `src/session/protocol.ts` — add `probe`/`probeAck` to `NetMessage`.
- `src/ui/MultiplayerMenu.tsx` — render `ServerList` + new `servers`/`onRefresh` props.
- `src/App.tsx` — wire `HostDirectory` into hosting, answer `probe`, set status on match start, browse the list in the mpmenu, cleanup on leave.

**New test files:**
- `src/net/__tests__/Channel.test.ts`
- `src/net/__tests__/DirectoryRoster.test.ts`
- `src/net/__tests__/Directory.test.ts` (server↔client over linked channels)
- `src/net/__tests__/directoryPeer.test.ts`
- `src/net/__tests__/probePing.test.ts`
- `src/net/__tests__/HostDirectory.test.ts`
- `src/ui/__tests__/ServerList.test.tsx`
- extend `e2e/multiplayer.spec.ts`

---

## Task 1: Directory protocol & constants

**Files:**
- Create: `src/net/directoryProtocol.ts`
- Test: `src/net/__tests__/directoryProtocol.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/net/__tests__/directoryProtocol.test.ts
import { describe, it, expect } from 'vitest'
import { DIRECTORY_PEER_ID, ENTRY_TTL_MS, HEARTBEAT_MS } from '../directoryProtocol'

describe('directoryProtocol constants', () => {
  it('exposes a versioned directory id and TTL longer than the heartbeat', () => {
    expect(DIRECTORY_PEER_ID).toBe('browser-shooter-directory-v1')
    expect(HEARTBEAT_MS).toBe(5_000)
    expect(ENTRY_TTL_MS).toBeGreaterThan(HEARTBEAT_MS)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/directoryProtocol.test.ts`
Expected: FAIL — cannot find module `../directoryProtocol`.

- [ ] **Step 3: Write the implementation**

```ts
// src/net/directoryProtocol.ts

/** Global, shared directory id on the public PeerJS broker. Bump the suffix to rotate. */
export const DIRECTORY_PEER_ID = 'browser-shooter-directory-v1'
/** A roster entry is dropped if it has not been refreshed within this window. */
export const ENTRY_TTL_MS = 15_000
/** Hosts re-announce themselves on this interval. */
export const HEARTBEAT_MS = 5_000

export type ServerStatus = 'lobby' | 'in-progress'

export interface DirectoryEntry {
  roomCode: string
  hostName: string
  players: number
  maxPlayers: number
  status: ServerStatus
}

/** Messages carried on the directory channel (distinct from the game NetMessage protocol). */
export type DirMessage =
  | { type: 'register'; entry: DirectoryEntry }
  | { type: 'heartbeat'; roomCode: string; players: number; status: ServerStatus }
  | { type: 'unregister'; roomCode: string }
  | { type: 'listRequest' }
  | { type: 'listResponse'; entries: DirectoryEntry[] }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/directoryProtocol.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/net/directoryProtocol.ts src/net/__tests__/directoryProtocol.test.ts
git commit -m "feat(net): directory protocol types and constants"
```

---

## Task 2: Generic Channel abstraction

**Files:**
- Create: `src/net/Channel.ts`
- Test: `src/net/__tests__/Channel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/net/__tests__/Channel.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createLinkedChannels, PeerChannel } from '../Channel'

type Msg = { type: 'hi'; n: number }

describe('createLinkedChannels', () => {
  it('delivers a message sent on one end to the other end only', () => {
    const [a, b] = createLinkedChannels<Msg>()
    const onA = vi.fn(); const onB = vi.fn()
    a.onMessage(onA); b.onMessage(onB)
    a.send({ type: 'hi', n: 1 })
    expect(onB).toHaveBeenCalledWith({ type: 'hi', n: 1 })
    expect(onA).not.toHaveBeenCalled()
  })

  it('fires onClose handlers on both ends when either end closes', () => {
    const [a, b] = createLinkedChannels<Msg>()
    const closeA = vi.fn(); const closeB = vi.fn()
    a.onClose(closeA); b.onClose(closeB)
    a.close()
    expect(closeA).toHaveBeenCalled()
    expect(closeB).toHaveBeenCalled()
  })
})

describe('PeerChannel', () => {
  it('wraps a DataConnection: send forwards, data/close register handlers', () => {
    const conn: Record<string, unknown> = {}
    const on = vi.fn((e: string, cb: (a: unknown) => void) => { conn[e] = cb })
    const fakeConn = { send: vi.fn(), close: vi.fn(), on } as never
    const ch = new PeerChannel<Msg>(fakeConn)
    const onMsg = vi.fn(); ch.onMessage(onMsg)
    ;(conn['data'] as (a: unknown) => void)({ type: 'hi', n: 2 })
    expect(onMsg).toHaveBeenCalledWith({ type: 'hi', n: 2 })
    ch.send({ type: 'hi', n: 3 })
    expect((fakeConn as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledWith({ type: 'hi', n: 3 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/Channel.test.ts`
Expected: FAIL — cannot find module `../Channel`.

- [ ] **Step 3: Write the implementation**

```ts
// src/net/Channel.ts
import type { DataConnection } from 'peerjs'

/** A bidirectional typed message channel. Game code uses Transport; directory code uses this. */
export interface Channel<T> {
  send(msg: T): void
  onMessage(cb: (msg: T) => void): void
  onClose(cb: () => void): void
  close(): void
}

/** Two cross-wired in-process endpoints for tests. close() notifies both ends. */
export function createLinkedChannels<T>(): [Channel<T>, Channel<T>] {
  const aMsg: ((m: T) => void)[] = []; const bMsg: ((m: T) => void)[] = []
  const aClose: (() => void)[] = []; const bClose: (() => void)[] = []
  const fireBoth = () => { aClose.forEach(h => h()); bClose.forEach(h => h()) }
  const a: Channel<T> = {
    send: (m) => bMsg.forEach(h => h(m)),
    onMessage: (cb) => { aMsg.push(cb) },
    onClose: (cb) => { aClose.push(cb) },
    close: fireBoth,
  }
  const b: Channel<T> = {
    send: (m) => aMsg.forEach(h => h(m)),
    onMessage: (cb) => { bMsg.push(cb) },
    onClose: (cb) => { bClose.push(cb) },
    close: fireBoth,
  }
  return [a, b]
}

/** Adapts a peerjs DataConnection to Channel<T>. */
export class PeerChannel<T> implements Channel<T> {
  constructor(private conn: DataConnection) {}
  send(msg: T): void { this.conn.send(msg) }
  onMessage(cb: (msg: T) => void): void { this.conn.on('data', (d) => cb(d as T)) }
  onClose(cb: () => void): void { this.conn.on('close', cb) }
  close(): void { this.conn.close() }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/Channel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/net/Channel.ts src/net/__tests__/Channel.test.ts
git commit -m "feat(net): generic Channel with linked + peerjs adapters"
```

---

## Task 3: DirectoryRoster (pure roster)

**Files:**
- Create: `src/net/DirectoryRoster.ts`
- Test: `src/net/__tests__/DirectoryRoster.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/net/__tests__/DirectoryRoster.test.ts
import { describe, it, expect } from 'vitest'
import { DirectoryRoster } from '../DirectoryRoster'
import type { DirectoryEntry } from '../directoryProtocol'

const entry = (roomCode: string): DirectoryEntry => ({
  roomCode, hostName: 'Alice', players: 1, maxPlayers: 8, status: 'lobby',
})

describe('DirectoryRoster', () => {
  it('upsert adds an entry that list() returns without lastSeen', () => {
    const r = new DirectoryRoster()
    r.upsert(entry('ROOM1'), 1000)
    expect(r.list()).toEqual([entry('ROOM1')])
  })

  it('heartbeat refreshes lastSeen, players and status', () => {
    const r = new DirectoryRoster()
    r.upsert(entry('ROOM1'), 1000)
    r.heartbeat('ROOM1', 3, 'in-progress', 2000)
    expect(r.list()[0]).toMatchObject({ players: 3, status: 'in-progress' })
  })

  it('expire drops entries older than ttl, keeps fresh ones', () => {
    const r = new DirectoryRoster()
    r.upsert(entry('OLD'), 0)
    r.upsert(entry('NEW'), 9000)
    r.expire(15_000, 16_000) // OLD lastSeen 0 is 16s stale (>15s); NEW is 7s
    expect(r.list().map(e => e.roomCode)).toEqual(['NEW'])
  })

  it('remove deletes an entry', () => {
    const r = new DirectoryRoster()
    r.upsert(entry('ROOM1'), 1000)
    r.remove('ROOM1')
    expect(r.list()).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/DirectoryRoster.test.ts`
Expected: FAIL — cannot find module `../DirectoryRoster`.

- [ ] **Step 3: Write the implementation**

```ts
// src/net/DirectoryRoster.ts
import type { DirectoryEntry, ServerStatus } from './directoryProtocol'

interface RosterRecord extends DirectoryEntry { lastSeen: number }

/** In-memory roster of open games. Pure (no PeerJS); fully unit-tested. */
export class DirectoryRoster {
  private records = new Map<string, RosterRecord>()

  upsert(entry: DirectoryEntry, now: number): void {
    this.records.set(entry.roomCode, { ...entry, lastSeen: now })
  }

  heartbeat(roomCode: string, players: number, status: ServerStatus, now: number): void {
    const rec = this.records.get(roomCode)
    if (!rec) return
    rec.players = players
    rec.status = status
    rec.lastSeen = now
  }

  remove(roomCode: string): void {
    this.records.delete(roomCode)
  }

  expire(ttlMs: number, now: number): void {
    for (const [code, rec] of this.records) {
      if (now - rec.lastSeen > ttlMs) this.records.delete(code)
    }
  }

  list(): DirectoryEntry[] {
    return [...this.records.values()].map(({ lastSeen: _lastSeen, ...entry }) => entry)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/DirectoryRoster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/net/DirectoryRoster.ts src/net/__tests__/DirectoryRoster.test.ts
git commit -m "feat(net): DirectoryRoster with TTL expiry"
```

---

## Task 4: DirectoryServer + DirectoryClient

**Files:**
- Create: `src/net/DirectoryServer.ts`
- Create: `src/net/DirectoryClient.ts`
- Test: `src/net/__tests__/Directory.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/net/__tests__/Directory.test.ts
import { describe, it, expect } from 'vitest'
import { createLinkedChannels } from '../Channel'
import { DirectoryServer } from '../DirectoryServer'
import { DirectoryClient } from '../DirectoryClient'
import type { DirMessage, DirectoryEntry } from '../directoryProtocol'

const entry = (roomCode: string): DirectoryEntry => ({
  roomCode, hostName: 'Alice', players: 1, maxPlayers: 8, status: 'lobby',
})

/** Wire a fresh client to the given server over a linked channel pair. */
function connect(server: DirectoryServer): DirectoryClient {
  const [srv, cli] = createLinkedChannels<DirMessage>()
  server.accept(srv)
  return new DirectoryClient(cli)
}

describe('DirectoryServer + DirectoryClient', () => {
  it('a registered host appears in another client fetchList', async () => {
    const server = new DirectoryServer()
    connect(server).register(entry('ROOM1'))
    const entries = await connect(server).fetchList()
    expect(entries).toEqual([entry('ROOM1')])
  })

  it('heartbeat updates players/status seen by a fetch', async () => {
    const server = new DirectoryServer()
    const host = connect(server)
    host.register(entry('ROOM1'))
    host.heartbeat('ROOM1', 4, 'in-progress')
    const entries = await connect(server).fetchList()
    expect(entries[0]).toMatchObject({ players: 4, status: 'in-progress' })
  })

  it('unregister removes the entry', async () => {
    const server = new DirectoryServer()
    const host = connect(server)
    host.register(entry('ROOM1'))
    host.unregister('ROOM1')
    expect(await connect(server).fetchList()).toEqual([])
  })

  it('entries older than the TTL are expired on list', async () => {
    let clock = 0
    const server = new DirectoryServer(() => clock)
    connect(server).register(entry('ROOM1'))
    clock = 20_000 // past ENTRY_TTL_MS (15s)
    expect(await connect(server).fetchList()).toEqual([])
  })

  it('fetchList resolves [] if no response arrives before timeout', async () => {
    const dead = createLinkedChannels<DirMessage>()[1] // nothing accepts the other end
    const entries = await new DirectoryClient(dead).fetchList(10)
    expect(entries).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/Directory.test.ts`
Expected: FAIL — cannot find module `../DirectoryServer`.

- [ ] **Step 3: Write the implementations**

```ts
// src/net/DirectoryServer.ts
import { DirectoryRoster } from './DirectoryRoster'
import { ENTRY_TTL_MS, type DirMessage } from './directoryProtocol'
import type { Channel } from './Channel'

/** The elected directory. Holds one roster shared across all accepted channels. */
export class DirectoryServer {
  private roster = new DirectoryRoster()
  constructor(private now: () => number = () => Date.now()) {}

  /** Begin serving one connection (a host registering, or a browser listing). */
  accept(channel: Channel<DirMessage>): void {
    channel.onMessage((msg) => {
      const t = this.now()
      switch (msg.type) {
        case 'register': this.roster.upsert(msg.entry, t); break
        case 'heartbeat': this.roster.heartbeat(msg.roomCode, msg.players, msg.status, t); break
        case 'unregister': this.roster.remove(msg.roomCode); break
        case 'listRequest':
          this.roster.expire(ENTRY_TTL_MS, t)
          channel.send({ type: 'listResponse', entries: this.roster.list() })
          break
      }
    })
  }
}
```

```ts
// src/net/DirectoryClient.ts
import type { Channel } from './Channel'
import type { DirMessage, DirectoryEntry, ServerStatus } from './directoryProtocol'

/** Client side of the directory channel: a host announcing, or a browser listing. */
export class DirectoryClient {
  constructor(private channel: Channel<DirMessage>) {}

  register(entry: DirectoryEntry): void {
    this.channel.send({ type: 'register', entry })
  }

  heartbeat(roomCode: string, players: number, status: ServerStatus): void {
    this.channel.send({ type: 'heartbeat', roomCode, players, status })
  }

  unregister(roomCode: string): void {
    this.channel.send({ type: 'unregister', roomCode })
  }

  /** Request the roster; resolves [] if no response arrives within timeoutMs. */
  fetchList(timeoutMs = 3000): Promise<DirectoryEntry[]> {
    return new Promise((resolve) => {
      let settled = false
      const done = (entries: DirectoryEntry[]) => { if (!settled) { settled = true; resolve(entries) } }
      const timer = setTimeout(() => done([]), timeoutMs)
      this.channel.onMessage((msg) => {
        if (msg.type === 'listResponse') { clearTimeout(timer); done(msg.entries) }
      })
      this.channel.send({ type: 'listRequest' })
    })
  }

  onClose(cb: () => void): void { this.channel.onClose(cb) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/Directory.test.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/net/DirectoryServer.ts src/net/DirectoryClient.ts src/net/__tests__/Directory.test.ts
git commit -m "feat(net): DirectoryServer and DirectoryClient over Channel"
```

---

## Task 5: PeerJS directory adapters (election + dial)

**Files:**
- Create: `src/net/directoryPeer.ts`
- Test: `src/net/__tests__/directoryPeer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/net/__tests__/directoryPeer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const handlers: Record<string, ((arg: unknown) => void)[]> = {}
const fakePeer = {
  id: 'browser-shooter-directory-v1',
  on: (event: string, cb: (arg: unknown) => void) => { (handlers[event] ??= []).push(cb) },
  destroy: vi.fn(),
  connect: vi.fn(),
}
vi.mock('peerjs', () => ({ default: vi.fn(() => fakePeer) }))

import { tryBecomeDirectory } from '../directoryPeer'

beforeEach(() => { for (const k of Object.keys(handlers)) delete handlers[k] })

describe('tryBecomeDirectory', () => {
  it('resolves a server + peer when the peer opens (we own the id)', async () => {
    const p = tryBecomeDirectory()
    handlers['open']?.forEach(h => h('browser-shooter-directory-v1'))
    const result = await p
    expect(result.server).not.toBeNull()
    expect(result.peer).not.toBeNull()
  })

  it('resolves null server when the id is unavailable (someone else owns it)', async () => {
    const p = tryBecomeDirectory()
    handlers['error']?.forEach(h => h({ type: 'unavailable-id' }))
    const result = await p
    expect(result.server).toBeNull()
    expect(result.peer).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/directoryPeer.test.ts`
Expected: FAIL — cannot find module `../directoryPeer`.

- [ ] **Step 3: Write the implementation**

```ts
// src/net/directoryPeer.ts
import Peer, { type DataConnection } from 'peerjs'
import { DIRECTORY_PEER_ID, type DirMessage } from './directoryProtocol'
import { DirectoryServer } from './DirectoryServer'
import { DirectoryClient } from './DirectoryClient'
import { PeerChannel } from './Channel'

export interface ElectResult { server: DirectoryServer | null; peer: Peer | null }
export interface DialResult { client: DirectoryClient; peer: Peer }

/** Try to claim the fixed directory id. Win => run a DirectoryServer; lose/err => null. */
export function tryBecomeDirectory(): Promise<ElectResult> {
  return new Promise((resolve) => {
    let settled = false
    const done = (r: ElectResult) => { if (!settled) { settled = true; resolve(r) } }
    const peer = new Peer(DIRECTORY_PEER_ID)
    peer.on('open', () => {
      const server = new DirectoryServer()
      peer.on('connection', (conn: unknown) => {
        const dc = conn as DataConnection
        dc.on('open', () => server.accept(new PeerChannel<DirMessage>(dc)))
      })
      done({ server, peer })
    })
    peer.on('error', () => { peer.destroy(); done({ server: null, peer: null }) })
  })
}

/** Dial the existing directory as a plain peer. Resolves null if it cannot be reached. */
export function dialDirectory(): Promise<DialResult | null> {
  return new Promise((resolve) => {
    let settled = false
    const done = (r: DialResult | null) => { if (!settled) { settled = true; resolve(r) } }
    const peer = new Peer()
    peer.on('open', () => {
      const conn = peer.connect(DIRECTORY_PEER_ID, { reliable: true })
      conn.on('open', () => done({ client: new DirectoryClient(new PeerChannel<DirMessage>(conn)), peer }))
      conn.on('error', () => { peer.destroy(); done(null) })
    })
    peer.on('error', () => { peer.destroy(); done(null) })
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/directoryPeer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/net/directoryPeer.ts src/net/__tests__/directoryPeer.test.ts
git commit -m "feat(net): peerjs election and dial for the directory"
```

---

## Task 6: Pre-join ping probe

**Files:**
- Modify: `src/session/protocol.ts` (add `probe`/`probeAck` to `NetMessage`)
- Create: `src/net/probePing.ts`
- Test: `src/net/__tests__/probePing.test.ts`

- [ ] **Step 1: Add the protocol messages**

In `src/session/protocol.ts`, append two members to the `NetMessage` union (after the existing `pong` line at `src/session/protocol.ts:70`):

```ts
  | { type: 'pong'; t: number }   // client→host reply carrying the original t
  | { type: 'probe'; t: number }     // pre-join latency probe from a browsing client
  | { type: 'probeAck'; t: number }  // host reply echoing t back to the prober
```

(Keep the existing `pong` line; the two new lines go immediately below it.)

- [ ] **Step 2: Write the failing test**

```ts
// src/net/__tests__/probePing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const peerHandlers: Record<string, ((arg: unknown) => void)[]> = {}
const connHandlers: Record<string, ((arg: unknown) => void)[]> = {}
const fakeConn = {
  on: (e: string, cb: (a: unknown) => void) => { (connHandlers[e] ??= []).push(cb) },
  send: vi.fn(),
  close: vi.fn(),
}
const fakePeer = {
  on: (e: string, cb: (a: unknown) => void) => { (peerHandlers[e] ??= []).push(cb) },
  connect: vi.fn(() => fakeConn),
  destroy: vi.fn(),
}
vi.mock('peerjs', () => ({ default: vi.fn(() => fakePeer) }))

import { measurePing } from '../probePing'

beforeEach(() => {
  for (const k of Object.keys(peerHandlers)) delete peerHandlers[k]
  for (const k of Object.keys(connHandlers)) delete connHandlers[k]
  fakeConn.send.mockClear()
})

describe('measurePing', () => {
  it('sends a probe and resolves a non-negative RTT on probeAck', async () => {
    const p = measurePing('ROOM1')
    peerHandlers['open']?.forEach(h => h(undefined))
    connHandlers['open']?.forEach(h => h(undefined))
    expect(fakeConn.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'probe' }))
    const sent = fakeConn.send.mock.calls[0][0] as { t: number }
    connHandlers['data']?.forEach(h => h({ type: 'probeAck', t: sent.t }))
    await expect(p).resolves.toBeGreaterThanOrEqual(0)
  })

  it('resolves null when the timeout elapses with no reply', async () => {
    const p = measurePing('ROOM1', 5)
    peerHandlers['open']?.forEach(h => h(undefined))
    await expect(p).resolves.toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/probePing.test.ts`
Expected: FAIL — cannot find module `../probePing`.

- [ ] **Step 4: Write the implementation**

```ts
// src/net/probePing.ts
import Peer, { type DataConnection } from 'peerjs'
import type { NetMessage } from '../session/protocol'

/**
 * Open a throwaway connection to a host's game peer, time one probe round-trip,
 * then tear down. Resolves the RTT in ms, or null on timeout/error.
 */
export function measurePing(roomCode: string, timeoutMs = 3000): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false
    const peer = new Peer()
    const finish = (v: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      peer.destroy()
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    peer.on('open', () => {
      const conn = peer.connect(roomCode, { reliable: true }) as DataConnection
      conn.on('open', () => {
        const t = performance.now()
        conn.send({ type: 'probe', t } satisfies NetMessage)
      })
      conn.on('data', (d: unknown) => {
        const msg = d as NetMessage
        if (msg.type === 'probeAck') finish(Math.round(performance.now() - msg.t))
      })
      conn.on('error', () => finish(null))
    })
    peer.on('error', () => finish(null))
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/probePing.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/session/protocol.ts src/net/probePing.ts src/net/__tests__/probePing.test.ts
git commit -m "feat(net): pre-join ping probe (probe/probeAck)"
```

---

## Task 7: HostDirectory orchestration

**Files:**
- Create: `src/net/HostDirectory.ts`
- Test: `src/net/__tests__/HostDirectory.test.ts`

This class hides election/heartbeat/re-election/cleanup behind a tiny API. Election and
dial are injected so the orchestration is testable without PeerJS.

- [ ] **Step 1: Write the failing test**

```ts
// src/net/__tests__/HostDirectory.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HostDirectory } from '../HostDirectory'
import { DirectoryServer } from '../DirectoryServer'
import { DirectoryClient } from '../DirectoryClient'
import { createLinkedChannels } from '../Channel'
import { HEARTBEAT_MS, type DirMessage, type DirectoryEntry } from '../directoryProtocol'

const entry: DirectoryEntry = { roomCode: 'ROOM1', hostName: 'Alice', players: 1, maxPlayers: 8, status: 'lobby' }

/** A shared server plus a factory that wires fresh clients to it over linked channels. */
function harness() {
  const server = new DirectoryServer()
  const connect = () => {
    const [srv, cli] = createLinkedChannels<DirMessage>()
    server.accept(srv)
    return new DirectoryClient(cli)
  }
  return { server, connect }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('HostDirectory', () => {
  it('registers the entry on start (non-elected path dials the directory)', async () => {
    const { connect } = harness()
    const elect = vi.fn().mockResolvedValue({ server: null, peer: null })
    const dial = vi.fn().mockResolvedValue({ client: connect(), peer: null })
    const hd = new HostDirectory(elect, dial)
    await hd.start(entry)
    expect(await connect().fetchList()).toEqual([entry])
  })

  it('heartbeats updated players/status on the interval', async () => {
    const { connect } = harness()
    const hd = new HostDirectory(
      vi.fn().mockResolvedValue({ server: null, peer: null }),
      vi.fn().mockResolvedValue({ client: connect(), peer: null }),
    )
    await hd.start({ ...entry })
    hd.setPlayers(3)
    hd.setStatus('in-progress')
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    expect((await connect().fetchList())[0]).toMatchObject({ players: 3, status: 'in-progress' })
  })

  it('stop() unregisters the entry', async () => {
    const { connect } = harness()
    const hd = new HostDirectory(
      vi.fn().mockResolvedValue({ server: null, peer: null }),
      vi.fn().mockResolvedValue({ client: connect(), peer: null }),
    )
    await hd.start({ ...entry })
    hd.stop()
    expect(await connect().fetchList()).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/HostDirectory.test.ts`
Expected: FAIL — cannot find module `../HostDirectory`.

- [ ] **Step 3: Write the implementation**

```ts
// src/net/HostDirectory.ts
import type Peer from 'peerjs'
import { DirectoryClient } from './DirectoryClient'
import { createLinkedChannels } from './Channel'
import { tryBecomeDirectory, dialDirectory, type ElectResult, type DialResult } from './directoryPeer'
import { HEARTBEAT_MS, type DirMessage, type DirectoryEntry, type ServerStatus } from './directoryProtocol'

type ElectFn = () => Promise<ElectResult>
type DialFn = () => Promise<DialResult | null>

/**
 * Keeps this host listed in the directory: claims the directory if it can,
 * otherwise dials the existing one; registers, heartbeats, re-elects on drop,
 * and unregisters on stop. PeerJS bits are injected for testing.
 */
export class HostDirectory {
  private ownedPeer: Peer | null = null   // directory peer we own (elected)
  private dialPeer: Peer | null = null    // peer used to dial someone else's directory
  private client: DirectoryClient | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private entry: DirectoryEntry | null = null
  private stopped = false

  constructor(private elect: ElectFn = tryBecomeDirectory, private dial: DialFn = dialDirectory) {}

  async start(entry: DirectoryEntry): Promise<void> {
    this.entry = entry
    await this.connect()
    this.client?.register(entry)
    this.timer = setInterval(() => {
      if (this.entry) this.client?.heartbeat(this.entry.roomCode, this.entry.players, this.entry.status)
    }, HEARTBEAT_MS)
  }

  setPlayers(n: number): void { if (this.entry) this.entry.players = n }
  setStatus(s: ServerStatus): void { if (this.entry) this.entry.status = s }

  stop(): void {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.entry) this.client?.unregister(this.entry.roomCode)
    this.ownedPeer?.destroy(); this.ownedPeer = null
    this.dialPeer?.destroy(); this.dialPeer = null
    this.client = null
  }

  private async connect(): Promise<void> {
    const election = await this.elect()
    if (election.server) {
      this.ownedPeer = election.peer
      const [srv, cli] = createLinkedChannels<DirMessage>()
      election.server.accept(srv)
      this.client = new DirectoryClient(cli)
    } else {
      const dialed = await this.dial()
      if (dialed) {
        this.dialPeer = dialed.peer
        this.client = dialed.client
        this.client.onClose(() => { if (!this.stopped) void this.reElect() })
      }
    }
  }

  private async reElect(): Promise<void> {
    this.dialPeer?.destroy(); this.dialPeer = null
    this.client = null
    await this.connect()
    if (this.entry) this.client?.register(this.entry)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/HostDirectory.test.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/net/HostDirectory.ts src/net/__tests__/HostDirectory.test.ts
git commit -m "feat(net): HostDirectory orchestration (elect/register/heartbeat/cleanup)"
```

---

## Task 8: ServerList UI component

**Files:**
- Create: `src/ui/ServerList.tsx`
- Test: `src/ui/__tests__/ServerList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/__tests__/ServerList.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ServerList, type ServerRow } from '../ServerList'

const row: ServerRow = {
  roomCode: 'ROOM1', hostName: 'Alice', players: 2, maxPlayers: 8, status: 'lobby', ping: 42,
}

describe('ServerList', () => {
  it('renders a row with host, players, status and ping, and joins on click', () => {
    const onJoin = vi.fn()
    render(<ServerList servers={[row]} onJoin={onJoin} onRefresh={vi.fn()} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('2/8')).toBeInTheDocument()
    expect(screen.getByText(/lobby/i)).toBeInTheDocument()
    expect(screen.getByText('42 ms')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    expect(onJoin).toHaveBeenCalledWith('ROOM1')
  })

  it('shows a dash when ping is unknown', () => {
    render(<ServerList servers={[{ ...row, ping: null }]} onJoin={vi.fn()} onRefresh={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows an empty state and a working refresh button when there are no servers', () => {
    const onRefresh = vi.fn()
    render(<ServerList servers={[]} onJoin={vi.fn()} onRefresh={onRefresh} />)
    expect(screen.getByText(/no games found/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/ServerList.test.tsx`
Expected: FAIL — cannot find module `../ServerList`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/ui/ServerList.tsx
import React from 'react'
import type { DirectoryEntry } from '../net/directoryProtocol'

export interface ServerRow extends DirectoryEntry {
  ping: number | null
}

interface ServerListProps {
  servers: ServerRow[]
  onJoin: (roomCode: string) => void
  onRefresh: () => void
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px',
  background: 'rgba(255,255,255,0.06)', borderRadius: 6, width: 460,
}
const cell: React.CSSProperties = { fontSize: 14 }
const joinBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '6px 16px', background: '#3399ff', color: 'white',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold',
}
const refreshBtn: React.CSSProperties = {
  padding: '6px 16px', background: '#555', color: 'white', border: 'none',
  borderRadius: 6, cursor: 'pointer',
}

export const ServerList: React.FC<ServerListProps> = ({ servers, onJoin, onRefresh }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 460 }}>
      <strong>Games</strong>
      <button style={{ ...refreshBtn, marginLeft: 'auto' }} onClick={onRefresh}>Refresh</button>
    </div>
    {servers.length === 0
      ? <div style={{ opacity: 0.6, padding: 12 }}>No games found</div>
      : servers.map((s) => (
        <div key={s.roomCode} style={rowStyle}>
          <span style={{ ...cell, minWidth: 120 }}>{s.hostName}</span>
          <span style={cell}>{s.players}/{s.maxPlayers}</span>
          <span style={{ ...cell, opacity: 0.8 }}>{s.status === 'lobby' ? 'Lobby' : 'In progress'}</span>
          <span style={{ ...cell, opacity: 0.8 }}>{s.ping === null ? '—' : `${s.ping} ms`}</span>
          <button style={joinBtn} onClick={() => onJoin(s.roomCode)}>Join</button>
        </div>
      ))}
  </div>
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/ServerList.test.tsx`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/ServerList.tsx src/ui/__tests__/ServerList.test.tsx
git commit -m "feat(ui): ServerList component"
```

---

## Task 9: Wire ServerList into MultiplayerMenu

**Files:**
- Modify: `src/ui/MultiplayerMenu.tsx`
- Modify: `src/ui/__tests__/MultiplayerMenu.test.tsx`

- [ ] **Step 1: Update the existing test and add a server-list case**

Replace the contents of `src/ui/__tests__/MultiplayerMenu.test.tsx` with:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MultiplayerMenu } from '../MultiplayerMenu'
import type { ServerRow } from '../ServerList'

const baseProps = {
  roomCode: null as string | null,
  players: [] as string[],
  isHost: false,
  servers: [] as ServerRow[],
  onHost: vi.fn(), onJoin: vi.fn(), onStart: vi.fn(), onBack: vi.fn(), onRefresh: vi.fn(),
}

describe('MultiplayerMenu', () => {
  it('host flow shows the room code + player list in the lobby', () => {
    const onStart = vi.fn()
    render(<MultiplayerMenu {...baseProps} roomCode="ROOM42" players={['You', 'Bob']} isHost onStart={onStart} />)
    expect(screen.getByText('ROOM42')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/start/i))
    expect(onStart).toHaveBeenCalled()
  })

  it('join flow submits an entered code', () => {
    const onJoin = vi.fn()
    render(<MultiplayerMenu {...baseProps} onJoin={onJoin} />)
    fireEvent.change(screen.getByPlaceholderText(/room code/i), { target: { value: 'ABC123' } })
    fireEvent.click(screen.getByText(/^join$/i))
    expect(onJoin).toHaveBeenCalledWith('ABC123')
  })

  it('renders the server list and joins a listed game', () => {
    const onJoin = vi.fn()
    const servers: ServerRow[] = [
      { roomCode: 'ROOM1', hostName: 'Alice', players: 1, maxPlayers: 8, status: 'lobby', ping: 30 },
    ]
    render(<MultiplayerMenu {...baseProps} servers={servers} onJoin={onJoin} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    // With a row rendered there are two "Join" buttons (the row + the manual form);
    // the first one is the row's.
    fireEvent.click(screen.getAllByRole('button', { name: /^join$/i })[0])
    expect(onJoin).toHaveBeenCalledWith('ROOM1')
  })
})
```

Note: both the list rows and the manual form render a button named "Join". The second test
uses an empty list, so only the manual "Join" exists and `getByText(/^join$/i)` is
unambiguous. The third test renders one row, so it uses `getAllByRole(...)[0]` to click the
row's Join button.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/MultiplayerMenu.test.tsx`
Expected: FAIL — `MultiplayerMenu` does not accept `servers`/`onRefresh`; server-list text not found.

- [ ] **Step 3: Update MultiplayerMenu**

Edit `src/ui/MultiplayerMenu.tsx`. Add the import and extend the props interface:

```tsx
import React, { useState } from 'react'
import { ServerList, type ServerRow } from './ServerList'

interface MultiplayerMenuProps {
  roomCode: string | null      // set once hosting; null while choosing/joining
  players: string[]            // lobby roster (names)
  isHost: boolean
  servers: ServerRow[]         // discovered open games
  onHost: () => void           // start hosting (creates the room)
  onJoin: (code: string) => void
  onStart: () => void          // host begins the match
  onBack: () => void
  onRefresh: () => void        // re-query the directory
}
```

Replace the non-lobby `return` block (the final `return (...)` that renders "Multiplayer (Co-op)")
with a version that shows the list above the manual join:

```tsx
  return (
    <div style={panel}>
      <h2>Multiplayer (Co-op)</h2>
      <button style={btn} onClick={p.onHost}>Host Game</button>
      <ServerList servers={p.servers} onJoin={p.onJoin} onRefresh={p.onRefresh} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input placeholder="Room code" value={code} onChange={(e) => setCode(e.target.value)}
          style={{ padding: 10, fontSize: 16 }} />
        <button style={btn} onClick={() => onJoinClick()}>Join</button>
      </div>
      <button style={{ ...btn, background: '#555' }} onClick={p.onBack}>Back</button>
    </div>
  )

  function onJoinClick() { if (code.trim()) p.onJoin(code.trim()) }
```

Leave the `inLobby` branch unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/MultiplayerMenu.test.tsx`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/MultiplayerMenu.tsx src/ui/__tests__/MultiplayerMenu.test.tsx
git commit -m "feat(ui): show ServerList in the multiplayer menu"
```

---

## Task 10: Wire directory into App

**Files:**
- Modify: `src/App.tsx`

No new unit test — this is integration/glue covered by manual verification and Task 11's e2e.
After editing, the full suite and the type build must stay green.

- [ ] **Step 1: Add imports**

In `src/App.tsx`, alongside the other `./net/...` imports (near `src/App.tsx:16-19`), add:

```tsx
import { HostDirectory } from './net/HostDirectory'
import { dialDirectory } from './net/directoryPeer'
import { measurePing } from './net/probePing'
import type { ServerRow } from './ui/ServerList'
```

- [ ] **Step 2: Add browse state**

Next to the existing multiplayer state (`src/App.tsx:64-66`, the `roomCode`/`lobbyPlayers`/`isHost`
hooks), add:

```tsx
  const [servers, setServers] = useState<ServerRow[]>([])
```

- [ ] **Step 3: Track the HostDirectory on the game-data ref**

In the `gameDataRef` object literal (`src/App.tsx:105`), add a field next to `peerHost`/`peerClient`:

```tsx
    hostDirectory: null as HostDirectory | null,
```

- [ ] **Step 4: Stop the directory in resetNetworking**

In `resetNetworking` (`src/App.tsx:125-128`), add a line to tear down the directory alongside the peers:

```tsx
  const resetNetworking = useCallback(() => {
    const data = gameDataRef.current
    data.hostDirectory?.stop(); data.hostDirectory = null
    data.peerHost?.stop(); data.peerClient?.stop()
    data.peerHost = null; data.peerClient = null
```

(Keep the rest of the function body unchanged.)

- [ ] **Step 5: Register + answer probes in hostGame**

In `hostGame` (`src/App.tsx:189-211`), make two changes.

(a) In the `peerHost.onClientConnect` message handler, answer probes and keep the directory's
player count fresh. Replace the existing handler body:

```tsx
    peerHost.onClientConnect((transport) => {
      transport.onMessage((msg) => {
        if (msg.type === 'join') {
          const id = 'player-' + (data.nextClientNum++)
          netHost.addClient(id, msg.name, transport)
          setLobbyPlayers((prev) => {
            const next = [...prev, msg.name]
            data.hostDirectory?.setPlayers(next.length)
            return next
          })
        } else if (msg.type === 'probe') {
          transport.send({ type: 'probeAck', t: msg.t })
        }
      })
    })
```

(b) After `const code = await peerHost.start(); setRoomCode(code)`, start the directory listing:

```tsx
    const code = await peerHost.start()
    setRoomCode(code)
    const hostDirectory = new HostDirectory()
    data.hostDirectory = hostDirectory
    await hostDirectory.start({
      roomCode: code,
      hostName: settingsRef.current.playerName,
      players: 1,
      maxPlayers: 8,
      status: 'lobby',
    })
```

- [ ] **Step 6: Flip status to in-progress when the host starts the match**

`startNetGame` is invoked for the host via the menu's `onStart`. In the mpmenu render block
(`src/App.tsx:590-599`), change the `onStart` handler to also update the directory status:

```tsx
          onStart={() => { gameDataRef.current.hostDirectory?.setStatus('in-progress'); startNetGame('host') }}
```

- [ ] **Step 7: Add a refreshServers callback and pass list props to the menu**

Add this callback near `joinGame` (after `src/App.tsx:224`):

```tsx
  const refreshServers = useCallback(async () => {
    const dialed = await dialDirectory()
    if (!dialed) { setServers([]); return }
    const entries = await dialed.client.fetchList()
    dialed.peer.destroy()
    setServers(entries.map((e) => ({ ...e, ping: null })))
    // Measure pings in the background, patching rows as they resolve.
    for (const e of entries) {
      measurePing(e.roomCode).then((ping) => {
        setServers((prev) => prev.map((r) => (r.roomCode === e.roomCode ? { ...r, ping } : r)))
      })
    }
  }, [])
```

Then refresh whenever the multiplayer menu opens. Add this effect after the callbacks:

```tsx
  useEffect(() => {
    if (gameState === 'mpmenu' && roomCode === null) void refreshServers()
  }, [gameState, roomCode, refreshServers])
```

Finally, pass the new props in the `MultiplayerMenu` render (`src/App.tsx:591-599`):

```tsx
        <MultiplayerMenu
          roomCode={roomCode}
          players={lobbyPlayers}
          isHost={isHost}
          servers={servers}
          onHost={hostGame}
          onJoin={joinGame}
          onStart={() => { gameDataRef.current.hostDirectory?.setStatus('in-progress'); startNetGame('host') }}
          onBack={leaveMultiplayer}
          onRefresh={refreshServers}
        />
```

- [ ] **Step 8: Verify the build and full unit suite**

Run: `npm run build`
Expected: tsc + vite build succeed with no type errors.

Run: `npm run test`
Expected: PASS — all existing and new unit/component tests green.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): list, host-register, and probe-answer wiring for the server list"
```

---

## Task 11: End-to-end — host appears in the list and is joinable

**Files:**
- Modify: `e2e/multiplayer.spec.ts`

- [ ] **Step 1: Add the new e2e test**

Append this test to `e2e/multiplayer.spec.ts` (after the existing test, before the trailing
manual-verification comment block):

```ts
test('a hosted game appears in another player\'s server list and is joinable', async ({ browser }) => {
  test.setTimeout(60_000)
  const hostCtx = await browser.newContext()
  const joinCtx = await browser.newContext()
  const host = await hostCtx.newPage()
  const join = await joinCtx.newPage()

  await host.goto('/')
  await host.getByText(/multiplayer/i).click({ force: true })
  await host.getByText(/host game/i).click({ force: true })

  // Wait for the room code; if the broker never opens, skip.
  const codeLocator = host.locator('strong').first()
  try {
    await expect(codeLocator).toBeVisible({ timeout: 15_000 })
  } catch {
    test.skip(true, 'PeerJS broker unreachable in this environment')
  }

  // Second player opens multiplayer and refreshes the list until the host shows up.
  await join.goto('/')
  await join.getByText(/multiplayer/i).click({ force: true })
  const aliceRow = join.getByText('Player') // default playerName; see note below
  await expect(async () => {
    await join.getByRole('button', { name: /refresh/i }).click({ force: true })
    await expect(join.getByRole('button', { name: /^join$/i }).first()).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 30_000 })

  // Join the listed game from the row's Join button.
  await join.getByRole('button', { name: /^join$/i }).first().click({ force: true })

  await host.getByText(/start/i).click({ force: true })
  await expect(host.locator('canvas')).toBeVisible()
  await expect(join.locator('canvas')).toBeVisible()

  await hostCtx.close()
  await joinCtx.close()
})
```

Note on the host name: the row shows `settings.playerName`. If the default differs from
`'Player'`, adjust the `aliceRow` locator (or drop that line — the test only relies on the
Join button appearing). Confirm the default by checking `loadSettings()` in
`src/settings/Settings.ts` before running.

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e -- multiplayer`
Expected: PASS, or SKIPPED if the PeerJS broker is unreachable in this environment (same
graceful-skip behavior as the existing multiplayer test).

- [ ] **Step 3: Commit**

```bash
git add e2e/multiplayer.spec.ts
git commit -m "test(e2e): host appears in the server list and is joinable"
```

---

## Final verification

- [ ] Run the whole unit suite: `npm run test` — all green.
- [ ] Type-check + build: `npm run build` — no errors.
- [ ] Lint: `npm run lint` — no new violations.
- [ ] Manual smoke (two `npm run dev` tabs):
  1. Tab A: Multiplayer → Host Game → room code appears.
  2. Tab B: Multiplayer → the list shows Tab A's game with host name, players, status, and a ping (or `—`).
  3. Tab B: click the row's Join → lobby joins; Tab A shows the second player.
  4. Tab A: Start → both tabs enter the arena; the list row would now read "In progress".
  5. Close Tab A → within ~15s the entry disappears from a refreshed Tab B list.
