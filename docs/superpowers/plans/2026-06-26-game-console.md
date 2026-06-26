# Game Console & Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CS-style in-game console and text chat system supporting all-chat, team-chat, and direct messages, with a fading HUD feed and scrollable console history.

**Architecture:** A single `<GameConsole>` component (plus `<ChatFeed>`) lives in `src/ui/GameConsole.tsx` and receives all state from App.tsx. Networking is handled by adding a `chat` message type to the protocol, a `routeChat` method on `NetHost`, and an `onChat` callback on `NetClient`. App.tsx owns `chatMessages[]` state and drives all open/close/send logic from `handleKeyDown` and a `handleSend` callback.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react, PeerJS P2P networking.

## Global Constraints

- No new dependencies — all code uses existing React, TypeScript, Vitest stack.
- `ChatMessage` type lives in `src/ui/GameConsole.tsx` (UI layer). Net layer uses `Extract<NetMessage, { type: 'chat' }>` to avoid cross-layer imports.
- `chatMessages` array is capped at 200 entries (slice with `.slice(-199)` before appending).
- Error/system lines use `from: ''` — rendered in `#ff6060`.
- Console keybinds (`openChatAll`, `openChatTeam`, `openConsole`) live in `Keymap` and are remappable.

---

### Task 1: Protocol + Keybinds settings

**Files:**
- Modify: `src/session/protocol.ts`
- Modify: `src/settings/Settings.ts`

**Interfaces:**
- Produces: `NetMessage` union includes `{ type: 'chat'; playerId: string; name: string; team: Team; scope: 'all' | 'team' | 'player'; targetName?: string; text: string }`. `Keymap` interface and `DEFAULT_KEYMAP` include `openChatAll: string`, `openChatTeam: string`, `openConsole: string`.

- [ ] **Step 1: Add `chat` to `NetMessage` in `src/session/protocol.ts`**

Open `src/session/protocol.ts`. The file already imports `Team`. Add one line to the `NetMessage` union (after the `| { type: 'start' }` line at the bottom):

```ts
  | { type: 'chat'; playerId: string; name: string; team: Team; scope: 'all' | 'team' | 'player'; targetName?: string; text: string }
```

- [ ] **Step 2: Add three keybind keys to `src/settings/Settings.ts`**

In the `Keymap` interface, add after `removeBot: string`:
```ts
  openChatAll: string
  openChatTeam: string
  openConsole: string
```

In `DEFAULT_KEYMAP`, add after `removeBot: 'Backslash'`:
```ts
  openChatAll: 'KeyY',
  openChatTeam: 'KeyU',
  openConsole: 'Backquote',
```

- [ ] **Step 3: Type-check**

```bash
cd /home/user/projects/browser-shooter && npx tsc --noEmit
```

