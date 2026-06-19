# Free Games, Passwords, and Disconnect Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `lobby`/`free` join policy with optional password to multiplayer game creation, let players drop into free games already in progress, and handle peer disconnects on both host and client sides.

**Architecture:** A new `joinPolicy` + `password` on `MatchConfig` drive room creation. The directory advertises public flags only (`joinPolicy`, `protected`) — never the password, which the host validates locally on each `join`. The host sends a targeted `start` to clients who join a free game already in progress. A new `onClose` hook on the `Transport` interface propagates peerjs `close` events so the host removes dropped clients and clients of a dropped host return to the menu.

**Tech Stack:** TypeScript, React, Three.js, peerjs (WebRTC), Vitest (unit), Playwright (e2e).

## Global Constraints

- Passwords MUST NOT appear in any `DirectoryEntry` or directory message — the directory runs on a world-readable public PeerJS broker. Only the boolean `protected` flag is public.
- `joinPolicy` defaults to `'lobby'` everywhere; omitting it preserves current behavior exactly.
- Passwords are only meaningful for `joinPolicy === 'free'`. A blank/undefined password means "open".
- No reconnect, no grace period, no host migration. A dropped peer is gone.
- Run unit tests with `npx vitest run <path>`. Run typecheck/build with `npm run build`.

---

### Task 1: Add `onClose` to the Transport interface

**Files:**
- Modify: `src/session/Transport.ts`
- Test: `src/session/__tests__/Transport.test.ts`

**Interfaces:**
- Produces: `Transport.onClose(cb: () => void): void`; `LoopbackTransport.close()` and the linked-transport pair fire registered close callbacks.

- [ ] **Step 1: Write the failing test**

Append to `src/session/__tests__/Transport.test.ts` (create the file if absent, importing what the existing tests import):

```ts
import { describe, it, expect, vi } from 'vitest'
import { LoopbackTransport, createLinkedTransports } from '../Transport'

describe('Transport onClose', () => {
  it('LoopbackTransport fires onClose callbacks when close() is called', () => {
    const t = new LoopbackTransport()
    const cb = vi.fn()
    t.onClose(cb)
    t.close()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('linked transports notify their own close listeners when closed', () => {
    const [a, b] = createLinkedTransports()
    const aClosed = vi.fn(); const bClosed = vi.fn()
    a.onClose(aClosed); b.onClose(bClosed)
    a.close!()
    expect(aClosed).toHaveBeenCalledTimes(1)
    expect(bClosed).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/Transport.test.ts`
Expected: FAIL — `onClose` / `close` not a function.

- [ ] **Step 3: Implement**

Edit `src/session/Transport.ts`. Add `onClose` (and an optional `close`) to the interface and implementations:

```ts
export interface Transport {
  send(msg: NetMessage): void
  onMessage(cb: (msg: NetMessage) => void): void
  onClose(cb: () => void): void
  /** Optional: invoked locally to simulate/trigger a close (test + loopback use). */
  close?(): void
}
```

In `LoopbackTransport`, add a close-handler list and methods:

```ts
export class LoopbackTransport implements Transport {
  private handlers: ((msg: NetMessage) => void)[] = []
  private closeHandlers: (() => void)[] = []

  send(msg: NetMessage): void {
    for (const h of this.handlers) h(msg)
  }

  onMessage(cb: (msg: NetMessage) => void): void {
    this.handlers.push(cb)
  }

  onClose(cb: () => void): void {
    this.closeHandlers.push(cb)
  }

  close(): void {
    for (const h of this.closeHandlers) h()
  }
}
```

In `createLinkedTransports`, give each endpoint close handlers and cross-wire `close()` to fire both sides:

```ts
export function createLinkedTransports(): [Transport, Transport] {
  const aHandlers: ((msg: NetMessage) => void)[] = []
  const bHandlers: ((msg: NetMessage) => void)[] = []
  const aClose: (() => void)[] = []
  const bClose: (() => void)[] = []
  const fireClose = () => { aClose.forEach(h => h()); bClose.forEach(h => h()) }
  const a: Transport = {
    send: (msg) => bHandlers.forEach(h => h(msg)),
    onMessage: (cb) => { aHandlers.push(cb) },
    onClose: (cb) => { aClose.push(cb) },
    close: fireClose,
  }
  const b: Transport = {
    send: (msg) => aHandlers.forEach(h => h(msg)),
    onMessage: (cb) => { bHandlers.push(cb) },
    onClose: (cb) => { bClose.push(cb) },
    close: fireClose,
  }
  return [a, b]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/Transport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session/Transport.ts src/session/__tests__/Transport.test.ts
git commit -m "feat(net): add onClose to Transport interface"
```

---

### Task 2: Wire peerjs `close` into PeerConnection

**Files:**
- Modify: `src/net/PeerConnection.ts`
- Test: `src/net/__tests__/PeerConnection.test.ts`

**Interfaces:**
- Consumes: `Transport.onClose` (Task 1).
- Produces: `PeerConnection.onClose(cb)` fires when the underlying `DataConnection` emits `'close'`.

- [ ] **Step 1: Write the failing test**

The existing `fakeConn()` only stores `'data'` handlers. Replace it and add a test in `src/net/__tests__/PeerConnection.test.ts`:

```ts
function fakeConn() {
  const handlers: Record<string, ((d: unknown) => void)[]> = {}
  return {
    send: vi.fn(),
    on: (event: string, cb: (d: unknown) => void) => {
      (handlers[event] ??= []).push(cb)
    },
    emit: (event: string, d?: unknown) => (handlers[event] ?? []).forEach(h => h(d)),
  }
}
```

Update the two existing tests to use `conn.emit('data', …)` instead of `conn.emitData(…)`, then add:

```ts
it('onClose() fires when conn emits "close"', () => {
  const conn = fakeConn()
  const t = new PeerConnection(conn as any)
  const cb = vi.fn()
  t.onClose(cb)
  conn.emit('close')
  expect(cb).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/PeerConnection.test.ts`
Expected: FAIL — `onClose` not a function.

- [ ] **Step 3: Implement**

Edit `src/net/PeerConnection.ts`:

```ts
import type { DataConnection } from 'peerjs'
import type { Transport } from '../session/Transport'
import type { NetMessage } from '../session/protocol'

/** Adapts a single peerjs DataConnection to the Transport interface. */
export class PeerConnection implements Transport {
  constructor(private conn: DataConnection) {}

  send(msg: NetMessage): void {
    this.conn.send(msg)
  }

  onMessage(cb: (msg: NetMessage) => void): void {
    this.conn.on('data', (data) => cb(data as NetMessage))
  }

  onClose(cb: () => void): void {
    this.conn.on('close', () => cb())
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/PeerConnection.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 5: Commit**

```bash
git add src/net/PeerConnection.ts src/net/__tests__/PeerConnection.test.ts
git commit -m "feat(net): propagate peerjs close events through PeerConnection"
```

---

### Task 3: Add join policy and password to MatchConfig

**Files:**
- Modify: `src/session/MatchConfig.ts`
- Test: `src/session/MatchConfig.test.ts`

**Interfaces:**
- Produces: `JoinPolicy = 'lobby' | 'free'`; `MatchConfig.joinPolicy?: JoinPolicy`; `MatchConfig.password?: string`; both default configs set `joinPolicy: 'lobby'`.

- [ ] **Step 1: Write the failing test**

Append to `src/session/MatchConfig.test.ts`:

```ts
import { defaultMatchConfig, defaultCompetitiveConfig } from './MatchConfig'

