# Push-to-Talk Voice Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CS-style push-to-talk: hold **K** to stream live microphone audio to teammates over WebRTC, with a bottom-left list of all active speakers.

**Architecture:** Two planes. A **control plane** through the existing host relay carries a team-scoped voice roster and talk start/stop events (drives the speaker indicator and mesh membership). A **media plane** is a direct PeerJS audio mesh between teammates (`peer.call`), reusing each node's existing `Peer`. Voice "activates" on a player's first K press (lazy mic permission); thereafter K toggles the outgoing track. The indicator (control plane) works independently of media, so you always *see* teammates talking even before your own audio is active.

**Tech Stack:** React 19 + TypeScript, Three.js, PeerJS (WebRTC), Vitest, Playwright.

## Global Constraints

- **Push-to-talk key:** `KeyK`, defined as the exported constant `PUSH_TO_TALK_KEY` in `src/player/Controls.ts`. No rebinding UI this iteration.
- **Audience:** team-only. Audio and indicator are scoped to teammates; the host does the filtering centrally.
- **Voice is flat** (non-positional). Incoming teammate audio plays through plain `<audio>` elements, not the spatial `AudioManager`.
- **Lazy mic permission:** request `getUserMedia` only on the first K press. Denial must not crash the game.
- **PTT is multiplayer-only** (`role === 'host' | 'client'`). Single-player creates no `VoiceChat`, so it never prompts for the mic.
- Follow existing patterns: callbacks via `onX(cb)` setters (see `NetClient`), pure logic in small modules with Vitest unit tests, UI as absolutely-positioned React overlays with `pointerEvents: 'none'`.
- Test command for a single file: `npx vitest run <path>`. Full suite: `npm test`. Build: `npm run build`. Lint: `npm run lint`.

---

## File Structure

**New files:**
- `src/voice/SpeakerRegistry.ts` (+ `.test.ts`) — pure active-speaker state machine.
- `src/voice/voiceMesh.ts` (+ `.test.ts`) — pure mesh reconciliation + initiator rule.
- `src/voice/VoiceTransport.ts` — `MicProvider` / `VoicePeer` / `VoiceCall` interfaces + PeerJS adapters + `BrowserMicProvider`.
- `src/voice/AudioSink.ts` — manages `<audio>` elements for incoming streams.
- `src/voice/VoiceChat.ts` (+ `.test.ts`) — orchestrator wiring mic + mesh + registry behind injected interfaces.
- `src/ui/VoiceIndicator.tsx` (+ `.test.tsx`) — bottom-left speaker list overlay.

**Modified files:**
- `src/session/protocol.ts` — add `VoiceRosterEntry` + three `NetMessage` variants.
- `src/player/Controls.ts` (+ existing test) — `KeyK` → `onTalkStart`/`onTalkStop`.
- `src/net/NetHost.ts` (+ new `NetHost.voice.test.ts`) — roster build + talk relay.
- `src/net/NetClient.ts` — surface roster + remote talk events, send helpers.
- `src/net/PeerConnection.ts`, `src/net/PeerHost.ts`, `src/net/PeerClient.ts`, `src/session/Transport.ts` — expose underlying `Peer` and remote peer id.
- `src/App.tsx` — instantiate and wire `VoiceChat`, render `VoiceIndicator`.

---

### Task 1: Voice protocol messages

**Files:**
- Modify: `src/session/protocol.ts`

**Interfaces:**
- Produces: `interface VoiceRosterEntry { playerId: string; peerId: string; name: string }` and `NetMessage` variants `{ type: 'voiceRoster'; teammates: VoiceRosterEntry[] }`, `{ type: 'voiceStart'; playerId: string; name: string }`, `{ type: 'voiceStop'; playerId: string }`.

- [ ] **Step 1: Add the `VoiceRosterEntry` interface**

In `src/session/protocol.ts`, after the `GrenadeState` interface (around line 55), add:

```typescript
export interface VoiceRosterEntry {
  playerId: string
  peerId: string   // PeerJS id used for the direct voice mesh
  name: string
}
```

- [ ] **Step 2: Add the three message variants to the `NetMessage` union**

In `src/session/protocol.ts`, in the `NetMessage` union, add these lines just before `| { type: 'start' }`:

```typescript
  | { type: 'voiceRoster'; teammates: VoiceRosterEntry[] }
  | { type: 'voiceStart'; playerId: string; name: string }
  | { type: 'voiceStop'; playerId: string }
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/session/protocol.ts
git commit -m "feat(protocol): add voice roster and talk messages"
```

---

### Task 2: SpeakerRegistry (pure state machine)

**Files:**
- Create: `src/voice/SpeakerRegistry.ts`
- Test: `src/voice/SpeakerRegistry.test.ts`

**Interfaces:**
- Produces: `interface Speaker { playerId: string; name: string }`; `class SpeakerRegistry` with `constructor(ttlMs?: number)`, `start(playerId, name, now)`, `stop(playerId)`, `remove(playerId)`, `prune(now)`, `list(): Speaker[]`, `get size(): number`.

- [ ] **Step 1: Write the failing test**

Create `src/voice/SpeakerRegistry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { SpeakerRegistry } from './SpeakerRegistry'

describe('SpeakerRegistry', () => {
  it('adds a speaker on start and lists it', () => {
    const r = new SpeakerRegistry()
    r.start('p1', 'Ann', 0)
    expect(r.list()).toEqual([{ playerId: 'p1', name: 'Ann' }])
  })

  it('removes a speaker on stop', () => {
    const r = new SpeakerRegistry()
    r.start('p1', 'Ann', 0)
    r.stop('p1')
    expect(r.list()).toEqual([])
  })

  it('refreshes lastSeen without duplicating or reordering', () => {
    const r = new SpeakerRegistry()
    r.start('p1', 'Ann', 0)
    r.start('p2', 'Bob', 0)
    r.start('p1', 'Ann', 5)
    expect(r.list().map(s => s.playerId)).toEqual(['p1', 'p2'])
  })

  it('prune drops entries older than ttl but keeps fresh ones', () => {
    const r = new SpeakerRegistry(1000)
    r.start('old', 'Old', 0)
    r.start('fresh', 'Fresh', 900)
    r.prune(1500)
    expect(r.list().map(s => s.playerId)).toEqual(['fresh'])
  })

  it('remove drops a speaker (disconnect)', () => {
    const r = new SpeakerRegistry()
    r.start('p1', 'Ann', 0)
    r.remove('p1')
    expect(r.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/voice/SpeakerRegistry.test.ts`
Expected: FAIL — cannot find module `./SpeakerRegistry`.

- [ ] **Step 3: Write the implementation**

Create `src/voice/SpeakerRegistry.ts`:

```typescript
export interface Speaker {
  playerId: string
  name: string
}

/** Tracks who is currently talking. Entries are refreshed by talk heartbeats
 *  and pruned if they go stale (guards against a lost stop or a dropped peer). */
export class SpeakerRegistry {
  private map = new Map<string, { name: string; lastSeen: number }>()

  constructor(private ttlMs = 2500) {}

  get size(): number {
    return this.map.size
  }

  start(playerId: string, name: string, now: number): void {
    const existing = this.map.get(playerId)
    if (existing) {
      existing.name = name
      existing.lastSeen = now
    } else {
      this.map.set(playerId, { name, lastSeen: now })
    }
  }

  stop(playerId: string): void {
    this.map.delete(playerId)
  }

  remove(playerId: string): void {
    this.map.delete(playerId)
  }

  prune(now: number): void {
    for (const [id, entry] of this.map) {
      if (now - entry.lastSeen > this.ttlMs) this.map.delete(id)
    }
  }

  list(): Speaker[] {
    return [...this.map.entries()].map(([playerId, e]) => ({ playerId, name: e.name }))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/voice/SpeakerRegistry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/voice/SpeakerRegistry.ts src/voice/SpeakerRegistry.test.ts
git commit -m "feat(voice): add SpeakerRegistry state machine"
```