Expected: no errors (TypeScript will catch any `Keymap` usage that doesn't satisfy the new shape — `loadSettings` already spreads `DEFAULT_KEYMAP` as fallback so old saved settings merge safely).

- [ ] **Step 4: Run existing tests to confirm no regressions**

```bash
cd /home/user/projects/browser-shooter && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: all pre-existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/session/protocol.ts src/settings/Settings.ts
git commit -m "feat(chat): add chat NetMessage type and keybind settings"
```

---

### Task 2: `<GameConsole>`, `<ChatFeed>`, and `parseChatCommand`

**Files:**
- Create: `src/ui/GameConsole.tsx`
- Create: `src/ui/__tests__/GameConsole.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks yet (standalone component).
- Produces:
  - `export interface ChatMessage { id: number; from: string; scope: 'all' | 'team' | 'player'; target?: string; text: string; at: number }`
  - `export function parseChatCommand(text: string, playerNames: string[]): { scope: 'all' | 'team' | 'player'; target?: string; text: string } | null`
  - `export const GameConsole: React.FC<GameConsoleProps>`
  - `export const ChatFeed: React.FC<{ messages: ChatMessage[] }>`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/__tests__/GameConsole.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { GameConsole, ChatFeed, parseChatCommand } from '../GameConsole'
import type { ChatMessage } from '../GameConsole'

afterEach(cleanup)

// ── parseChatCommand ──────────────────────────────────────────────────────────

describe('parseChatCommand', () => {
  it('returns null for unknown commands', () => {
    expect(parseChatCommand('hello', [])).toBeNull()
    expect(parseChatCommand('/foo bar', [])).toBeNull()
  })

  it('/msg <text> → all-scope', () => {
    expect(parseChatCommand('/msg hello world', [])).toEqual({ scope: 'all', text: 'hello world' })
  })

  it('/msg team <text> → team-scope', () => {
    expect(parseChatCommand('/msg team hello', [])).toEqual({ scope: 'team', text: 'hello' })
  })

  it('/msg <playerName> <text> → player-scope when name matches', () => {
    expect(parseChatCommand('/msg Alice hi there', ['Alice', 'Bob'])).toEqual({ scope: 'player', target: 'Alice', text: 'hi there' })
  })

  it('falls back to all-scope when first word is not a known player', () => {
    expect(parseChatCommand('/msg unknown hi', ['Alice'])).toEqual({ scope: 'all', text: 'unknown hi' })
  })
})

// ── GameConsole ───────────────────────────────────────────────────────────────

const msg = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 1, from: 'Alice', scope: 'all', text: 'hello', at: Date.now(), ...overrides,
})

describe('GameConsole', () => {
  const base = {
    open: true,
    prefill: '',
    messages: [],
    onSend: vi.fn(),
    onClose: vi.fn(),
    playerNames: [],
  }

  it('renders nothing when closed', () => {
    const { container } = render(<GameConsole {...base} open={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders input when open', () => {
    render(<GameConsole {...base} />)
    expect(screen.getByPlaceholderText('/msg hello')).toBeInTheDocument()
  })

  it('pre-fills input with prefill prop on open', () => {
    render(<GameConsole {...base} prefill="/msg " />)
    expect((screen.getByPlaceholderText('/msg hello') as HTMLInputElement).value).toBe('/msg ')
  })

  it('calls onSend with input value when Enter is pressed', () => {
    const onSend = vi.fn()
    render(<GameConsole {...base} onSend={onSend} prefill="/msg " />)
    const input = screen.getByPlaceholderText('/msg hello')
    fireEvent.change(input, { target: { value: '/msg hello' } })
    fireEvent.keyDown(input, { code: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('/msg hello')
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<GameConsole {...base} onClose={onClose} />)
    const input = screen.getByPlaceholderText('/msg hello')
    fireEvent.keyDown(input, { code: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('renders message history', () => {
    render(<GameConsole {...base} messages={[msg({ text: 'hi there' })]} />)
    expect(screen.getByText('hi there')).toBeInTheDocument()
  })

  it('renders error lines (from === "") in a distinct element', () => {
    render(<GameConsole {...base} messages={[msg({ from: '', scope: 'all', text: 'Unknown command: foo' })]} />)
    expect(screen.getByText('Unknown command: foo')).toBeInTheDocument()
  })
})

// ── ChatFeed ─────────────────────────────────────────────────────────────────

describe('ChatFeed', () => {
  it('renders nothing with no messages', () => {
    const { container } = render(<ChatFeed messages={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders recent messages', () => {
    const messages = [msg({ id: 1, text: 'hi', at: Date.now() })]
    render(<ChatFeed messages={messages} />)
    expect(screen.getByText('hi')).toBeInTheDocument()
  })

  it('does not render expired messages (older than 8s)', () => {
    const messages = [msg({ id: 1, text: 'old', at: Date.now() - 9000 })]
    render(<ChatFeed messages={messages} />)
    expect(screen.queryByText('old')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/user/projects/browser-shooter && npm test -- src/ui/__tests__/GameConsole.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../GameConsole'`.

- [ ] **Step 3: Create `src/ui/GameConsole.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  id: number
  from: string        // '' for system/error lines
  scope: 'all' | 'team' | 'player'
  target?: string     // defined when scope === 'player'
  text: string
  at: number          // Date.now() — used by ChatFeed for expiry
}

export function parseChatCommand(
  text: string,
  playerNames: string[]
): { scope: 'all' | 'team' | 'player'; target?: string; text: string } | null {
  if (!text.startsWith('/msg ')) return null
  const rest = text.slice(5)
  if (rest.startsWith('team ')) return { scope: 'team', text: rest.slice(5) }
  const first = rest.split(' ')[0]
  if (playerNames.includes(first)) return { scope: 'player', target: first, text: rest.slice(first.length + 1) }
  return { scope: 'all', text: rest }
}

const SCOPE_COLOR: Record<string, string> = { all: '#ffffff', team: '#7bc87b', player: '#f0c060' }

function lineColor(msg: ChatMessage): string {
  return msg.from ? SCOPE_COLOR[msg.scope] ?? '#ffffff' : '#ff6060'
}

function linePrefix(msg: ChatMessage): string {
  if (msg.scope === 'team') return '[TEAM] '
  if (msg.scope === 'player') return `[DM→${msg.target}] `
  return ''
}

function MsgLine({ msg }: { msg: ChatMessage }) {
  const color = lineColor(msg)
  if (!msg.from) return <div style={{ color, opacity: 0.8 }}>{msg.text}</div>
  return (
    <div style={{ color, wordBreak: 'break-word' }}>
      <span style={{ opacity: 0.7 }}>{linePrefix(msg)}</span>
      <span style={{ color: '#aaa' }}>{msg.from}: </span>
      {msg.text}
    </div>
  )
}

interface GameConsoleProps {
  open: boolean
  prefill: string
  messages: ChatMessage[]
  onSend: (text: string) => void
  onClose: () => void
  playerNames: string[]
}

export const GameConsole: React.FC<GameConsoleProps> = ({
  open, prefill, messages, onSend, onClose,
}) => {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setInput(prefill)
    document.exitPointerLock()
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open, prefill])

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight
  }, [messages.length, open])

  if (!open) return null

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.code === 'Escape' || e.code === 'Backquote') { e.preventDefault(); onClose(); return }
    if (e.code === 'Enter') { e.preventDefault(); onSend(input); setInput('') }
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0,
      width: '40%', maxHeight: '50%',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(0,0,0,0.78)',
      fontFamily: 'monospace', fontSize: 13,
      zIndex: 80, pointerEvents: 'auto',
    }}>
      <div ref={historyRef} style={{
        overflowY: 'auto', flex: 1, padding: '8px 10px',
        display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0,
      }}>
        {messages.map(msg => <MsgLine key={msg.id} msg={msg} />)}
      </div>
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="/msg hello"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', fontFamily: 'monospace', fontSize: 13,
          padding: '6px 10px', outline: 'none', flexShrink: 0,
        }}
      />
    </div>
  )
}

export const ChatFeed: React.FC<{ messages: ChatMessage[] }> = ({ messages }) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const visible = messages.filter(m => now - m.at < 8000).slice(-6)
  if (!visible.length) return null

  return (
    <div style={{
      position: 'absolute', bottom: 40, left: 0,
      display: 'flex', flexDirection: 'column', gap: 2,
      fontFamily: 'monospace', fontSize: 13,
      zIndex: 55, pointerEvents: 'none', padding: '0 10px',
    }}>
      {visible.map(msg => (
        <div key={msg.id} style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          <MsgLine msg={msg} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/user/projects/browser-shooter && npm test -- src/ui/__tests__/GameConsole.test.tsx 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd /home/user/projects/browser-shooter && npm test 2>&1 | tail -10
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/ui/GameConsole.tsx src/ui/__tests__/GameConsole.test.tsx
git commit -m "feat(chat): add GameConsole, ChatFeed, and parseChatCommand"
```

---

### Task 3: NetClient chat callback

**Files:**
- Modify: `src/net/NetClient.ts`
- Modify: `src/net/NetClient.pvp.test.ts`

**Interfaces:**
- Consumes: `Extract<NetMessage, { type: 'chat' }>` from Task 1.
- Produces: `NetClient.onChat(cb: (msg: Extract<NetMessage, { type: 'chat' }>) => void): void`

- [ ] **Step 1: Write the failing test**

Add to `src/net/NetClient.pvp.test.ts` (add this `it` block inside the existing `describe('NetClient PvP', ...)`):

```ts
  it('fires onChat when a chat message arrives', () => {
    const { t, deliver } = fakeTransport()
    const c = new NetClient(t)
    const got: NetMessage[] = []
    c.onChat((msg) => got.push(msg))
    deliver({ type: 'chat', playerId: 'p2', name: 'Bob', team: 'ct', scope: 'all', text: 'hello' })
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({ type: 'chat', name: 'Bob', scope: 'all', text: 'hello' })
  })
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd /home/user/projects/browser-shooter && npm test -- src/net/NetClient.pvp.test.ts 2>&1 | tail -15
```

Expected: FAIL — `c.onChat is not a function`.

- [ ] **Step 3: Add `chatCb` field and `onChat` method to `NetClient`**

In `src/net/NetClient.ts`, add a private field after the existing private callback fields (around line 42, after `private voiceStopCb`):

```ts
  private chatCb: ((msg: Extract<NetMessage, { type: 'chat' }>) => void) | null = null
```

Add the public method alongside the other `onXxx` methods (around line 140, after `onVoiceStop`):

```ts
  onChat(cb: (msg: Extract<NetMessage, { type: 'chat' }>) => void): void { this.chatCb = cb }
```

In the `handle(msg)` method, add a new branch at the end of the `else if` chain (after the `voiceStop` branch, before the closing `}`):

```ts
    } else if (msg.type === 'chat') {
      this.chatCb?.(msg)
    }
```

- [ ] **Step 4: Run tests**

```bash
cd /home/user/projects/browser-shooter && npm test -- src/net/NetClient.pvp.test.ts 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd /home/user/projects/browser-shooter && npm test 2>&1 | tail -10
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/net/NetClient.ts src/net/NetClient.pvp.test.ts
git commit -m "feat(chat): add NetClient.onChat callback"
```

---

### Task 4: NetHost chat routing

**Files:**
- Modify: `src/net/NetHost.ts`
- Modify: `src/net/__tests__/NetHost.test.ts`

**Interfaces:**
- Consumes: `Extract<NetMessage, { type: 'chat' }>` from Task 1. `GameSession.localId` and `GameSession.getPlayer(id)` (already used throughout NetHost).
- Produces: `NetHost.routeChat(msg: Extract<NetMessage, { type: 'chat' }>): void` and `NetHost.onChat(cb): void`.

- [ ] **Step 1: Write the failing tests**

Add these `it` blocks to `src/net/__tests__/NetHost.test.ts` inside the existing `describe('NetHost', ...)`:

```ts
  it('routes all-scope chat to all clients', () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'pvp', damagePolicy: 'ffa', fragLimit: 5 })
    const [h1, c1] = createLinkedTransports()
    const [h2, c2] = createLinkedTransports()
    const recv1: NetMessage[] = []; const recv2: NetMessage[] = []
    c1.onMessage(m => recv1.push(m)); c2.onMessage(m => recv2.push(m))

    host.addClient('p2', 'Bob', h1, 'ct')
    host.addClient('p3', 'Carol', h2, 't')

    host.routeChat({ type: 'chat', playerId: 'p2', name: 'Bob', team: 'ct', scope: 'all', text: 'hi all' })

    // p3 (c2) should receive it; p2 (c1) should NOT (no echo to sender)
    expect(recv2.some(m => m.type === 'chat' && m.type === 'chat' && m.text === 'hi all')).toBe(true)
    const chatToSender = recv1.filter(m => m.type === 'chat')
    expect(chatToSender).toHaveLength(0)
  })

  it('routes team-scope chat only to same-team clients', () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'pvp', damagePolicy: 'ffa', fragLimit: 5 })
    const [h1, c1] = createLinkedTransports()
    const [h2, c2] = createLinkedTransports()
    const recv1: NetMessage[] = []; const recv2: NetMessage[] = []
    c1.onMessage(m => recv1.push(m)); c2.onMessage(m => recv2.push(m))

    host.addClient('p2', 'Bob', h1, 'ct')
    host.addClient('p3', 'Carol', h2, 't')

    host.routeChat({ type: 'chat', playerId: 'p2', name: 'Bob', team: 'ct', scope: 'team', text: 'ct only' })

    // Carol is on 't' — should NOT receive
    expect(recv2.filter(m => m.type === 'chat')).toHaveLength(0)
  })

  it('routes player-scope chat only to the named player', () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'pvp', damagePolicy: 'ffa', fragLimit: 5 })
    const [h1, c1] = createLinkedTransports()
    const [h2, c2] = createLinkedTransports()
    const recv1: NetMessage[] = []; const recv2: NetMessage[] = []
    c1.onMessage(m => recv1.push(m)); c2.onMessage(m => recv2.push(m))

    host.addClient('p2', 'Bob', h1, 'ct')
    host.addClient('p3', 'Carol', h2, 't')

    host.routeChat({ type: 'chat', playerId: 'p2', name: 'Bob', team: 'ct', scope: 'player', targetName: 'Carol', text: 'hey carol' })

    expect(recv2.some(m => m.type === 'chat')).toBe(true)
    expect(recv1.filter(m => m.type === 'chat')).toHaveLength(0)
  })

  it('fires onChat for the host when a client sends an all-scope message', () => {
    const session = new GameSession()
    const host = new NetHost(session, { mode: 'pvp', damagePolicy: 'ffa', fragLimit: 5 })
    const [h1, c1] = createLinkedTransports()
    const hostRecv: NetMessage[] = []
    host.onChat(m => hostRecv.push(m))

    host.addClient('p2', 'Bob', h1, 'ct')
    c1.send({ type: 'chat', playerId: 'p2', name: 'Bob', team: 'ct', scope: 'all', text: 'hello host' })

    expect(hostRecv.some(m => m.type === 'chat')).toBe(true)
  })
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd /home/user/projects/browser-shooter && npm test -- src/net/__tests__/NetHost.test.ts 2>&1 | tail -15
```

Expected: FAIL — `host.routeChat is not a function` / `host.onChat is not a function`.

- [ ] **Step 3: Add `chatCb`, `onChat`, and `routeChat` to `NetHost`**

In `src/net/NetHost.ts`, add a private field alongside the other callback fields (after `clientTeamChangedCb`):

```ts
  private chatCb: ((msg: Extract<NetMessage, { type: 'chat' }>) => void) | null = null
```

Add `onChat` alongside the other `onXxx` methods (after `onClientTeamChanged`):

```ts
  onChat(cb: (msg: Extract<NetMessage, { type: 'chat' }>) => void): void { this.chatCb = cb }
```

Add the `routeChat` method (add it after `broadcastTeamChange`):

```ts
  routeChat(msg: Extract<NetMessage, { type: 'chat' }>): void {
    const senderTeam = this.session.getPlayer(msg.playerId)?.team
    for (const link of this.links) {
      if (link.playerId === msg.playerId) continue  // no echo to sender
      if (msg.scope === 'team' && this.session.getPlayer(link.playerId)?.team !== senderTeam) continue
      if (msg.scope === 'player' && this.session.getPlayer(link.playerId)?.name !== msg.targetName) continue
      link.transport.send(msg)
    }
    // Notify the host player if they are a valid recipient and didn't send the message
    if (msg.playerId !== this.session.localId) {
      const hostPlayer = this.session.getPlayer(this.session.localId)
      const hostReceives =
        msg.scope === 'all' ||
        (msg.scope === 'team' && hostPlayer?.team === senderTeam) ||
        (msg.scope === 'player' && hostPlayer?.name === msg.targetName)
      if (hostReceives) this.chatCb?.(msg)
    }
  }
```

In `addClient`'s `transport.onMessage` switch, add a handler before the closing `}` of the `else if` chain (after the `voiceStop` branch):

```ts
      } else if (msg.type === 'chat' && msg.playerId === playerId) {
        this.routeChat(msg)
      }
```

- [ ] **Step 4: Run tests**

```bash
cd /home/user/projects/browser-shooter && npm test -- src/net/__tests__/NetHost.test.ts 2>&1 | tail -15
```

Expected: all four new tests plus all pre-existing NetHost tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd /home/user/projects/browser-shooter && npm test 2>&1 | tail -10
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/net/NetHost.ts src/net/__tests__/NetHost.test.ts
git commit -m "feat(chat): add NetHost.routeChat with scope-based routing"
```

---

### Task 5: App.tsx integration

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ChatMessage`, `GameConsole`, `ChatFeed`, `parseChatCommand` from Task 2. `NetClient.onChat` from Task 3. `NetHost.routeChat`, `NetHost.onChat` from Task 4. `Keymap.openChatAll/openChatTeam/openConsole` from Task 1.

- [ ] **Step 1: Add imports**

At the top of `src/App.tsx`, add to the existing UI import block:

```ts
import { GameConsole, ChatFeed, parseChatCommand, type ChatMessage } from './ui/GameConsole'
```

- [ ] **Step 2: Add new state and ref**

In the component body, after the `voiceNotice` state (around line 179), add:

```ts
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [consolePrefill, setConsolePrefill] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const chatSeqRef = useRef(0)
```

- [ ] **Step 3: Add `handleSend` callback**

Add this `useCallback` after the existing `pushKill` callback (around line 253):

```ts
  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) { setConsoleOpen(false); return }
    const data = gameDataRef.current
    const cmd = parseChatCommand(trimmed, data.lastPlayers.map(p => p.name))
    if (!cmd) {
      setChatMessages(prev => [...prev.slice(-199), {
        id: chatSeqRef.current++, from: '', scope: 'all' as const,
        text: `Unknown command: ${trimmed}`, at: Date.now(),
      }])
      return
    }
    const newMsg: ChatMessage = {
      id: chatSeqRef.current++,
      from: settingsRef.current.playerName,
      scope: cmd.scope,
      target: cmd.target,
      text: cmd.text,
      at: Date.now(),
    }
    setChatMessages(prev => [...prev.slice(-199), newMsg])
    if (data.role === 'client' && data.netClient?.playerId) {
      data.netClient.transport.send({
        type: 'chat',
        playerId: data.netClient.playerId,
        name: settingsRef.current.playerName,
        team: myTeam,
        scope: cmd.scope,
        targetName: cmd.target,
        text: cmd.text,
      })
    } else if (data.role === 'host' && data.netHost) {
      data.netHost.routeChat({
        type: 'chat',
        playerId: data.session.localId,
        name: settingsRef.current.playerName,
        team: data.session.getPlayer(data.session.localId)?.team ?? myTeam,
        scope: cmd.scope,
        targetName: cmd.target,
        text: cmd.text,
      })
    }
  }, [myTeam])
```

- [ ] **Step 4: Wire up key handlers in the big `useEffect`**

Inside the `handleKeyDown` function (in the `useEffect` starting around line 704), add these lines after the `KeyH` handler block (after the `setShowInGameHelp` call, around line 1296):

```ts
      if (gameStateRef.current === 'playing') {
        if (e.code === settingsRef.current.keymap.openChatAll)  { setConsolePrefill('/msg ');      setConsoleOpen(true) }
        if (e.code === settingsRef.current.keymap.openChatTeam) { setConsolePrefill('/msg team '); setConsoleOpen(true) }
        if (e.code === settingsRef.current.keymap.openConsole)  { setConsolePrefill('');           setConsoleOpen(true) }
      }
```

- [ ] **Step 5: Wire up `netHost.onChat` in `hostGame`**

In the `hostGame` callback, after the line `netHost.onClientTeamChanged(...)` (around line 414), add:

```ts
    netHost.onChat((msg) => {
      setChatMessages(prev => [...prev.slice(-199), {
        id: chatSeqRef.current++,
        from: msg.name,
        scope: msg.scope,
        target: msg.targetName,
        text: msg.text,
        at: Date.now(),
      }])
    })
```

- [ ] **Step 6: Wire up `client.onChat` in `joinGame`**

In the `joinGame` callback, after the `client.onSnapshot(...)` line (around line 494), add:

```ts
    client.onChat((msg) => {
      setChatMessages(prev => [...prev.slice(-199), {
        id: chatSeqRef.current++,
        from: msg.name,
        scope: msg.scope,
        target: msg.targetName,
        text: msg.text,
        at: Date.now(),
      }])
    })
```

- [ ] **Step 7: Render `<ChatFeed>` and `<GameConsole>` in the playing state**

In the `{gameState === 'playing' && (...)}` JSX block, add after `<VoiceIndicator speakers={speakers} />` (around line 1568):

```tsx
          <ChatFeed messages={chatMessages} />
          <GameConsole
            open={consoleOpen}
            prefill={consolePrefill}
            messages={chatMessages}
            onSend={handleSend}
            onClose={() => setConsoleOpen(false)}
            playerNames={gameDataRef.current.lastPlayers.map(p => p.name)}
          />
```

- [ ] **Step 8: Type-check and run tests**

```bash
cd /home/user/projects/browser-shooter && npx tsc --noEmit && npm test 2>&1 | tail -15
```

Expected: no TypeScript errors, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat(chat): wire GameConsole and ChatFeed into App"
```

---

### Task 6: KeybindsScreen — Chat & Console section

**Files:**
- Modify: `src/ui/KeybindsScreen.tsx`

**Interfaces:**
- Consumes: `Keymap.openChatAll`, `Keymap.openChatTeam`, `Keymap.openConsole` from Task 1.

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/KeybindsScreen.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { KeybindsScreen } from '../KeybindsScreen'
import { DEFAULT_SETTINGS } from '../../settings/Settings'

afterEach(cleanup)

describe('KeybindsScreen', () => {
  const base = { settings: DEFAULT_SETTINGS, onChange: () => {}, onBack: () => {} }

  it('renders the Chat & Console section with all three bindings', () => {
    render(<KeybindsScreen {...base} />)
    expect(screen.getByText('CHAT & CONSOLE')).toBeInTheDocument()
    expect(screen.getByText('All-chat')).toBeInTheDocument()
    expect(screen.getByText('Team-chat')).toBeInTheDocument()
    expect(screen.getByText('Console')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd /home/user/projects/browser-shooter && npm test -- src/ui/__tests__/KeybindsScreen.test.tsx 2>&1 | tail -15
```

Expected: FAIL — `Unable to find an element with the text: 'CHAT & CONSOLE'`.

- [ ] **Step 3: Add the Chat & Console group to `GROUPS` in `KeybindsScreen.tsx`**

In `src/ui/KeybindsScreen.tsx`, find the `GROUPS` array. Add a new entry after the `COMMUNICATION` group object (after the `pushToTalk` entry closes, around line 63):

```ts
  {
    label: 'CHAT & CONSOLE',
    actions: [
      { key: 'openChatAll', label: 'All-chat' },
      { key: 'openChatTeam', label: 'Team-chat' },
      { key: 'openConsole', label: 'Console' },
    ],
  },
```

- [ ] **Step 4: Run tests**

```bash
cd /home/user/projects/browser-shooter && npm test -- src/ui/__tests__/KeybindsScreen.test.tsx 2>&1 | tail -15
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /home/user/projects/browser-shooter && npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/KeybindsScreen.tsx src/ui/__tests__/KeybindsScreen.test.tsx
git commit -m "feat(chat): add Chat & Console keybinds section to KeybindsScreen"
```

---

## Manual Smoke Test (after all tasks)

1. Start the dev server: `npm run dev`
2. Open the game, start a single-player match.
3. Press `` ` `` — console opens at bottom-left, empty input.
4. Type `/msg hello` and press Enter — message appears in console history and in the HUD feed.
5. Press Escape — console closes. After 8s the HUD feed entry fades.
6. Press `Y` — console opens pre-filled with `/msg `.
7. Press `U` — console opens pre-filled with `/msg team `.
8. Type `/foo bar` — see red error line "Unknown command: /foo bar".
9. Open Settings → Keybinds — see CHAT & CONSOLE section with All-chat/Team-chat/Console.
10. Start a multiplayer host+client in two tabs:
    - Press `Y` in host, type `/msg team hello` — only teammates see it.
    - Press `Y` in client, type `/msg hello` — both host and all clients see it.
    - Press `Y`, type `/msg <hostname> direct` — only the host receives it.
