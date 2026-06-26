# Game Console & Chat Design

**Date:** 2026-06-26

## Overview

Add a CS-style in-game console and text chat system. Players open it with `Y` (all-chat), `U` (team-chat), or `` ` `` (raw console). Messages are typed as commands (`/msg hello`, `/msg team hello`, `/msg player1 hello`) and appear both in a fading HUD feed and in the scrollable console history.

---

## 1. Network Protocol

Add one new variant to `NetMessage` in `src/session/protocol.ts`:

```ts
| { type: 'chat'; playerId: string; name: string; team: Team; scope: 'all' | 'team' | 'player'; targetName?: string; text: string }
```

### Host routing (NetHost)

| `scope`    | Recipients                                              |
|------------|---------------------------------------------------------|
| `'all'`    | All connected clients + host itself                     |
| `'team'`   | Clients whose team matches the sender's team + host if same team |
| `'player'` | The single client whose player name equals `targetName` |

In single-player mode there is no network; the message goes directly into the local `chatMessages` state.

---

## 2. Command Grammar

Parsed in App.tsx `handleSend(text: string)`:

```
/msg team <text>        → scope: 'team'
/msg <playerName> <text> → scope: 'player', targetName: <playerName>
                           (only if first word matches a name in playerNames[])
/msg <text>             → scope: 'all'
<anything else>         → push error line "unknown command" into local history only
```

`playerNames` is derived from the latest snapshot's player list.

---

## 3. Data Types

Both components live in `src/ui/GameConsole.tsx`. The `ChatMessage` type is exported for use in App.tsx.

```ts
export interface ChatMessage {
  id: number
  from: string
  scope: 'all' | 'team' | 'player'
  target?: string   // defined when scope === 'player'
  text: string
  at: number        // Date.now() — used by ChatFeed for fade-out
}
```

### Display colours

| Scope / kind | Colour        |
|--------------|---------------|
| `'all'`      | `#ffffff`     |
| `'team'`     | `#7bc87b`     |
| `'player'`   | `#f0c060`     |
| Error line   | `#ff6060`     |

---

## 4. `<GameConsole>` Component

**File:** `src/ui/GameConsole.tsx`

CS-style overlay anchored to the bottom-left. Semi-transparent dark background. Scrollable message history above a command input bar. Closes on `Escape` or `` ` ``.

```ts
interface GameConsoleProps {
  open: boolean
  prefill: string          // applied each time open flips true; '' for raw console
  messages: ChatMessage[]
  onSend: (text: string) => void
  onClose: () => void
  playerNames: string[]    // for DM target validation display (not blocking)
}
```

Behaviour:
- When `open` becomes `true`: set input value to `prefill`, focus the input, call `document.exitPointerLock()`.
- On Enter: call `onSend(inputValue)`, clear input, keep console open.
- On `Escape` or `` ` ``: call `onClose()`.
- `pointerEvents: auto` while open so typing doesn't bleed into game controls.
- History auto-scrolls to bottom on new messages.

Layout: occupies roughly the left 40% of the screen, bottom half. History is scrollable; input is always visible at the very bottom.

---

## 5. `<ChatFeed>` Component

**File:** `src/ui/GameConsole.tsx` (same file, separate export)

Lightweight HUD overlay, bottom-left, always rendered during gameplay. Shows the last 6 `ChatMessage` entries. Each line fades out 8 seconds after its `at` timestamp. `pointerEvents: none`.

Format per line:
```
[TEAM] PlayerName: hello        ← team-chat, green prefix
[DM→player1] PlayerName: hi     ← DM, gold prefix
PlayerName: hello               ← all-chat, no prefix
```

---

## 6. App.tsx Changes

### New state

```ts
const [consoleOpen, setConsoleOpen] = useState(false)
const [consolePrefill, setConsolePrefill] = useState('')
const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
const chatSeqRef = useRef(0)
```

### Key handlers (added to existing `handleKeyDown`)

Only active when `gameState === 'playing'`. Keys are checked against `settingsRef.current.keymap` so they respect user remapping:

```ts
if (e.code === settingsRef.current.keymap.openChatAll)  { setConsolePrefill('/msg ');      setConsoleOpen(true) }
if (e.code === settingsRef.current.keymap.openChatTeam) { setConsolePrefill('/msg team '); setConsoleOpen(true) }
if (e.code === settingsRef.current.keymap.openConsole)  { setConsolePrefill('');           setConsoleOpen(true) }
```

No new callbacks needed in `Controls.ts` — these are UI state toggles, not game input. `document.exitPointerLock()` is called inside `<GameConsole>` when it mounts open.

### `handleSend(text: string)`

1. Strip whitespace. If empty, close console.
2. Parse command per §2 grammar.
3. Build `ChatMessage` with `id: chatSeqRef.current++`, `at: Date.now()`.
4. Push to `chatMessages`.
5. If multiplayer: send `{ type: 'chat', ... }` via `netClient.transport.send` (client) or `netHost.routeChat(msg)` (host).
6. If single-player: no network step needed.

### `playerNames` derivation

```ts
const playerNames = gameDataRef.current.lastPlayers.map(p => p.name)
```

Passed to `<GameConsole>` and used in command parsing.

### Receiving chat (client)

In the `client.onEvent` handler (or a new `client.onChat` callback on `NetClient`), push incoming messages into `chatMessages`.

### Receiving chat (host)

After routing, the host also receives its own relayed messages and pushes them into `chatMessages`.

---

## 7. NetHost Routing

Add `routeChat(msg: NetMessage & { type: 'chat' })` to `NetHost`:

- Looks up sender's team from the active session.
- Routes per the table in §1.
- The host player itself receives all messages addressed to them (host is always a player).

Add a handler in the incoming-message switch in `NetHost` for `msg.type === 'chat'` that calls `routeChat`.

---

## 8. NetClient

Add a `private chatCb` field and `onChat(cb: (msg: ChatMessage) => void)` method to `NetClient`, matching the existing callback pattern (`onSnapshot`, `onPlayerJoined`, etc.). In the `handle(msg)` switch, add a `'chat'` case that converts the NetMessage to a `ChatMessage` and calls `chatCb`.

---

## 9. Keybinds

### `src/settings/Settings.ts`

Add three keys to the `Keymap` type and default keymap:

```ts
openChatAll:  'KeyY'
openChatTeam: 'KeyU'
openConsole:  'Backquote'
```

### `src/player/Controls.ts`

Add `onOpenChatAll`, `onOpenChatTeam`, `onOpenConsole` callbacks. Wire to the new keymap entries.

### `src/ui/KeybindsScreen.tsx`

Add a "Chat & Console" section with entries for the three new bindings.

---

## 10. Out of Scope

- Tab-completion of player names
- Scrollback history persisted across sessions
- Console commands other than `/msg`
- Mobile touch UI for chat