---

### Task 3: Voice mesh reconciliation (pure)

**Files:**
- Create: `src/voice/voiceMesh.ts`
- Test: `src/voice/voiceMesh.test.ts`

**Interfaces:**
- Produces: `shouldInitiate(myPeerId, otherPeerId): boolean`; `interface MeshDiff { toOpen: string[]; toClose: string[] }`; `reconcileMesh(myPeerId, connected: string[], teammates: string[]): MeshDiff`.

- [ ] **Step 1: Write the failing test**

Create `src/voice/voiceMesh.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { shouldInitiate, reconcileMesh } from './voiceMesh'

describe('voiceMesh', () => {
  it('the lexicographically smaller peer id initiates', () => {
    expect(shouldInitiate('aaa', 'bbb')).toBe(true)
    expect(shouldInitiate('bbb', 'aaa')).toBe(false)
  })

  it('opens only initiator calls that are not yet connected', () => {
    // myPeerId 'm': initiate to 'z' (m<z) but not 'a' (m>a, they call us)
    const diff = reconcileMesh('m', [], ['z', 'a'])
    expect(diff.toOpen).toEqual(['z'])
    expect(diff.toClose).toEqual([])
  })

  it('does not reopen an already-connected teammate', () => {
    const diff = reconcileMesh('m', ['z'], ['z'])
    expect(diff.toOpen).toEqual([])
    expect(diff.toClose).toEqual([])
  })

  it('closes connections to ex-teammates', () => {
    const diff = reconcileMesh('m', ['z', 'old'], ['z'])
    expect(diff.toClose).toEqual(['old'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/voice/voiceMesh.test.ts`
Expected: FAIL — cannot find module `./voiceMesh`.

- [ ] **Step 3: Write the implementation**

Create `src/voice/voiceMesh.ts`:

```typescript
/** Of a teammate pair, the peer with the smaller id places the call;
 *  the other answers. Guarantees exactly one call per pair. */
export function shouldInitiate(myPeerId: string, otherPeerId: string): boolean {
  return myPeerId < otherPeerId
}

export interface MeshDiff {
  toOpen: string[]   // peer ids we should call now
  toClose: string[]  // peer ids we should hang up on
}

/** Given who we're connected to and who our teammates are, decide which calls
 *  to open (only those we initiate and haven't opened) and which to close. */
export function reconcileMesh(myPeerId: string, connected: string[], teammates: string[]): MeshDiff {
  const teammateSet = new Set(teammates)
  const connectedSet = new Set(connected)
  const toOpen = teammates.filter(p => shouldInitiate(myPeerId, p) && !connectedSet.has(p))
  const toClose = connected.filter(p => !teammateSet.has(p))
  return { toOpen, toClose }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/voice/voiceMesh.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/voice/voiceMesh.ts src/voice/voiceMesh.test.ts
git commit -m "feat(voice): add mesh reconciliation helpers"
```

---

### Task 4: Voice transport interfaces, PeerJS adapters, mic, audio sink

**Files:**
- Create: `src/voice/VoiceTransport.ts`
- Create: `src/voice/AudioSink.ts`

**Interfaces:**
- Produces:
  - `interface MicProvider { getStream(): Promise<MediaStream> }`
  - `interface VoiceCall { readonly peerId: string; answer(stream: MediaStream): void; onStream(cb: (s: MediaStream) => void): void; onClose(cb: () => void): void; close(): void }`
  - `interface VoicePeer { readonly id: string; call(peerId: string, stream: MediaStream): VoiceCall; onIncomingCall(cb: (call: VoiceCall) => void): void }`
  - `class BrowserMicProvider implements MicProvider`
  - `class PeerJsVoicePeer implements VoicePeer` (constructor takes a peerjs `Peer`)
  - `class AudioSink` with `play(peerId, stream)`, `stop(peerId)`, `dispose()`.

This task is thin glue over the PeerJS and DOM media APIs, which are not meaningfully unit-testable; it is verified by the `VoiceChat` tests (which use fakes of these interfaces) and by manual/e2e checks. No unit test file.

- [ ] **Step 1: Create the interfaces and adapters**

Create `src/voice/VoiceTransport.ts`:

```typescript
import type Peer from 'peerjs'
import type { MediaConnection } from 'peerjs'

/** Acquires the local microphone stream (lazily, once). */
export interface MicProvider {
  getStream(): Promise<MediaStream>
}

/** A single peer-to-peer audio call. */
export interface VoiceCall {
  readonly peerId: string
  answer(stream: MediaStream): void
  onStream(cb: (stream: MediaStream) => void): void
  onClose(cb: () => void): void
  close(): void
}

/** A node in the voice mesh: can place and receive audio calls. */
export interface VoicePeer {
  readonly id: string
  call(peerId: string, stream: MediaStream): VoiceCall
  onIncomingCall(cb: (call: VoiceCall) => void): void
}

export class BrowserMicProvider implements MicProvider {
  private stream: Promise<MediaStream> | null = null

  getStream(): Promise<MediaStream> {
    if (!this.stream) {
      this.stream = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    }
    return this.stream
  }
}

class PeerJsVoiceCall implements VoiceCall {
  constructor(private conn: MediaConnection) {}
  get peerId(): string { return this.conn.peer }
  answer(stream: MediaStream): void { this.conn.answer(stream) }
  onStream(cb: (stream: MediaStream) => void): void {
    this.conn.on('stream', (s) => cb(s as MediaStream))
  }
  onClose(cb: () => void): void { this.conn.on('close', () => cb()) }
  close(): void { this.conn.close() }
}

export class PeerJsVoicePeer implements VoicePeer {
  constructor(private peer: Peer) {}
  get id(): string { return this.peer.id }
  call(peerId: string, stream: MediaStream): VoiceCall {
    return new PeerJsVoiceCall(this.peer.call(peerId, stream))
  }
  onIncomingCall(cb: (call: VoiceCall) => void): void {
    this.peer.on('call', (conn: MediaConnection) => cb(new PeerJsVoiceCall(conn)))
  }
}
```

- [ ] **Step 2: Create the audio sink**

Create `src/voice/AudioSink.ts`:

```typescript
/** Plays incoming teammate audio streams through hidden <audio> elements,
 *  one per peer. Flat (non-positional) by design. */
export class AudioSink {
  private els = new Map<string, HTMLAudioElement>()

  play(peerId: string, stream: MediaStream): void {
    let el = this.els.get(peerId)
    if (!el) {
      el = document.createElement('audio')
      el.autoplay = true
      el.style.display = 'none'
      document.body.appendChild(el)
      this.els.set(peerId, el)
    }
    el.srcObject = stream
    void el.play().catch(() => {})
  }

  stop(peerId: string): void {
    const el = this.els.get(peerId)
    if (!el) return
    el.srcObject = null
    el.remove()
    this.els.delete(peerId)
  }

  dispose(): void {
    for (const id of [...this.els.keys()]) this.stop(id)
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/voice/VoiceTransport.ts src/voice/AudioSink.ts
git commit -m "feat(voice): add PeerJS voice adapters, mic provider, audio sink"
```