describe('join policy defaults', () => {
  it('defaultMatchConfig is lobby with no password', () => {
    const c = defaultMatchConfig()
    expect(c.joinPolicy).toBe('lobby')
    expect(c.password).toBeUndefined()
  })

  it('defaultCompetitiveConfig is lobby', () => {
    expect(defaultCompetitiveConfig().joinPolicy).toBe('lobby')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/MatchConfig.test.ts`
Expected: FAIL — `joinPolicy` is `undefined`, not `'lobby'`.

- [ ] **Step 3: Implement**

Edit `src/session/MatchConfig.ts`. Add the type and fields, and set defaults:

```ts
export type DamagePolicy = 'team' | 'friendly' | 'ffa'
export type JoinPolicy = 'lobby' | 'free'

export interface MatchConfig {
  mode: GameMode
  damagePolicy: DamagePolicy
  fragLimit: number // team score to win; 0 = endless
  roundsToWin?: number
  buyPhaseDuration?: number
  roundDuration?: number
  joinPolicy?: JoinPolicy   // 'lobby' (default) | 'free'
  password?: string         // only meaningful when joinPolicy === 'free'; blank/undefined = open
}

export function defaultMatchConfig(): MatchConfig {
  return { mode: 'coop', damagePolicy: 'team', fragLimit: 30, joinPolicy: 'lobby' }
}

export function defaultCompetitiveConfig(): MatchConfig {
  return {
    mode: 'competitive',
    damagePolicy: 'team',
    fragLimit: 0,
    roundsToWin: 16,
    buyPhaseDuration: 15,
    roundDuration: 115,
    joinPolicy: 'lobby',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/MatchConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session/MatchConfig.ts src/session/MatchConfig.test.ts
git commit -m "feat(session): add joinPolicy and password to MatchConfig"
```

---

### Task 4: Carry join policy and protected flag through the directory

**Files:**
- Modify: `src/net/directoryProtocol.ts`
- Test: `src/net/__tests__/DirectoryRoster.test.ts` (create if absent)

**Interfaces:**
- Consumes: `JoinPolicy` (Task 3).
- Produces: `DirectoryEntry.joinPolicy?: JoinPolicy`, `DirectoryEntry.protected?: boolean`, both surviving `DirectoryRoster.upsert` → `list`.

- [ ] **Step 1: Write the failing test**

Create `src/net/__tests__/DirectoryRoster.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DirectoryRoster } from '../DirectoryRoster'
import type { DirectoryEntry } from '../directoryProtocol'

const entry = (over: Partial<DirectoryEntry> = {}): DirectoryEntry => ({
  roomCode: 'ROOM1', hostName: 'Ann', players: 1, maxPlayers: 8,
  status: 'lobby', mode: 'pvp', ...over,
})

describe('DirectoryRoster join-policy fields', () => {
  it('preserves joinPolicy and protected through upsert -> list', () => {
    const r = new DirectoryRoster()
    r.upsert(entry({ joinPolicy: 'free', protected: true }), 1000)
    const [e] = r.list()
    expect(e.joinPolicy).toBe('free')
    expect(e.protected).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/DirectoryRoster.test.ts`
Expected: FAIL — `DirectoryEntry` has no `joinPolicy` / `protected` (TS compile error in the test).

- [ ] **Step 3: Implement**

Edit `src/net/directoryProtocol.ts`. Import/declare the policy type and extend the entry:

```ts
export type ServerStatus = 'lobby' | 'in-progress'
export type JoinPolicy = 'lobby' | 'free'

export interface DirectoryEntry {
  roomCode: string
  hostName: string
  players: number
  maxPlayers: number
  status: ServerStatus
  mode?: string
  joinPolicy?: JoinPolicy   // 'lobby' (default) | 'free'
  protected?: boolean       // true when a free game has a non-empty password
}
```

No change is needed in `DirectoryRoster` — `upsert` spreads the whole entry and `list` strips only `lastSeen`, so the new fields ride along automatically. (The test in Step 1 confirms this.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/DirectoryRoster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/net/directoryProtocol.ts src/net/__tests__/DirectoryRoster.test.ts
git commit -m "feat(net): advertise joinPolicy and protected flag in directory entries"
```

---

### Task 5: Extend the game protocol (password, started, joinRejected)

**Files:**
- Modify: `src/session/protocol.ts`

**Interfaces:**
- Produces: `join` gains `password?: string`; `welcome` gains `started: boolean`; new `{ type: 'joinRejected'; reason: 'badPassword' | 'full' }`.

This task is a pure type change consumed by Tasks 6 and 7; it has no standalone behavior test. Verification is the typecheck at the end of Task 6.

- [ ] **Step 1: Edit the protocol**

In `src/session/protocol.ts`, update the `NetMessage` union:

```ts
  | { type: 'join'; name: string; team?: Team; password?: string }
  | { type: 'welcome'; playerId: string; mode: GameMode; config: MatchConfig; players: string[]; started: boolean }
  | { type: 'joinRejected'; reason: 'badPassword' | 'full' }
```

(The first two replace the existing `join` and `welcome` lines; the third is new — add it next to `welcome`.)

- [ ] **Step 2: Commit**

```bash
git add src/session/protocol.ts
git commit -m "feat(net): add password to join, started to welcome, and joinRejected message"
```

---

### Task 6: Password validation, started-aware welcome, and drop-in start in NetHost

**Files:**
- Modify: `src/net/NetHost.ts`
- Test: `src/net/__tests__/NetHost.test.ts`

**Interfaces:**
- Consumes: protocol changes (Task 5), `MatchConfig.joinPolicy`/`password` (Task 3), `Transport.onClose` (Task 1).
- Produces: `NetHost.passwordOk(pw?: string): boolean`; `NetHost.startMatch()` sets an internal `started` flag; `addClient` sends `welcome.started` and, when the match is already started and the game is free, sends a targeted `start` to the new client.

- [ ] **Step 1: Write the failing tests**

Append to `src/net/__tests__/NetHost.test.ts`:

```ts
import { NetHost } from '../NetHost'
import { GameSession } from '../../session/GameSession'
import { createLinkedTransports } from '../../session/Transport'

describe('NetHost join policy', () => {
  it('passwordOk: open game accepts any password', () => {
    const host = new NetHost(new GameSession(), { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'free' })
    expect(host.passwordOk(undefined)).toBe(true)
    expect(host.passwordOk('whatever')).toBe(true)
  })

  it('passwordOk: protected game accepts only the matching password', () => {
    const host = new NetHost(new GameSession(), { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'free', password: 'hunter2' })
    expect(host.passwordOk('hunter2')).toBe(true)
    expect(host.passwordOk('nope')).toBe(false)
    expect(host.passwordOk(undefined)).toBe(false)
  })

  it('welcome reports started=false before startMatch', () => {
    const host = new NetHost(new GameSession(), { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'lobby' })
    const [h, c] = createLinkedTransports()
    const got: NetMessage[] = []; c.onMessage(m => got.push(m))
    host.addClient('player-2', 'Bob', h)
    const w = got.find(m => m.type === 'welcome')
    expect(w && w.type === 'welcome' && w.started).toBe(false)
  })

  it('free game already started sends a targeted start to a late joiner', () => {
    const host = new NetHost(new GameSession(), { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'free' })
    host.startMatch()
    const [h, c] = createLinkedTransports()
    const got: NetMessage[] = []; c.onMessage(m => got.push(m))
    host.addClient('player-3', 'Cara', h)
    expect(got.some(m => m.type === 'start')).toBe(true)
    const w = got.find(m => m.type === 'welcome')
    expect(w && w.type === 'welcome' && w.started).toBe(true)
  })

  it('lobby game already started does NOT auto-start a late joiner', () => {
    const host = new NetHost(new GameSession(), { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'lobby' })
    host.startMatch()
    const [h, c] = createLinkedTransports()
    const got: NetMessage[] = []; c.onMessage(m => got.push(m))
    got.length = 0 // ignore the broadcast start from startMatch (no client linked yet anyway)
    host.addClient('player-4', 'Dee', h)
    expect(got.some(m => m.type === 'start')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/net/__tests__/NetHost.test.ts`
Expected: FAIL — `passwordOk` undefined; `welcome` has no `started`.

- [ ] **Step 3: Implement**

Edit `src/net/NetHost.ts`. Add a `started` flag, set it in `startMatch`, include `started` in `welcome`, send the targeted drop-in `start`, and add `passwordOk`:

```ts
export class NetHost {
  private links: ClientLink[] = []
  private pings = new Map<string, number>()
  private lastSeq = new Map<string, number>()
  private snapSeq = 0
  private started = false

  constructor(private session: GameSession, private config: MatchConfig) {}

  /** True if `pw` may join: open games accept anything; protected games require an exact match. */
  passwordOk(pw?: string): boolean {
    const want = this.config.password
    return !want || want === pw
  }

  addClient(playerId: string, name: string, transport: Transport, team: Team = 'ct'): void {
    this.session.addPlayer(playerId, name, team)
    this.lastSeq.set(playerId, 0)
    transport.onMessage((msg) => {
      // …unchanged input/pong/buy/startWave/setTeam/plantBomb/defuseBomb handling…
    })
    const players = this.links.map(l => this.session.getPlayer(l.playerId)?.name ?? l.playerId)
    transport.send({ type: 'welcome', playerId, mode: this.config.mode, config: this.config, players, started: this.started })
    this.links.push({ playerId, transport })
    this.broadcast({ type: 'playerJoined', playerId, name })
    // Free game already running: drop the new client straight into the live match.
    if (this.started && this.config.joinPolicy === 'free') {
      transport.send({ type: 'start' })
    }
  }

  startMatch(): void {
    this.started = true
    this.broadcast({ type: 'start' })
  }

  // …removeClient, pingClients, tick, broadcastSnapshot, broadcast unchanged…
}
```

(Leave the body of the existing `transport.onMessage` handler exactly as it is — only the surrounding additions above change.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/net/__tests__/NetHost.test.ts`
Expected: PASS (existing tests still pass; `addClient` calls that omit a 4th arg still default `team='ct'`, and existing `welcome` assertions use `objectContaining` so the added `started` field is fine).

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: succeeds (confirms the Task 5 protocol types line up).

- [ ] **Step 6: Commit**

```bash
git add src/net/NetHost.ts src/net/__tests__/NetHost.test.ts
git commit -m "feat(net): validate passwords and drop late joiners into running free games"
```

---

### Task 7: Expose started, joinRejected, and disconnect on NetClient

**Files:**
- Modify: `src/net/NetClient.ts`
- Test: `src/net/__tests__/NetClient.test.ts` (create if absent)

**Interfaces:**
- Consumes: protocol changes (Task 5), `Transport.onClose` (Task 1).
- Produces: `onWelcome(cb: (playerId, mode, players, started: boolean) => void)`; `onJoinRejected(cb: (reason: 'badPassword' | 'full') => void)`; `onDisconnect(cb: () => void)`.

- [ ] **Step 1: Write the failing test**

Create `src/net/__tests__/NetClient.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { NetClient } from '../NetClient'
import { createLinkedTransports } from '../../session/Transport'
import type { MatchConfig } from '../../session/MatchConfig'

const cfg: MatchConfig = { mode: 'pvp', damagePolicy: 'team', fragLimit: 0, joinPolicy: 'free' }

describe('NetClient join-policy hooks', () => {
  it('onWelcome surfaces the started flag', () => {
    const [hostSide, clientSide] = createLinkedTransports()
    const client = new NetClient(clientSide)
    const seen: boolean[] = []
    client.onWelcome((_id, _mode, _players, started) => seen.push(started))
    hostSide.send({ type: 'welcome', playerId: 'player-2', mode: 'pvp', config: cfg, players: [], started: true })
    expect(seen).toEqual([true])
  })

  it('onJoinRejected fires with the reason', () => {
    const [hostSide, clientSide] = createLinkedTransports()
    const client = new NetClient(clientSide)
    const cb = vi.fn()
    client.onJoinRejected(cb)
    hostSide.send({ type: 'joinRejected', reason: 'badPassword' })
    expect(cb).toHaveBeenCalledWith('badPassword')
  })

  it('onDisconnect fires when the transport closes', () => {
    const [hostSide, clientSide] = createLinkedTransports()
    const client = new NetClient(clientSide)
    const cb = vi.fn()
    client.onDisconnect(cb)
    hostSide.close!()
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/NetClient.test.ts`
Expected: FAIL — `onJoinRejected`/`onDisconnect` undefined; `onWelcome` callback gets 3 args.

- [ ] **Step 3: Implement**

Edit `src/net/NetClient.ts`:

1. Update the `welcomeCb` field type and add two new callback fields near the other `private …Cb` declarations:

```ts
  private welcomeCb: ((playerId: string, mode: GameMode, players: string[], started: boolean) => void) | null = null
  private joinRejectedCb: ((reason: 'badPassword' | 'full') => void) | null = null
  private disconnectCb: (() => void) | null = null
```

2. In the constructor, register the close handler after the existing `onMessage` wiring:

```ts
  constructor(public transport: Transport) {
    this.transport.onMessage((msg: NetMessage) => this.handle(msg))
    this.transport.onClose(() => this.disconnectCb?.())
  }
```

3. Update `onWelcome` and add the two new registrars next to the other `on…` methods:

```ts
  onWelcome(cb: (playerId: string, mode: GameMode, players: string[], started: boolean) => void): void { this.welcomeCb = cb }
  onJoinRejected(cb: (reason: 'badPassword' | 'full') => void): void { this.joinRejectedCb = cb }
  onDisconnect(cb: () => void): void { this.disconnectCb = cb }
```

4. In `handle`, pass `started` through and handle `joinRejected`:

```ts
    if (msg.type === 'welcome') {
      this.playerId = msg.playerId
      this.config = msg.config
      this.mode = msg.config.mode
      this.welcomeCb?.(msg.playerId, msg.config.mode, msg.players, msg.started)
    } else if (msg.type === 'joinRejected') {
      this.joinRejectedCb?.(msg.reason)
    } else if (msg.type === 'start') {
```

(The `else if (msg.type === 'start')` line already exists — insert the `joinRejected` branch immediately before it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/NetClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/net/NetClient.ts src/net/__tests__/NetClient.test.ts
git commit -m "feat(net): surface started, joinRejected, and disconnect on NetClient"
```

---

### Task 8: Join-policy selector and password field in MatchSetup

**Files:**
- Modify: `src/ui/MatchSetup.tsx`
- Test: `src/ui/__tests__/MatchSetup.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `JoinPolicy`, `MatchConfig` (Task 3).
- Produces: `onConfirm` receives a `MatchConfig` carrying `joinPolicy` and (for free games) `password`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/MatchSetup.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchSetup } from '../MatchSetup'

describe('MatchSetup join policy', () => {
  it('defaults to lobby and confirms with joinPolicy lobby', () => {
    const onConfirm = vi.fn()
    render(<MatchSetup onConfirm={onConfirm} onBack={vi.fn()} />)
    fireEvent.click(screen.getByText('Create Room'))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ joinPolicy: 'lobby' }))
  })

  it('free + password is passed through on confirm', () => {
    const onConfirm = vi.fn()
    render(<MatchSetup onConfirm={onConfirm} onBack={vi.fn()} />)
    fireEvent.click(screen.getByText('Free'))
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 's3cret' } })
    fireEvent.click(screen.getByText('Create Room'))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ joinPolicy: 'free', password: 's3cret' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/MatchSetup.test.tsx`
Expected: FAIL — no "Free" button / password input.

- [ ] **Step 3: Implement**

Edit `src/ui/MatchSetup.tsx`. Import `JoinPolicy`, add state, render the selector + conditional password input, and include the fields on confirm:

```tsx
import type { MatchConfig, DamagePolicy, JoinPolicy } from '../session/MatchConfig'
```

Add state inside the component (next to the other `useState` calls):

```tsx
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>('lobby')
  const [password, setPassword] = useState('')
```

Add this block just above the Back/Create-Room button row:

```tsx
      <div><div style={{ opacity: 0.6, marginBottom: 6 }}>JOIN POLICY</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn(joinPolicy === 'lobby')} onClick={() => setJoinPolicy('lobby')}>Lobby</button>
          <button style={btn(joinPolicy === 'free')} onClick={() => setJoinPolicy('free')}>Free</button>
        </div>
        {joinPolicy === 'free' && (
          <input
            placeholder="Password (optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 8, padding: 8, fontFamily: 'monospace', fontSize: 14,
              background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55', width: 220 }}
          />
        )}
      </div>
```

Update the Create-Room `onClick` to merge the new fields:

```tsx
        <button style={btn(true)} onClick={() => onConfirm({
          ...(mode === 'competitive'
            ? { ...defaultCompetitiveConfig(), damagePolicy: policy }
            : { mode, damagePolicy: policy, fragLimit: frag }),
          joinPolicy,
          ...(joinPolicy === 'free' && password ? { password } : {}),
        })}>Create Room</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/MatchSetup.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/MatchSetup.tsx src/ui/__tests__/MatchSetup.test.tsx
git commit -m "feat(ui): add join-policy selector and password field to MatchSetup"
```

---

### Task 9: Show lock and policy in the server list; pass the full row to onJoin

**Files:**
- Modify: `src/ui/ServerList.tsx`
- Test: `src/ui/__tests__/ServerList.test.tsx`

**Interfaces:**
- Consumes: `DirectoryEntry.joinPolicy`/`protected` (Task 4).
- Produces: `ServerList` prop `onJoin: (server: ServerRow) => void` (changed from `(roomCode: string)`); rows render a 🔒 for protected games and a `Free`/`Lobby` tag.

- [ ] **Step 1: Write the failing test**

Add to `src/ui/__tests__/ServerList.test.tsx` (and update any existing test that asserts `onJoin` was called with a room-code string — it now receives the row object):

```tsx
it('renders a lock for protected games and Join passes the full row', () => {
  const onJoin = vi.fn()
  const servers = [{
    roomCode: 'ROOM1', hostName: 'Ann', players: 1, maxPlayers: 8,
    status: 'in-progress' as const, mode: 'pvp', joinPolicy: 'free' as const,
    protected: true, ping: 20,
  }]
  render(<ServerList servers={servers} onJoin={onJoin} onRefresh={vi.fn()} />)
  expect(screen.getByText('🔒')).toBeInTheDocument()
  fireEvent.click(screen.getByText('Join'))
  expect(onJoin).toHaveBeenCalledWith(expect.objectContaining({ roomCode: 'ROOM1', joinPolicy: 'free' }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/ServerList.test.tsx`
Expected: FAIL — no 🔒; `onJoin` called with a string.

- [ ] **Step 3: Implement**

Edit `src/ui/ServerList.tsx`. Change the prop type and the row:

```tsx
interface ServerListProps {
  servers: ServerRow[]
  onJoin: (server: ServerRow) => void
  onRefresh: () => void
  filterMode?: string
}
```

In the row markup, add the lock + policy tag and pass the row to `onJoin`:

```tsx
        : filteredServers.map((s) => (
          <div key={s.roomCode} style={rowStyle}>
            <span style={{ ...cell, minWidth: 120 }}>{s.hostName}</span>
            <span style={cell}>{s.mode ?? 'Unknown'}</span>
            <span style={cell}>{s.players}/{s.maxPlayers}</span>
            <span style={{ ...cell, opacity: 0.8 }}>{s.joinPolicy === 'free' ? 'Free' : 'Lobby'}</span>
            {s.protected && <span style={cell} title="Password required">🔒</span>}
            <span style={{ ...cell, opacity: 0.8 }}>{s.status === 'lobby' ? 'Lobby' : 'In progress'}</span>
            <span style={{ ...cell, opacity: 0.8 }}>{s.ping === null ? '—' : `${s.ping} ms`}</span>
            <button style={joinBtn} onClick={() => onJoin(s)}>Join</button>
          </div>
        ))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/ServerList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ServerList.tsx src/ui/__tests__/ServerList.test.tsx
git commit -m "feat(ui): show join policy and lock in the server list"
```

---

### Task 10: Pre-join prompt component (team + password) for free games

**Files:**
- Create: `src/ui/PreJoinPrompt.tsx`
- Test: `src/ui/__tests__/PreJoinPrompt.test.tsx`

**Interfaces:**
- Consumes: `Team` from `../types`.
- Produces: `PreJoinPrompt` with props `{ protected?: boolean; error?: string | null; onSubmit: (team: Team, password: string) => void; onCancel: () => void }`. Renders CT/T buttons, a password input when `protected`, and Join Match / Cancel buttons. Default selected team is `'ct'`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/PreJoinPrompt.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreJoinPrompt } from '../PreJoinPrompt'

describe('PreJoinPrompt', () => {
  it('submits the chosen team and password', () => {
    const onSubmit = vi.fn()
    render(<PreJoinPrompt protected error={null} onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^T$/ }))
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'pw' } })
    fireEvent.click(screen.getByText(/join match/i))
    expect(onSubmit).toHaveBeenCalledWith('t', 'pw')
  })

  it('hides the password field for open games and shows errors', () => {
    render(<PreJoinPrompt error="Wrong password" onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByPlaceholderText(/password/i)).toBeNull()
    expect(screen.getByText('Wrong password')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/PreJoinPrompt.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/ui/PreJoinPrompt.tsx`:

```tsx
import React, { useState } from 'react'
import type { Team } from '../types'

interface PreJoinPromptProps {
  protected?: boolean
  error?: string | null
  onSubmit: (team: Team, password: string) => void
  onCancel: () => void
}

const overlay: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.6)', zIndex: 60,
}
const card: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 14, padding: 24, background: '#11111a',
  border: '1px solid #3a3a55', borderRadius: 10, color: '#fff', fontFamily: 'monospace', minWidth: 280,
}
const teamBtn = (active: boolean, t: Team): React.CSSProperties => ({
  padding: '8px 16px', cursor: 'pointer', color: '#fff', border: '1px solid',
  borderColor: t === 'ct' ? '#3a6ea5' : '#a5703a',
  background: active ? (t === 'ct' ? '#3a6ea5' : '#a5703a') : (t === 'ct' ? '#1d3a5f' : '#5f3a1d'),
})
const actionBtn: React.CSSProperties = {
  padding: '10px 16px', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold',
  background: '#3399ff', color: '#fff', border: 'none', borderRadius: 6,
}

export const PreJoinPrompt: React.FC<PreJoinPromptProps> = ({ protected: isProtected, error, onSubmit, onCancel }) => {
  const [team, setTeam] = useState<Team>('ct')
  const [password, setPassword] = useState('')
  return (
    <div style={overlay}>
      <div style={card}>
        <h3 style={{ margin: 0 }}>Join Match</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={teamBtn(team === 'ct', 'ct')} onClick={() => setTeam('ct')}>CT</button>
          <button style={teamBtn(team === 't', 't')} onClick={() => setTeam('t')}>T</button>
        </div>
        {isProtected && (
          <input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 8, background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55' }} />
        )}
        {error && <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={{ ...actionBtn, background: '#555' }} onClick={onCancel}>Cancel</button>
          <button style={actionBtn} onClick={() => onSubmit(team, password)}>Join Match</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/PreJoinPrompt.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/PreJoinPrompt.tsx src/ui/__tests__/PreJoinPrompt.test.tsx
git commit -m "feat(ui): add pre-join prompt for free games"
```

---

### Task 11: Wire the pre-join prompt into MultiplayerMenu

**Files:**
- Modify: `src/ui/MultiplayerMenu.tsx`
- Test: `src/ui/__tests__/MultiplayerMenu.test.tsx`

**Interfaces:**
- Consumes: `PreJoinPrompt` (Task 10), `ServerList`'s `onJoin(server)` (Task 9), `ServerRow` (Task 9).
- Produces: new props `onJoinFree?: (code: string, team: Team, password: string) => void`, `joinError?: string | null`, `onCancelJoin?: () => void`. Lobby servers still call `onJoin(code)`; free servers open the prompt.

- [ ] **Step 1: Write the failing test**

Add to `src/ui/__tests__/MultiplayerMenu.test.tsx`:

```tsx
it('opens the pre-join prompt for a free server and submits via onJoinFree', () => {
  const onJoinFree = vi.fn()
  const servers = [{
    roomCode: 'FREE1', hostName: 'Ann', players: 1, maxPlayers: 8,
    status: 'in-progress' as const, mode: 'pvp', joinPolicy: 'free' as const, protected: true, ping: 10,
  }]
  render(<MultiplayerMenu {...baseProps} servers={servers} onJoinFree={onJoinFree} />)
  fireEvent.click(screen.getByText('Join'))                 // open prompt
  fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'pw' } })
  fireEvent.click(screen.getByText(/join match/i))
  expect(onJoinFree).toHaveBeenCalledWith('FREE1', 'ct', 'pw')
})

it('joins a lobby server directly via onJoin', () => {
  const onJoin = vi.fn()
  const servers = [{
    roomCode: 'LOB1', hostName: 'Ann', players: 1, maxPlayers: 8,
    status: 'lobby' as const, mode: 'pvp', joinPolicy: 'lobby' as const, ping: 10,
  }]
  render(<MultiplayerMenu {...baseProps} servers={servers} onJoin={onJoin} />)
  fireEvent.click(screen.getByText('Join'))
  expect(onJoin).toHaveBeenCalledWith('LOB1')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/MultiplayerMenu.test.tsx`
Expected: FAIL — clicking a free Join does not open a prompt.

- [ ] **Step 3: Implement**

Edit `src/ui/MultiplayerMenu.tsx`:

1. Imports and props:

```tsx
import { ServerList, type ServerRow } from './ServerList'
import { PreJoinPrompt } from './PreJoinPrompt'
import type { Team } from '../types'
```

Add to `MultiplayerMenuProps`:

```tsx
  onJoinFree?: (code: string, team: Team, password: string) => void
  joinError?: string | null
  onCancelJoin?: () => void
```

2. Add prompt state inside the component:

```tsx
  const [joining, setJoining] = useState<ServerRow | null>(null)
```

3. Change the `ServerList` usage in the non-lobby branch so its `onJoin` receives the row and branches:

```tsx
          <ServerList
            servers={p.servers}
            onJoin={(server) => {
              if (server.joinPolicy === 'free') setJoining(server)
              else p.onJoin(server.roomCode)
            }}
            onRefresh={p.onRefresh}
          />
```

4. Render the prompt at the end of the non-lobby `return` (just before the closing `</div>` of `panel`):

```tsx
        {joining && (
          <PreJoinPrompt
            protected={joining.protected}
            error={p.joinError}
            onSubmit={(team, password) => p.onJoinFree?.(joining.roomCode, team, password)}
            onCancel={() => { setJoining(null); p.onCancelJoin?.() }}
          />
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/MultiplayerMenu.test.tsx`
Expected: PASS (existing tests unaffected — the manual room-code Join still calls `p.onJoin(code)`).

- [ ] **Step 5: Commit**

```bash
git add src/ui/MultiplayerMenu.tsx src/ui/__tests__/MultiplayerMenu.test.tsx
git commit -m "feat(ui): open pre-join prompt for free servers in MultiplayerMenu"
```

---

### Task 12: Host-side wiring in App — creation flags, password gate, drop-in, client-drop cleanup

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `NetHost.passwordOk` + drop-in `start` (Task 6), `Transport.onClose` (Task 1), directory `joinPolicy`/`protected` (Task 4).

App glue is integration code verified by build + e2e (Task 14), not a unit test.

- [ ] **Step 1: Add a started flag and advertise join policy on create**

In `gameDataRef` (the `useRef({…})` object), add a field after `matchConfig`:

```ts
    matchConfig: defaultMatchConfig() as MatchConfig,
    matchStarted: false,
```

In `hostGame`, update the directory registration (currently the `hostDirectory.start({…})` call) to advertise the policy and protected flag, and reset the flag:

```ts
    data.matchStarted = false
    const hostDirectory = new HostDirectory()
    data.hostDirectory = hostDirectory
    await hostDirectory.start({
      roomCode: code, hostName: settingsRef.current.playerName, players: 1, maxPlayers: 8,
      status: 'lobby', mode: config.mode,
      joinPolicy: config.joinPolicy ?? 'lobby',
      protected: !!config.password,
    })
```

- [ ] **Step 2: Gate joins by password and clean up dropped clients**

Replace the `peerHost.onClientConnect((transport) => { … })` block in `hostGame` with one that validates the password, tracks the assigned id, and removes the player on close:

```ts
    peerHost.onClientConnect((transport) => {
      let assignedId: string | null = null
      transport.onMessage((msg) => {
        if (msg.type === 'join') {
          if (!netHost.passwordOk(msg.password)) {
            transport.send({ type: 'joinRejected', reason: 'badPassword' })
            return
          }
          const id = 'player-' + (data.nextClientNum++)
          assignedId = id
          const joinTeam = msg.team === 't' ? 't' : 'ct'
          netHost.addClient(id, msg.name, transport, joinTeam)
          setLobbyPlayers((prev) => {
            const next = [...prev, msg.name]
            data.hostDirectory?.setPlayers(next.length)
            return next
          })
          setRoster((prev) => ({ ...prev, [joinTeam]: [...prev[joinTeam], msg.name] }))
        } else if (msg.type === 'probe') {
          transport.send({ type: 'probeAck', t: msg.t })
        }
      })
      transport.onClose(() => {
        if (!assignedId) return
        const name = data.session.getPlayer(assignedId)?.name
        netHost.removeClient(assignedId)
        setLobbyPlayers((prev) => {
          const next = name ? prev.filter((n) => n !== name) : prev.slice(0, -1)
          data.hostDirectory?.setPlayers(Math.max(1, next.length))
          return next
        })
        if (name) setRoster((prev) => ({
          ct: prev.ct.filter((n) => n !== name),
          t: prev.t.filter((n) => n !== name),
        }))
        assignedId = null
      })
    })
```

- [ ] **Step 3: Set the started flag when the host starts the match**

In the `MultiplayerMenu` `onStart` handler, set the flag before starting:

```ts
          onStart={() => {
            gameDataRef.current.matchStarted = true
            gameDataRef.current.hostDirectory?.setStatus('in-progress')
            gameDataRef.current.netHost?.startMatch()
            startNetGame('host')
          }}
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): advertise join policy, gate joins by password, clean up dropped clients"
```

---

### Task 13: Client-side wiring in App — drop-in join, join errors, host-disconnect notice

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `NetClient.onJoinRejected`/`onDisconnect`/`onWelcome(…, started)` (Task 7), `MultiplayerMenu` props `onJoinFree`/`joinError`/`onCancelJoin` (Task 11).

- [ ] **Step 1: Add join-error and host-notice state**

Near the other `useState` calls (e.g. after `const [roomCode, …]`):

```ts
  const [joinError, setJoinError] = useState<string | null>(null)
  const [hostNotice, setHostNotice] = useState<string | null>(null)
```

- [ ] **Step 2: Accept join options and register client hooks**

Change `joinGame` to accept optional team/password and register the new hooks. Update the signature and the final `join` send:

```ts
  const joinGame = useCallback(async (code: string, opts?: { team?: Team; password?: string }) => {
    const data = gameDataRef.current
    data.role = 'client'
    setIsHost(false)
    setJoinError(null)
    const peerClient = new PeerClient()
    data.peerClient = peerClient
    const transport = await peerClient.connect(code)
    const client = new NetClient(transport)
    data.netClient = client
    // …existing client.onSnapshot / client.onEvent wiring stays unchanged…
```

Update the `client.onWelcome(...)` call to accept the new 4th arg (ignore it; the targeted `start` drives drop-in):

```ts
    client.onWelcome((_, mode, players, _started) => {
      const data = gameDataRef.current
      if (data.netClient?.config) { data.matchConfig = data.netClient.config }
      setRoomCode(code)
      setLobbyPlayers(players)
      setRoster({ ct: players, t: [] })
      void mode; void _started
    })
```

Add the rejection and disconnect handlers next to `client.onStart(...)`:

```ts
    client.onJoinRejected((reason) => {
      setJoinError(reason === 'full' ? 'Game is full' : 'Wrong password')
      data.peerClient?.stop(); data.peerClient = null; data.netClient = null
    })
    client.onDisconnect(() => {
      if (data.role !== 'client') return
      resetNetworking()
      setHostNotice('Host disconnected')
      setRoomCode(null); setLobbyPlayers([]); setIsHost(false)
      updateGameState('mpmenu')
    })
```

Update the final `join` send to carry team + password:

```ts
    client.transport.send({
      type: 'join',
      name: settingsRef.current.playerName,
      team: opts?.team ?? myTeam,
      ...(opts?.password ? { password: opts.password } : {}),
    })
  }, [startNetGame, myTeam, pushKill, resetNetworking, updateGameState])
```

- [ ] **Step 3: Pass the new props to MultiplayerMenu**

Add to the `<MultiplayerMenu …>` element:

```tsx
          onJoinFree={(code, team, password) => joinGame(code, { team, password })}
          joinError={joinError}
          onCancelJoin={() => setJoinError(null)}
```

- [ ] **Step 4: Render the host-disconnect notice**

Add a dismissible banner inside the `mpmenu` block, right after the `<MultiplayerMenu … />` element (within the same `{gameState === 'mpmenu' && ( … )}` fragment — wrap both in a fragment if needed):

```tsx
          {hostNotice && (
            <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
              background: '#5f1d1d', color: '#fff', padding: '8px 16px', borderRadius: 6,
              fontFamily: 'monospace', zIndex: 70 }}
              onClick={() => setHostNotice(null)}>
              {hostNotice} — click to dismiss
            </div>
          )}
```

Also clear it when (re)entering the menu: in `leaveMultiplayer`, add `setHostNotice(null); setJoinError(null)`.

- [ ] **Step 5: Typecheck and run the full unit suite**

Run: `npm run build && npx vitest run`
Expected: build succeeds; all unit tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): drop-in free joins, join-error feedback, and host-disconnect notice"
```

---

### Task 14: End-to-end coverage for free games, passwords, and disconnects

**Files:**
- Create: `e2e/free-games.spec.ts`
- Reference: `e2e/helpers.ts`, `e2e/multiplayer.spec.ts` (existing patterns)

**Interfaces:**
- Consumes: all prior tasks via the running app.

- [ ] **Step 1: Read existing e2e patterns**

Read `e2e/multiplayer.spec.ts` and `e2e/helpers.ts` to reuse the existing two-page host/client setup helpers (room creation, joining by code, the test hooks like `window.__snapSeq`).

- [ ] **Step 2: Write the e2e spec**

Create `e2e/free-games.spec.ts` with three scenarios, following the existing helper style for launching host + client contexts:

```ts
import { test, expect } from '@playwright/test'
// Reuse the host/client bootstrap helpers from the existing multiplayer spec/helpers.

test.describe('free games, passwords, disconnect', () => {
  test('a client drops into a free game already in progress', async () => {
    // 1. Host creates a Free game, presses Start (status -> in-progress).
    // 2. Second client opens the menu, clicks Join on the free row, picks a team, Join Match.
    // 3. Assert the client reaches the playing state (canvas/pointer-lock or __snapSeq increasing)
    //    without ever waiting on a lobby Start.
  })

  test('a protected game rejects the wrong password then accepts the right one', async () => {
    // 1. Host creates a Free game with password "s3cret", presses Start.
    // 2. Client Joins, enters "nope" -> assert "Wrong password" appears, still on the menu.
    // 3. Client retries with "s3cret" -> assert it drops into the match.
  })

  test('host disconnect returns the client to the menu', async () => {
    // 1. Host + client in a game.
    // 2. Close the host context/page.
    // 3. Assert the client shows the "Host disconnected" notice and is back on the multiplayer menu.
  })
})
```

Implement each scenario's body using the concrete selectors added in this plan: the `Free` button and `Password (optional)` input in Match Setup, the `🔒` / `Free` tags and `Join` button in the server list, the `Join Match` button and `Password` input in the pre-join prompt, and the `Host disconnected` banner text.

- [ ] **Step 3: Run the e2e spec**

Run: `npx playwright test e2e/free-games.spec.ts`
Expected: all three scenarios PASS. If a scenario reveals a wiring gap, fix it in `src/App.tsx` (Tasks 12–13) before continuing.

- [ ] **Step 4: Commit**

```bash
git add e2e/free-games.spec.ts
git commit -m "test(e2e): cover free drop-in, password gating, and host disconnect"
```

---

### Task 15: Full verification and push

**Files:** none (verification only).

- [ ] **Step 1: Run the complete unit suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds with no type errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors. Fix any introduced lint issues and amend the relevant commit.

- [ ] **Step 4: Push to main**

Run: `git push origin main`
Expected: push succeeds.

---

## Self-Review Notes

- **Spec coverage:** join policy axis (Tasks 3, 8) · password kept host-side / public `protected` flag only (Tasks 4, 6, 12) · server-list 🔒 + tag (Task 9) · CS-style pre-join team+password prompt (Tasks 10, 11) · drop-in handshake `password`/`started`/`joinRejected`/targeted start (Tasks 5, 6, 7, 12, 13) · client-drop removal + roster/count update (Tasks 1, 2, 12) · host-drop return-to-menu notice (Tasks 7, 13). All spec sections map to tasks.
- **Type consistency:** `passwordOk` (Task 6) used in Task 12; `onJoinRejected`/`onDisconnect`/`onWelcome(…started)` (Task 7) used in Task 13; `onJoin(server: ServerRow)` (Task 9) consumed in Task 11; `PreJoinPrompt` props (Task 10) consumed in Task 11; `joinPolicy`/`protected` entry fields (Task 4) set in Task 12 and read in Task 9.
- **Non-goals honored:** no reconnect, grace period, or host migration anywhere.