---

### Task 5: VoiceChat orchestrator

**Files:**
- Create: `src/voice/VoiceChat.ts`
- Test: `src/voice/VoiceChat.test.ts`

**Interfaces:**
- Consumes: `SpeakerRegistry` + `Speaker` (Task 2), `reconcileMesh` (Task 3), `VoicePeer`/`VoiceCall`/`MicProvider` (Task 4), `VoiceRosterEntry` (Task 1).
- Produces: `interface VoiceChatDeps { peer: VoicePeer; mic: MicProvider; localPlayerId: string; localName: string; sendStart: (playerId: string, name: string) => void; sendStop: (playerId: string) => void; onSpeakersChanged: (speakers: Speaker[]) => void; playStream: (peerId: string, stream: MediaStream) => void; stopStream: (peerId: string) => void; now?: () => number; heartbeatMs?: number; ttlMs?: number }`; `class VoiceChat` with `setRoster(teammates: VoiceRosterEntry[])`, `startTalking(): Promise<void>`, `stopTalking()`, `remoteStart(playerId, name)`, `remoteStop(playerId)`, `peerDisconnected(playerId)`, `tick(now)`, `dispose()`.

- [ ] **Step 1: Write the failing test**

Create `src/voice/VoiceChat.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { VoiceChat } from './VoiceChat'
import type { VoicePeer, VoiceCall, MicProvider } from './VoiceTransport'

function fakeStream(): MediaStream {
  const track = { enabled: false, stop: vi.fn() }
  return { getAudioTracks: () => [track] } as unknown as MediaStream
}

class FakeCall implements VoiceCall {
  answered = false
  closed = false
  private streamCb: ((s: MediaStream) => void) | null = null
  private closeCb: (() => void) | null = null
  constructor(public peerId: string) {}
  answer(): void { this.answered = true }
  onStream(cb: (s: MediaStream) => void): void { this.streamCb = cb }
  onClose(cb: () => void): void { this.closeCb = cb }
  close(): void { this.closed = true; this.closeCb?.() }
  emitStream(s: MediaStream): void { this.streamCb?.(s) }
}

class FakePeer implements VoicePeer {
  calls: FakeCall[] = []
  private incomingCb: ((call: VoiceCall) => void) | null = null
  constructor(public id: string) {}
  call(peerId: string): VoiceCall { const c = new FakeCall(peerId); this.calls.push(c); return c }
  onIncomingCall(cb: (call: VoiceCall) => void): void { this.incomingCb = cb }
  fireIncoming(call: FakeCall): void { this.incomingCb?.(call) }
}

function setup(myId: string) {
  const peer = new FakePeer(myId)
  const stream = fakeStream()
  const mic: MicProvider = { getStream: vi.fn().mockResolvedValue(stream) }
  const sendStart = vi.fn()
  const sendStop = vi.fn()
  const onSpeakersChanged = vi.fn()
  const playStream = vi.fn()
  const stopStream = vi.fn()
  let t = 0
  const chat = new VoiceChat({
    peer, mic, localPlayerId: 'me', localName: 'Me',
    sendStart, sendStop, onSpeakersChanged, playStream, stopStream,
    now: () => t,
  })
  return { peer, stream, mic, sendStart, sendStop, onSpeakersChanged, playStream, stopStream, chat, setTime: (v: number) => { t = v } }
}

describe('VoiceChat', () => {
  it('acquires the mic only on first talk and shows the local speaker', async () => {
    const s = setup('me')
    expect(s.mic.getStream).not.toHaveBeenCalled()
    await s.chat.startTalking()
    expect(s.mic.getStream).toHaveBeenCalledTimes(1)
    expect(s.sendStart).toHaveBeenCalledWith('me', 'Me')
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([{ playerId: 'me', name: 'Me' }])
    expect(s.stream.getAudioTracks()[0].enabled).toBe(true)
  })

  it('disables the mic track and clears the local speaker on stop', async () => {
    const s = setup('me')
    await s.chat.startTalking()
    s.chat.stopTalking()
    expect(s.stream.getAudioTracks()[0].enabled).toBe(false)
    expect(s.sendStop).toHaveBeenCalledWith('me')
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([])
  })

  it('opens an initiator call to a teammate with a larger peer id once activated', async () => {
    const s = setup('aaa') // 'aaa' < 'zzz' so we initiate
    s.chat.setRoster([{ playerId: 'p2', peerId: 'zzz', name: 'Zoe' }])
    expect(s.peer.calls).toHaveLength(0) // not activated yet
    await s.chat.startTalking()
    expect(s.peer.calls.map(c => c.peerId)).toEqual(['zzz'])
  })

  it('does not initiate to a teammate with a smaller peer id (answers instead)', async () => {
    const s = setup('zzz') // 'zzz' > 'aaa' so the other initiates
    s.chat.setRoster([{ playerId: 'p2', peerId: 'aaa', name: 'Ann' }])
    await s.chat.startTalking()
    expect(s.peer.calls).toHaveLength(0)
  })

  it('answers an incoming call from a teammate and plays its stream', async () => {
    const s = setup('zzz')
    s.chat.setRoster([{ playerId: 'p2', peerId: 'aaa', name: 'Ann' }])
    await s.chat.startTalking()
    const incoming = new FakeCall('aaa')
    s.peer.fireIncoming(incoming)
    expect(incoming.answered).toBe(true)
    const remoteStream = fakeStream()
    incoming.emitStream(remoteStream)
    expect(s.playStream).toHaveBeenCalledWith('aaa', remoteStream)
  })

  it('rejects an incoming call from a non-teammate', async () => {
    const s = setup('zzz')
    s.chat.setRoster([])
    await s.chat.startTalking()
    const incoming = new FakeCall('stranger')
    s.peer.fireIncoming(incoming)
    expect(incoming.answered).toBe(false)
    expect(incoming.closed).toBe(true)
  })

  it('adds and removes remote speakers from talk events', () => {
    const s = setup('me')
    s.chat.remoteStart('p2', 'Bob')
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([{ playerId: 'p2', name: 'Bob' }])
    s.chat.remoteStop('p2')
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([])
  })

  it('closes the call and drops the speaker when a peer disconnects', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'p2', peerId: 'zzz', name: 'Zoe' }])
    await s.chat.startTalking()
    s.chat.remoteStart('p2', 'Zoe')
    s.chat.peerDisconnected('p2')
    expect(s.peer.calls[0].closed).toBe(true)
    expect(s.stopStream).toHaveBeenCalledWith('zzz')
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([])
  })

  it('resends a talk heartbeat after the interval while holding', async () => {
    const s = setup('me')
    await s.chat.startTalking()
    s.sendStart.mockClear()
    s.setTime(500)
    s.chat.tick(500)
    expect(s.sendStart).not.toHaveBeenCalled()
    s.setTime(1100)
    s.chat.tick(1100)
    expect(s.sendStart).toHaveBeenCalledWith('me', 'Me')
  })

  it('prunes a stale remote speaker on tick', () => {
    const s = setup('me')
    s.chat.remoteStart('p2', 'Bob') // lastSeen = 0
    s.chat.tick(5000)               // ttl default 2500 → pruned
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/voice/VoiceChat.test.ts`
Expected: FAIL — cannot find module `./VoiceChat`.

- [ ] **Step 3: Write the implementation**

Create `src/voice/VoiceChat.ts`:

```typescript
import { SpeakerRegistry, type Speaker } from './SpeakerRegistry'
import { reconcileMesh } from './voiceMesh'
import type { VoicePeer, VoiceCall, MicProvider } from './VoiceTransport'
import type { VoiceRosterEntry } from '../session/protocol'

export interface VoiceChatDeps {
  peer: VoicePeer
  mic: MicProvider
  localPlayerId: string
  localName: string
  sendStart: (playerId: string, name: string) => void
  sendStop: (playerId: string) => void
  onSpeakersChanged: (speakers: Speaker[]) => void
  playStream: (peerId: string, stream: MediaStream) => void
  stopStream: (peerId: string) => void
  now?: () => number
  heartbeatMs?: number
  ttlMs?: number
}

/** Orchestrates push-to-talk: lazy mic, a teammate audio mesh, and the
 *  active-speaker registry. Voice "activates" on the first startTalking()
 *  (which acquires the mic); the indicator works independently of media. */
export class VoiceChat {
  private registry: SpeakerRegistry
  private roster: VoiceRosterEntry[] = []
  private calls = new Map<string, VoiceCall>() // peerId -> call
  private mic: MediaStream | null = null
  private activated = false
  private talking = false
  private lastSent = 0
  private now: () => number
  private heartbeatMs: number

  constructor(private deps: VoiceChatDeps) {
    this.now = deps.now ?? (() => performance.now())
    this.heartbeatMs = deps.heartbeatMs ?? 1000
    this.registry = new SpeakerRegistry(deps.ttlMs ?? 2500)
    deps.peer.onIncomingCall((call) => this.handleIncoming(call))
  }

  setRoster(teammates: VoiceRosterEntry[]): void {
    this.roster = teammates
    if (this.activated) this.reconcile()
  }

  async startTalking(): Promise<void> {
    if (this.talking) return
    if (!this.activated) await this.activate()
    this.talking = true
    this.setMicEnabled(true)
    this.registry.start(this.deps.localPlayerId, this.deps.localName, this.now())
    this.deps.sendStart(this.deps.localPlayerId, this.deps.localName)
    this.lastSent = this.now()
    this.emit()
  }

  stopTalking(): void {
    if (!this.talking) return
    this.talking = false
    this.setMicEnabled(false)
    this.registry.stop(this.deps.localPlayerId)
    this.deps.sendStop(this.deps.localPlayerId)
    this.emit()
  }

  remoteStart(playerId: string, name: string): void {
    this.registry.start(playerId, name, this.now())
    this.emit()
  }

  remoteStop(playerId: string): void {
    this.registry.stop(playerId)
    this.emit()
  }

  peerDisconnected(playerId: string): void {
    const entry = this.roster.find(r => r.playerId === playerId)
    if (entry) this.closeCall(entry.peerId)
    this.registry.remove(playerId)
    this.emit()
  }

  /** Drive each frame: self-heal the mesh, resend talk heartbeats, prune stale speakers. */
  tick(now: number): void {
    if (this.activated) this.reconcile()
    if (this.talking && now - this.lastSent >= this.heartbeatMs) {
      this.registry.start(this.deps.localPlayerId, this.deps.localName, now)
      this.deps.sendStart(this.deps.localPlayerId, this.deps.localName)
      this.lastSent = now
    }
    const before = this.registry.size
    this.registry.prune(now)
    if (this.registry.size !== before) this.emit()
  }

  dispose(): void {
    for (const peerId of [...this.calls.keys()]) this.closeCall(peerId)
    this.mic?.getAudioTracks().forEach(t => t.stop())
    this.mic = null
  }

  private async activate(): Promise<void> {
    this.mic = await this.deps.mic.getStream()
    this.setMicEnabled(false)
    this.activated = true
    this.reconcile()
  }

  private reconcile(): void {
    if (!this.mic) return
    const teammatePeerIds = this.roster.map(r => r.peerId)
    const { toOpen, toClose } = reconcileMesh(this.deps.peer.id, [...this.calls.keys()], teammatePeerIds)
    for (const peerId of toClose) this.closeCall(peerId)
    for (const peerId of toOpen) this.openCall(peerId)
  }

  private openCall(peerId: string): void {
    if (this.calls.has(peerId) || !this.mic) return
    this.wireCall(this.deps.peer.call(peerId, this.mic))
  }

  private handleIncoming(call: VoiceCall): void {
    const isTeammate = this.roster.some(r => r.peerId === call.peerId)
    if (!this.activated || !this.mic || !isTeammate || this.calls.has(call.peerId)) {
      call.close()
      return
    }
    call.answer(this.mic)
    this.wireCall(call)
  }

  private wireCall(call: VoiceCall): void {
    this.calls.set(call.peerId, call)
    call.onStream((stream) => this.deps.playStream(call.peerId, stream))
    call.onClose(() => {
      this.calls.delete(call.peerId)
      this.deps.stopStream(call.peerId)
    })
  }

  private closeCall(peerId: string): void {
    const call = this.calls.get(peerId)
    if (!call) return
    call.close()
    this.calls.delete(peerId)
    this.deps.stopStream(peerId)
  }

  private setMicEnabled(on: boolean): void {
    this.mic?.getAudioTracks().forEach(t => { t.enabled = on })
  }

  private emit(): void {
    this.deps.onSpeakersChanged(this.registry.list())
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/voice/VoiceChat.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/voice/VoiceChat.ts src/voice/VoiceChat.test.ts
git commit -m "feat(voice): add VoiceChat orchestrator"
```

---

### Task 6: Push-to-talk key in Controls

**Files:**
- Modify: `src/player/Controls.ts`
- Test: `src/player/__tests__/Controls.test.ts` (add cases)

**Interfaces:**
- Produces: exported `const PUSH_TO_TALK_KEY = 'KeyK'`; `Controls.onTalkStart: (() => void) | null`; `Controls.onTalkStop: (() => void) | null`.

- [ ] **Step 1: Write the failing tests**

In `src/player/__tests__/Controls.test.ts`, add these tests inside the `describe('Controls', ...)` block (e.g. after the `'ignores unrelated key codes'` test):

```typescript
  it('fires onTalkStart once on KeyK down even with auto-repeat', () => {
    const start = vi.fn()
    controls.onTalkStart = start
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' })) // OS auto-repeat
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('fires onTalkStop on KeyK up and allows talking again', () => {
    const start = vi.fn()
    const stop = vi.fn()
    controls.onTalkStart = start
    controls.onTalkStop = stop
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }))
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyK' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }))
    expect(stop).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledTimes(2)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/player/__tests__/Controls.test.ts`
Expected: FAIL — `onTalkStart`/`onTalkStop` not called.

- [ ] **Step 3: Add the constant and callbacks**

In `src/player/Controls.ts`, at the top after the import line, add:

```typescript
export const PUSH_TO_TALK_KEY = 'KeyK'
```

In the `Controls` class, after the `onCycleGrenade` callback declaration (around line 24), add:

```typescript
  /** Fired on push-to-talk key down / up (hold to transmit voice). */
  onTalkStart: (() => void) | null = null
  onTalkStop: (() => void) | null = null
  private talkHeld = false
```

- [ ] **Step 4: Handle the key in onKeyDown / onKeyUp**

In `src/player/Controls.ts`, in `onKeyDown`'s `switch`, add this case after `case 'KeyG':`:

```typescript
      case PUSH_TO_TALK_KEY:
        if (!this.talkHeld) { this.talkHeld = true; this.onTalkStart?.() }
        break
```

In `onKeyUp`'s `switch`, add this case after the `case 'Tab':` block:

```typescript
      case PUSH_TO_TALK_KEY:
        this.talkHeld = false
        this.onTalkStop?.()
        break
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/player/__tests__/Controls.test.ts`
Expected: PASS (all, including the two new cases).

- [ ] **Step 6: Commit**

```bash
git add src/player/Controls.ts src/player/__tests__/Controls.test.ts
git commit -m "feat(controls): add push-to-talk key (K) callbacks"
```

---

### Task 7: NetHost voice roster and talk relay

**Files:**
- Modify: `src/net/NetHost.ts`
- Test: `src/net/NetHost.voice.test.ts`

**Interfaces:**
- Consumes: `VoiceRosterEntry` (Task 1).
- Produces (new on `NetHost`): `addClient(playerId, name, transport, team?, voicePeerId?)` (added optional 5th param); `setHostVoice(playerId: string, peerId: string): void`; `refreshVoiceRoster(): void`; `localVoiceStart(): void`; `localVoiceStop(): void`; `onHostRoster(cb: (teammates: VoiceRosterEntry[]) => void): void`; `onRemoteVoiceStart(cb: (playerId: string, name: string) => void): void`; `onRemoteVoiceStop(cb: (playerId: string) => void): void`.

- [ ] **Step 1: Write the failing test**

Create `src/net/NetHost.voice.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { NetHost } from './NetHost'
import { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { NetMessage, VoiceRosterEntry } from '../session/protocol'

function fakeTransport() {
  let handler: ((m: NetMessage) => void) | null = null
  const sent: NetMessage[] = []
  const t: Transport = {
    send: (m: NetMessage) => { sent.push(m) },
    onMessage: (cb: (m: NetMessage) => void) => { handler = cb },
  } as unknown as Transport
  return { t, sent, deliver: (m: NetMessage) => handler?.(m) }
}

// Host 'host' on ct (peer 'peerHost'), client p1 on ct (peer 'peer1'), client p2 on t (peer 'peer2').
function threeWay() {
  const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
  const host = new NetHost(session, session.config)
  host.setHostVoice(session.localId, 'peerHost')
  const c1 = fakeTransport()
  const c2 = fakeTransport()
  host.addClient('p1', 'Ann', c1.t, 'ct', 'peer1')
  host.addClient('p2', 'Bob', c2.t, 't', 'peer2')
  return { session, host, c1, c2 }
}

describe('NetHost voice', () => {
  it('sends each client a team-scoped roster', () => {
    const { host, c1, c2 } = threeWay()
    c1.sent.length = 0; c2.sent.length = 0
    host.refreshVoiceRoster()
    const r1 = c1.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    const ids1 = r1.teammates.map((e: VoiceRosterEntry) => e.playerId).sort()
    expect(ids1).toEqual([/* host id */ 'p1' === 'p1' ? host['session'].localId : '']
      .filter(Boolean).sort())
    // p1 (ct) sees only the host (ct), not p2 (t)
    expect(r1.teammates.map(e => e.peerId)).toEqual(['peerHost'])
    const r2 = c2.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    expect(r2.teammates).toEqual([]) // p2 (t) has no teammates
  })

  it('gives the host its own team-scoped roster via onHostRoster', () => {
    const { host } = threeWay()
    const rosters: VoiceRosterEntry[][] = []
    host.onHostRoster((r) => rosters.push(r))
    host.refreshVoiceRoster()
    const last = rosters[rosters.length - 1]
    expect(last.map(e => e.peerId)).toEqual(['peer1']) // host (ct) sees p1 (ct)
  })

  it('relays a client voiceStart only to same-team links', () => {
    const { c1, c2 } = threeWay()
    c1.sent.length = 0; c2.sent.length = 0
    // p1 (ct) talks → no other ct *client* exists, so no client receives it
    c1.deliver({ type: 'voiceStart', playerId: 'p1', name: 'Ann' })
    expect(c2.sent.find(m => m.type === 'voiceStart')).toBeUndefined()
  })

  it('invokes onRemoteVoiceStart when a same-team client talks', () => {
    const { host, c1 } = threeWay()
    const start = vi.fn()
    host.onRemoteVoiceStart(start)
    c1.deliver({ type: 'voiceStart', playerId: 'p1', name: 'Ann' }) // p1 ct, host ct
    expect(start).toHaveBeenCalledWith('p1', 'Ann')
  })

  it('relays host localVoiceStart to same-team client links', () => {
    const { host, c1, c2 } = threeWay()
    c1.sent.length = 0; c2.sent.length = 0
    host.localVoiceStart()
    expect(c1.sent.find(m => m.type === 'voiceStart')).toBeDefined() // p1 ct
    expect(c2.sent.find(m => m.type === 'voiceStart')).toBeUndefined() // p2 t
  })
})
```

Note: the first test's `ids1` expectation is awkward; replace its body with the simpler peerId assertion only. Use this cleaner version of the first test:

```typescript
  it('sends each client a team-scoped roster', () => {
    const { host, c1, c2 } = threeWay()
    c1.sent.length = 0; c2.sent.length = 0
    host.refreshVoiceRoster()
    const r1 = c1.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    // p1 (ct) sees only the host (ct), not p2 (t)
    expect(r1.teammates.map(e => e.peerId)).toEqual(['peerHost'])
    const r2 = c2.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    expect(r2.teammates).toEqual([]) // p2 (t) has no teammates
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/NetHost.voice.test.ts`
Expected: FAIL — `setHostVoice` / `onHostRoster` not a function.

- [ ] **Step 3: Extend `ClientLink` and imports**

In `src/net/NetHost.ts`, change the import of protocol types to include `VoiceRosterEntry`:

```typescript
import type { NetMessage, SessionEvent, Snapshot, VoiceRosterEntry } from '../session/protocol'
```

Change the `ClientLink` interface to carry the voice peer id:

```typescript
interface ClientLink { playerId: string; transport: Transport; voicePeerId?: string }
```

- [ ] **Step 4: Add voice fields and callbacks**

In `src/net/NetHost.ts`, inside the `NetHost` class, after the `private started = false` line, add:

```typescript
  private hostVoice: { playerId: string; peerId: string } | null = null
  private hostRosterCb: ((teammates: VoiceRosterEntry[]) => void) | null = null
  private remoteVoiceStartCb: ((playerId: string, name: string) => void) | null = null
  private remoteVoiceStopCb: ((playerId: string) => void) | null = null

  setHostVoice(playerId: string, peerId: string): void {
    this.hostVoice = { playerId, peerId }
    this.refreshVoiceRoster()
  }
  onHostRoster(cb: (teammates: VoiceRosterEntry[]) => void): void { this.hostRosterCb = cb }
  onRemoteVoiceStart(cb: (playerId: string, name: string) => void): void { this.remoteVoiceStartCb = cb }
  onRemoteVoiceStop(cb: (playerId: string) => void): void { this.remoteVoiceStopCb = cb }

  /** All voice participants (host + connected clients) with team + peer id. */
  private voiceParticipants(): { playerId: string; peerId: string; name: string; team: Team }[] {
    const out: { playerId: string; peerId: string; name: string; team: Team }[] = []
    if (this.hostVoice) {
      const p = this.session.getPlayer(this.hostVoice.playerId)
      if (p) out.push({ playerId: this.hostVoice.playerId, peerId: this.hostVoice.peerId, name: p.name, team: p.team })
    }
    for (const link of this.links) {
      const p = this.session.getPlayer(link.playerId)
      if (p && link.voicePeerId) out.push({ playerId: link.playerId, peerId: link.voicePeerId, name: p.name, team: p.team })
    }
    return out
  }

  private voiceTeammatesFor(playerId: string): VoiceRosterEntry[] {
    const all = this.voiceParticipants()
    const me = all.find(p => p.playerId === playerId)
    if (!me) return []
    return all
      .filter(p => p.playerId !== playerId && p.team === me.team)
      .map(p => ({ playerId: p.playerId, peerId: p.peerId, name: p.name }))
  }

  /** Recompute and push the team-scoped roster to every client and the host. */
  refreshVoiceRoster(): void {
    for (const link of this.links) {
      link.transport.send({ type: 'voiceRoster', teammates: this.voiceTeammatesFor(link.playerId) })
    }
    if (this.hostVoice) this.hostRosterCb?.(this.voiceTeammatesFor(this.hostVoice.playerId))
  }

  private relayVoice(msg: Extract<NetMessage, { type: 'voiceStart' | 'voiceStop' }>, speakerId: string): void {
    const all = this.voiceParticipants()
    const speaker = all.find(p => p.playerId === speakerId)
    if (!speaker) return
    for (const p of all) {
      if (p.playerId === speakerId || p.team !== speaker.team) continue
      if (this.hostVoice && p.playerId === this.hostVoice.playerId) {
        if (msg.type === 'voiceStart') this.remoteVoiceStartCb?.(speakerId, msg.name)
        else this.remoteVoiceStopCb?.(speakerId)
      } else {
        this.links.find(l => l.playerId === p.playerId)?.transport.send(msg)
      }
    }
  }

  /** The host itself started/stopped talking — relay to teammate clients. */
  localVoiceStart(): void {
    if (!this.hostVoice) return
    const p = this.session.getPlayer(this.hostVoice.playerId)
    this.relayVoice({ type: 'voiceStart', playerId: this.hostVoice.playerId, name: p?.name ?? '' }, this.hostVoice.playerId)
  }
  localVoiceStop(): void {
    if (!this.hostVoice) return
    this.relayVoice({ type: 'voiceStop', playerId: this.hostVoice.playerId }, this.hostVoice.playerId)
  }
```

- [ ] **Step 5: Store the voice peer id and relay client talk events**

In `src/net/NetHost.ts`, change the `addClient` signature to accept the voice peer id:

```typescript
  addClient(playerId: string, name: string, transport: Transport, team: Team = 'ct', voicePeerId?: string): void {
```

In `addClient`'s `transport.onMessage` handler, add two branches at the end of the `if/else` chain (after the `defuseBomb` branch):

```typescript
      } else if (msg.type === 'voiceStart' && msg.playerId === playerId) {
        this.relayVoice(msg, playerId)
      } else if (msg.type === 'voiceStop' && msg.playerId === playerId) {
        this.relayVoice(msg, playerId)
      }
```

In `addClient`, change the link push to record the peer id, and refresh the roster afterward. Replace:

```typescript
    this.links.push({ playerId, transport })
    this.broadcast({ type: 'playerJoined', playerId, name })
```

with:

```typescript
    this.links.push({ playerId, transport, voicePeerId })
    this.broadcast({ type: 'playerJoined', playerId, name })
    this.refreshVoiceRoster()
```

- [ ] **Step 6: Refresh roster on leave and team change**

In `removeClient`, add a roster refresh at the end (after the `playerLeft` broadcast):

```typescript
    this.broadcast({ type: 'playerLeft', playerId })
    this.refreshVoiceRoster()
```

In the `setTeam` handler branch, add a refresh after assigning the team. Replace:

```typescript
      } else if (msg.type === 'setTeam' && msg.playerId === playerId) {
        const entity = this.session.getPlayer(playerId)
        if (entity && (msg.team === 'ct' || msg.team === 't')) entity.team = msg.team
```

with:

```typescript
      } else if (msg.type === 'setTeam' && msg.playerId === playerId) {
        const entity = this.session.getPlayer(playerId)
        if (entity && (msg.team === 'ct' || msg.team === 't')) { entity.team = msg.team; this.refreshVoiceRoster() }
```

- [ ] **Step 7: Run the voice test and the existing host test**

Run: `npx vitest run src/net/NetHost.voice.test.ts src/net/NetHost.pvp.test.ts`
Expected: PASS (both files).

- [ ] **Step 8: Commit**

```bash
git add src/net/NetHost.ts src/net/NetHost.voice.test.ts
git commit -m "feat(net): host-side voice roster and talk relay"
```

---

### Task 8: NetClient voice surface

**Files:**
- Modify: `src/net/NetClient.ts`

**Interfaces:**
- Consumes: `VoiceRosterEntry` (Task 1).
- Produces (new on `NetClient`): `onVoiceRoster(cb: (teammates: VoiceRosterEntry[]) => void): void`; `onVoiceStart(cb: (playerId: string, name: string) => void): void`; `onVoiceStop(cb: (playerId: string) => void): void`; `sendVoiceStart(playerId: string, name: string): void`; `sendVoiceStop(playerId: string): void`.

- [ ] **Step 1: Write the failing test**

Create `src/net/NetClient.voice.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { NetClient } from './NetClient'
import type { Transport } from '../session/Transport'
import type { NetMessage } from '../session/protocol'

function fakeTransport() {
  let handler: ((m: NetMessage) => void) | null = null
  const closeCbs: (() => void)[] = []
  const sent: NetMessage[] = []
  const t: Transport = {
    send: (m: NetMessage) => { sent.push(m) },
    onMessage: (cb: (m: NetMessage) => void) => { handler = cb },
    onClose: (cb: () => void) => { closeCbs.push(cb) },
  } as unknown as Transport
  return { t, sent, deliver: (m: NetMessage) => handler?.(m) }
}

describe('NetClient voice', () => {
  it('routes voiceRoster, voiceStart, voiceStop to callbacks', () => {
    const { t, deliver } = fakeTransport()
    const client = new NetClient(t)
    const roster = vi.fn(); const start = vi.fn(); const stop = vi.fn()
    client.onVoiceRoster(roster); client.onVoiceStart(start); client.onVoiceStop(stop)
    deliver({ type: 'voiceRoster', teammates: [{ playerId: 'p1', peerId: 'peer1', name: 'Ann' }] })
    deliver({ type: 'voiceStart', playerId: 'p1', name: 'Ann' })
    deliver({ type: 'voiceStop', playerId: 'p1' })
    expect(roster).toHaveBeenCalledWith([{ playerId: 'p1', peerId: 'peer1', name: 'Ann' }])
    expect(start).toHaveBeenCalledWith('p1', 'Ann')
    expect(stop).toHaveBeenCalledWith('p1')
  })

  it('sends voiceStart / voiceStop over the transport', () => {
    const { t, sent } = fakeTransport()
    const client = new NetClient(t)
    client.sendVoiceStart('me', 'Me')
    client.sendVoiceStop('me')
    expect(sent).toContainEqual({ type: 'voiceStart', playerId: 'me', name: 'Me' })
    expect(sent).toContainEqual({ type: 'voiceStop', playerId: 'me' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/NetClient.voice.test.ts`
Expected: FAIL — `onVoiceRoster` not a function.

- [ ] **Step 3: Add the import, fields, setters, senders, and routing**

In `src/net/NetClient.ts`, add `VoiceRosterEntry` to the protocol type import:

```typescript
import type { GameMode, NetMessage, PlayerInput, SessionEvent, Snapshot, VoiceRosterEntry } from '../session/protocol'
```

In the `NetClient` class, after the `playerLeftCb` field, add:

```typescript
  private voiceRosterCb: ((teammates: VoiceRosterEntry[]) => void) | null = null
  private voiceStartCb: ((playerId: string, name: string) => void) | null = null
  private voiceStopCb: ((playerId: string) => void) | null = null
```

Next to the other `onX` setters (after `onPlayerLeft`), add:

```typescript
  onVoiceRoster(cb: (teammates: VoiceRosterEntry[]) => void): void { this.voiceRosterCb = cb }
  onVoiceStart(cb: (playerId: string, name: string) => void): void { this.voiceStartCb = cb }
  onVoiceStop(cb: (playerId: string) => void): void { this.voiceStopCb = cb }
  sendVoiceStart(playerId: string, name: string): void { this.transport.send({ type: 'voiceStart', playerId, name }) }
  sendVoiceStop(playerId: string): void { this.transport.send({ type: 'voiceStop', playerId }) }
```

In the `handle` method, add these branches before the closing brace of the `if/else` chain (after the `playerLeft` branch):

```typescript
    } else if (msg.type === 'voiceRoster') {
      this.voiceRosterCb?.(msg.teammates)
    } else if (msg.type === 'voiceStart') {
      this.voiceStartCb?.(msg.playerId, msg.name)
    } else if (msg.type === 'voiceStop') {
      this.voiceStopCb?.(msg.playerId)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/NetClient.voice.test.ts src/net/NetClient.pvp.test.ts`
Expected: PASS (both files).

- [ ] **Step 5: Commit**

```bash
git add src/net/NetClient.ts src/net/NetClient.voice.test.ts
git commit -m "feat(net): client-side voice roster and talk events"
```

---

### Task 9: VoiceIndicator overlay

**Files:**
- Create: `src/ui/VoiceIndicator.tsx`
- Test: `src/ui/VoiceIndicator.test.tsx`

**Interfaces:**
- Consumes: `Speaker` (Task 2).
- Produces: `function VoiceIndicator({ speakers }: { speakers: Speaker[] }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/VoiceIndicator.test.tsx`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { VoiceIndicator } from './VoiceIndicator'

afterEach(cleanup)

describe('VoiceIndicator', () => {
  it('renders a row per active speaker', () => {
    render(<VoiceIndicator speakers={[
      { playerId: 'p1', name: 'Ann' },
      { playerId: 'p2', name: 'Bob' },
    ]} />)
    expect(screen.getByText('Ann')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
  })

  it('renders nothing when no one is talking', () => {
    const { container } = render(<VoiceIndicator speakers={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/VoiceIndicator.test.tsx`
Expected: FAIL — cannot find module `./VoiceIndicator`.

- [ ] **Step 3: Write the component**

Create `src/ui/VoiceIndicator.tsx`:

```typescript
import type { Speaker } from '../voice/SpeakerRegistry'

/** Bottom-left list of players currently transmitting voice. */
export function VoiceIndicator({ speakers }: { speakers: Speaker[] }) {
  if (speakers.length === 0) return null
  return (
    <div style={{
      position: 'absolute', left: 16, bottom: 16, zIndex: 60,
      display: 'flex', flexDirection: 'column', gap: 6,
      pointerEvents: 'none', fontFamily: 'monospace',
    }}>
      {speakers.map((s) => (
        <div key={s.playerId} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,0.55)', color: '#9ef7a0',
          padding: '4px 10px', borderRadius: 6, fontSize: 14,
        }}>
          <span aria-hidden="true" style={{ fontSize: 16 }}>🎤</span>
          <span>{s.name}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/VoiceIndicator.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/VoiceIndicator.tsx src/ui/VoiceIndicator.test.tsx
git commit -m "feat(ui): add bottom-left voice indicator"
```

---

### Task 10: Expose PeerJS peer + remote peer id

**Files:**
- Modify: `src/session/Transport.ts`
- Modify: `src/net/PeerConnection.ts`
- Modify: `src/net/PeerHost.ts`
- Modify: `src/net/PeerClient.ts`

**Interfaces:**
- Produces: `Transport.remotePeerId?: string`; `PeerConnection.remotePeerId: string`; `PeerHost.peer: Peer | null` (getter); `PeerClient.peer: Peer | null` (getter).

This task wires real PeerJS objects through to the app; it is exercised by manual/e2e voice testing (no unit test).

- [ ] **Step 1: Add `remotePeerId` to the Transport interface**

In `src/session/Transport.ts`, in the `Transport` interface, add after the `onClose` line:

```typescript
  /** Optional: the remote endpoint's PeerJS id (set by PeerConnection only). */
  remotePeerId?: string
```

- [ ] **Step 2: Set `remotePeerId` in PeerConnection**

In `src/net/PeerConnection.ts`, add a public field initialized from the connection. Replace the constructor:

```typescript
  constructor(private conn: DataConnection) {}
```

with:

```typescript
  readonly remotePeerId: string
  constructor(private conn: DataConnection) {
    this.remotePeerId = conn.peer
  }
```

- [ ] **Step 3: Expose the underlying Peer on PeerHost**

In `src/net/PeerHost.ts`, add a getter inside the class (after the `onClientConnect` method):

```typescript
  get peer(): Peer | null { return this._peer }
```

and rename the private field for clarity: change `private peer: Peer | null = null` to `private _peer: Peer | null = null`, and update its uses inside `start()` and `stop()` (`this.peer` → `this._peer`).

- [ ] **Step 4: Expose the underlying Peer on PeerClient**

In `src/net/PeerClient.ts`, apply the same change: rename `private peer: Peer | null = null` to `private _peer: Peer | null = null`, update its uses inside `connect()` and `stop()`, and add:

```typescript
  get peer(): Peer | null { return this._peer }
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/session/Transport.ts src/net/PeerConnection.ts src/net/PeerHost.ts src/net/PeerClient.ts
git commit -m "feat(net): expose PeerJS peer and remote peer id for voice mesh"
```

---

### Task 11: Wire VoiceChat into the app

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `VoiceChat` (Task 5), `BrowserMicProvider`/`PeerJsVoicePeer` (Task 4), `AudioSink` (Task 4), `VoiceIndicator` (Task 9), `Speaker` (Task 2), and the new `NetHost`/`NetClient`/`PeerHost`/`PeerClient` voice members.

- [ ] **Step 1: Add imports**

In `src/App.tsx`, add near the other `./voice`/`./ui` imports:

```typescript
import type Peer from 'peerjs'
import { VoiceChat } from './voice/VoiceChat'
import { BrowserMicProvider, PeerJsVoicePeer } from './voice/VoiceTransport'
import { AudioSink } from './voice/AudioSink'
import { VoiceIndicator } from './ui/VoiceIndicator'
import type { Speaker } from './voice/SpeakerRegistry'
```

- [ ] **Step 2: Add speaker state**

In `src/App.tsx`, with the other `useState` hooks (near line 110), add:

```typescript
  const [speakers, setSpeakers] = useState<Speaker[]>([])
```

- [ ] **Step 3: Add voice fields to the game data ref**

In `src/App.tsx`, in the `gameDataRef` object (around line 169), add after `grenadeManager`:

```typescript
    voiceChat: null as VoiceChat | null,
    audioSink: new AudioSink(),
    micProvider: new BrowserMicProvider(),
```

- [ ] **Step 4: Add a helper to build VoiceChat and tear it down**

In `src/App.tsx`, add this `useCallback` next to `resetNetworking` (after its definition, around line 192):

```typescript
  const startVoice = useCallback((localPlayerId: string, peer: Peer) => {
    const data = gameDataRef.current
    data.voiceChat?.dispose()
    const chat = new VoiceChat({
      peer: new PeerJsVoicePeer(peer),
      mic: data.micProvider,
      localPlayerId,
      localName: settingsRef.current.playerName,
      sendStart: (id, name) => {
        if (data.role === 'host') data.netHost?.localVoiceStart()
        else data.netClient?.sendVoiceStart(id, name)
      },
      sendStop: (id) => {
        if (data.role === 'host') data.netHost?.localVoiceStop()
        else data.netClient?.sendVoiceStop(id)
      },
      onSpeakersChanged: (list) => setSpeakers(list),
      playStream: (peerId, stream) => data.audioSink.play(peerId, stream),
      stopStream: (peerId) => data.audioSink.stop(peerId),
    })
    data.voiceChat = chat
    return chat
  }, [])
```

- [ ] **Step 5: Tear down voice in resetNetworking**

In `src/App.tsx`, inside `resetNetworking`, add before `data.role = 'single'`:

```typescript
    data.voiceChat?.dispose(); data.voiceChat = null
    data.audioSink.dispose()
    setSpeakers([])
```

- [ ] **Step 6: Wire push-to-talk callbacks on Controls**

In `src/App.tsx`, in the engine-setup `useEffect` where the other `data.controls.onX` handlers are assigned (around line 524, after `onCycleGrenade`), add:

```typescript
    data.controls.onTalkStart = () => {
      if (gameStateRef.current !== 'playing') return
      void gameDataRef.current.voiceChat?.startTalking()
    }
    data.controls.onTalkStop = () => {
      gameDataRef.current.voiceChat?.stopTalking()
    }
```

- [ ] **Step 7: Start host voice and wire host relay callbacks**

In `src/App.tsx`, in the `onStart` handler of `MultiplayerMenu` (around line 1084, where `startNetGame('host')` is called), expand it to start voice. Replace:

```typescript
            onStart={() => {
              gameDataRef.current.hostDirectory?.setStatus('in-progress')
              gameDataRef.current.netHost?.startMatch()
              startNetGame('host')
            }}
```

with:

```typescript
            onStart={() => {
              const data = gameDataRef.current
              data.hostDirectory?.setStatus('in-progress')
              data.netHost?.startMatch()
              startNetGame('host')
              const hostPeer = data.peerHost?.peer
              if (data.netHost && hostPeer && roomCode) {
                const chat = startVoice(data.session.localId, hostPeer)
                data.netHost.onHostRoster((r) => chat.setRoster(r))
                data.netHost.onRemoteVoiceStart((id, name) => chat.remoteStart(id, name))
                data.netHost.onRemoteVoiceStop((id) => chat.remoteStop(id))
                data.netHost.setHostVoice(data.session.localId, roomCode)
              }
            }}
```

- [ ] **Step 8: Pass each client's voice peer id to the host**

In `src/App.tsx`, in `hostGame`'s `peerHost.onClientConnect` handler, update the `addClient` call to pass the remote peer id. Replace:

```typescript
          netHost.addClient(id, msg.name, transport, joinTeam)
```

with:

```typescript
          netHost.addClient(id, msg.name, transport, joinTeam, transport.remotePeerId)
```

- [ ] **Step 9: Start client voice and wire client voice callbacks**

In `src/App.tsx`, in `joinGame`'s `client.onWelcome(...)` handler, after `setRoster({ ct: players, t: [] })`, add voice startup (the client's `playerId` is set by the time `onWelcome` fires):

```typescript
      const peer = data.peerClient?.peer
      if (peer && client.playerId) {
        const chat = startVoice(client.playerId, peer)
        client.onVoiceRoster((r) => chat.setRoster(r))
        client.onVoiceStart((id, name) => chat.remoteStart(id, name))
        client.onVoiceStop((id) => chat.remoteStop(id))
      }
```

In `joinGame`, in the existing `client.onPlayerLeft(...)` handler, also notify VoiceChat. Replace:

```typescript
    client.onPlayerLeft(() => {
      setLobbyPlayers((prev) => prev.slice(0, -1))
    })
```

with:

```typescript
    client.onPlayerLeft((id) => {
      gameDataRef.current.voiceChat?.peerDisconnected(id)
      setLobbyPlayers((prev) => prev.slice(0, -1))
    })
```

- [ ] **Step 10: Drive VoiceChat.tick from the render loop**

In `src/App.tsx`, in the `engine.onUpdate` callback, add a tick for both roles. At the very top of the callback (right after `engine.onUpdate((dt) => {`), add:

```typescript
      gameDataRef.current.voiceChat?.tick(performance.now())
```

(Placing it before the `if (data.role === 'client') { updateClient(dt); return }` line ensures it runs for clients too.)

- [ ] **Step 11: Render the VoiceIndicator**

In `src/App.tsx`, in the `gameState === 'playing'` overlay block, add after `<KillFeed lines={killFeed} />`:

```typescript
          <VoiceIndicator speakers={speakers} />
```

- [ ] **Step 12: Build, lint, and run the full suite**

Run: `npm run build && npm run lint && npm test`
Expected: build succeeds, lint clean, all unit tests pass.

- [ ] **Step 13: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire push-to-talk voice chat and indicator"
```

---

### Task 12: Manual verification

**Files:** none (verification only).

WebRTC audio capture/playback cannot be unit-tested; verify the end-to-end path manually.

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`
Open two browser windows (or two machines) to the served URL.

- [ ] **Step 2: Host + join on the same team**

In window A, host a PvP/competitive match and pick a team. In window B, join with the same room code and select the **same** team. Start the match.

- [ ] **Step 3: Verify push-to-talk**

Confirm each of the following:
- In window A, hold **K** → the browser prompts for mic permission on the first press; grant it. A `🎤 <name>` row appears bottom-left in **both** windows.
- After window B also presses **K** once (granting mic), window B can hear window A's voice and vice-versa.
- Release **K** → the speaker row disappears within ~1s in both windows.
- Put one player on the **opposite** team → that player neither hears nor sees the other's talk indicator.
- Deny mic permission in a third client → holding K shows no local indicator and the game keeps running (no crash).

- [ ] **Step 4: Commit any doc updates**

If the README documents controls, add **K — push-to-talk (team voice)** to the controls list, then:

```bash
git add README.md
git commit -m "docs: document push-to-talk key"
```

---

## Self-Review Notes

- **Spec coverage:** behavior/K key (Tasks 6, 11), real teammate audio mesh (Tasks 4, 5, 10, 11), team-only scoping (Task 7), all-active-speakers indicator (Tasks 2, 9, 11), control/media plane split (Tasks 1, 5, 7, 8), lazy mic permission + denial safety (Tasks 4, 5, 12), flat audio (Task 4 `AudioSink`), mesh reconciliation on team changes (Tasks 3, 5, 7), disconnect cleanup (Tasks 5, 7, 11), timeout/heartbeat guard (Tasks 2, 5). All spec sections map to tasks.
- **Type consistency:** `VoiceRosterEntry`, `Speaker`, `VoicePeer`/`VoiceCall`/`MicProvider`, and the `VoiceChat` method names are defined once (Tasks 1, 2, 4, 5) and consumed unchanged in Tasks 7–11.
- **Known v1 limitation (documented, by design):** two teammates hear each other only after **both** have pressed K at least once (mic activates lazily, no renegotiation). The indicator works regardless of activation because it rides the control plane.
