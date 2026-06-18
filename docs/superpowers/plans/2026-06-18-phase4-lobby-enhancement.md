# Phase 4: Lobby Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance multiplayer lobby with multiple connection types: keep current room code mode, improve server browser, and add matchmaking as a stretch goal.

**Architecture:** Enhance `MultiplayerMenu` with new layout, add filters to `ServerList`, create `Matchmaker` class for quick match.

**Tech Stack:** TypeScript, React, Vitest

## Global Constraints

- TypeScript strict mode
- React 19
- Vitest for unit tests
- Follow existing code patterns
- No new dependencies

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/ui/MultiplayerMenu.tsx` | New layout with 3 options |
| `src/ui/ServerList.tsx` | Enhanced filters and sort |
| `src/ui/ServerFilters.tsx` | Filter controls component |
| `src/ui/MatchmakingButton.tsx` | Quick match button |
| `src/net/Matchmaker.ts` | Matchmaking client logic |
| `src/net/DirectoryClient.ts` | Mode filtering support |
| `src/session/protocol.ts` | Server entry fields |

---

### Task 1: Create ServerFilters Component

**Files:**
- Create: `src/ui/ServerFilters.tsx`
- Create: `src/ui/__tests__/ServerFilters.test.tsx`

**Interfaces:**
- Consumes: None
- Produces: `ServerFilters` component with mode/status/playerCount filters

- [ ] **Step 1: Write the failing test**

```typescript
// src/ui/__tests__/ServerFilters.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ServerFilters, type ServerFilter } from '../ServerFilters'

describe('ServerFilters', () => {
  it('renders filter controls', () => {
    const onChange = vi.fn()
    render(<ServerFilters filter={{ mode: 'all', status: 'all', playerCount: 'all' }} onChange={onChange} />)
    expect(screen.getByText('Mode')).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
  })

  it('calls onChange when filter changes', () => {
    const onChange = vi.fn()
    render(<ServerFilters filter={{ mode: 'all', status: 'all', playerCount: 'all' }} onChange={onChange} />)
    fireEvent.click(screen.getByText('Competitive'))
    expect.onChange.toHaveBeenCalledWith({ mode: 'competitive', status: 'all', playerCount: 'all' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/ServerFilters.test.tsx`
Expected: FAIL with "Cannot find module '../ServerFilters'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/ui/ServerFilters.tsx
import React from 'react'

export interface ServerFilter {
  mode: 'all' | 'coop' | 'pvp' | 'hybrid' | 'competitive'
  status: 'all' | 'lobby' | 'in-progress'
  playerCount: 'all' | '1-2' | '3-4' | '5+'
}

interface ServerFiltersProps {
  filter: ServerFilter
  onChange: (filter: ServerFilter) => void
}

const btn = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 12,
  background: active ? '#ff6600' : '#1d1d2a',
  color: active ? '#000' : '#fff',
  border: '1px solid #3a3a55',
})

export function ServerFilters({ filter, onChange }: ServerFiltersProps) {
  const modes: { value: ServerFilter['mode']; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'competitive', label: 'Competitive' },
    { value: 'coop', label: 'Co-op' },
    { value: 'pvp', label: 'PvP' },
    { value: 'hybrid', label: 'Hybrid' },
  ]

  const statuses: { value: ServerFilter['status']; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'lobby', label: 'Lobby' },
    { value: 'in-progress', label: 'In Progress' },
  ]

  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontFamily: 'monospace' }}>
      <div>
        <div style={{ fontSize: 10, color: '#8a8aad', marginBottom: 4 }}>Mode</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {modes.map((m) => (
            <button
              key={m.value}
              style={btn(filter.mode === m.value)}
              onClick={() => onChange({ ...filter, mode: m.value })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: '#8a8aad', marginBottom: 4 }}>Status</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {statuses.map((s) => (
            <button
              key={s.value}
              style={btn(filter.status === s.value)}
              onClick={() => onChange({ ...filter, status: s.value })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/ServerFilters.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/ServerFilters.tsx src/ui/__tests__/ServerFilters.test.tsx
git commit -m "feat: add ServerFilters component for server browser"
```

---

### Task 2: Enhance ServerList with Filters

**Files:**
- Modify: `src/ui/ServerList.tsx`
- Modify: `src/ui/__tests__/ServerList.test.tsx`

**Interfaces:**
- Consumes: `ServerFilters` (Task 1)
- Produces: Filtered and sorted server list

- [ ] **Step 1: Write the failing test**

```typescript
// Add to ServerList tests
describe('filtering', () => {
  it('filters servers by mode', () => {
    // Test mode filtering
  })

  it('sorts servers by ping', () => {
    // Test sort functionality
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/ServerList.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/ui/ServerList.tsx
import { useState, useMemo } from 'react'
import { ServerFilters, type ServerFilter } from './ServerFilters'

export interface ServerRow {
  roomCode: string
  hostName: string
  players: number
  maxPlayers: number
  status: 'lobby' | 'in-progress'
  mode?: string
  ping: number | null
}

interface ServerListProps {
  servers: ServerRow[]
  onJoin: (code: string) => void
  onRefresh: () => void
}

export function ServerList({ servers, onJoin, onRefresh }: ServerListProps) {
  const [filter, setFilter] = useState<ServerFilter>({
    mode: 'all',
    status: 'all',
    playerCount: 'all',
  })

  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      if (filter.mode !== 'all' && s.mode !== filter.mode) return false
      if (filter.status !== 'all' && s.status !== filter.status) return false
      if (filter.playerCount === '1-2' && s.players > 2) return false
      if (filter.playerCount === '3-4' && (s.players < 3 || s.players > 4)) return false
      if (filter.playerCount === '5+' && s.players < 5) return false
      return true
    }).sort((a, b) => {
      if (a.ping === null) return 1
      if (b.ping === null) return -1
      return a.ping - b.ping
    })
  }, [servers, filter])

  return (
    <div style={{ fontFamily: 'monospace' }}>
      <ServerFilters filter={filter} onChange={setFilter} />

      <div style={{ border: '1px solid #3a3a55', background: '#1a1a2e' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 60px 80px', padding: '8px 12px', borderBottom: '1px solid #3a3a55', fontSize: 12, color: '#8a8aad' }}>
          <div>Server</div>
          <div>Mode</div>
          <div>Players</div>
          <div>Ping</div>
          <div></div>
        </div>

        {filteredServers.map((server) => (
          <div key={server.roomCode} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 60px 80px', padding: '8px 12px', borderBottom: '1px solid #3a3a55', fontSize: 14 }}>
            <div>{server.hostName}</div>
            <div>{server.mode ?? 'Unknown'}</div>
            <div>{server.players}/{server.maxPlayers}</div>
            <div>{server.ping !== null ? `${server.ping}ms` : '...'}</div>
            <button
              onClick={() => onJoin(server.roomCode)}
              style={{ padding: '4px 8px', background: '#3399ff', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}
            >
              Join
            </button>
          </div>
        ))}

        {filteredServers.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: '#8a8aad' }}>
            No servers found
          </div>
        )}
      </div>

      <button onClick={onRefresh} style={{ marginTop: 8, padding: '6px 12px', background: '#3a3a55', color: '#fff', border: 'none', cursor: 'pointer' }}>
        Refresh
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/ServerList.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/ServerList.tsx
git commit -m "feat: enhance ServerList with filters and sort"
```

---

### Task 3: Create Matchmaker Class

**Files:**
- Create: `src/net/Matchmaker.ts`
- Create: `src/net/__tests__/Matchmaker.test.ts`

**Interfaces:**
- Consumes: `DirectoryClient`
- Produces: `Matchmaker` class for quick match

- [ ] **Step 1: Write the failing test**

```typescript
// src/net/__tests__/Matchmaker.test.ts
import { describe, it, expect, vi } from 'vitest'
import { Matchmaker } from '../Matchmaker'

describe('Matchmaker', () => {
  it('can find a match', async () => {
    const matchmaker = new Matchmaker()
    // Mock directory client
    const mockClient = {
      fetchList: vi.fn().mockResolvedValue([
        { roomCode: 'test', hostName: 'Test', players: 2, maxPlayers: 8, status: 'lobby', mode: 'competitive' }
      ])
    }
    const result = await matchmaker.findMatch(mockClient as any)
    expect(result).toBeDefined()
    expect(result!.roomCode).toBe('test')
  })

  it('returns null when no servers available', async () => {
    const matchmaker = new Matchmaker()
    const mockClient = {
      fetchList: vi.fn().mockResolvedValue([])
    }
    const result = await matchmaker.findMatch(mockClient as any)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/Matchmaker.test.ts`
Expected: FAIL with "Cannot find module '../Matchmaker'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/net/Matchmaker.ts
import type { DirectoryClient } from './DirectoryClient'

interface MatchPreferences {
  mode?: string
  maxPing?: number
}

interface ServerEntry {
  roomCode: string
  hostName: string
  players: number
  maxPlayers: number
  status: string
  mode?: string
}

export class Matchmaker {
  private queue: boolean = false

  async findMatch(
    client: DirectoryClient,
    preferences: MatchPreferences = {}
  ): Promise<ServerEntry | null> {
    this.queue = true

    try {
      const servers = await client.fetchList()

      // Filter for available servers
      const available = servers.filter((s) => {
        if (s.status !== 'lobby') return false
        if (s.players >= s.maxPlayers) return false
        if (preferences.mode && s.mode !== preferences.mode) return false
        return true
      })

      if (available.length === 0) return null

      // Sort by player count (prefer fuller servers for better games)
      available.sort((a, b) => b.players - a.players)

      return available[0]
    } finally {
      this.queue = false
    }
  }

  cancel(): void {
    this.queue = false
  }

  isQueued(): boolean {
    return this.queue
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/Matchmaker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/net/Matchmaker.ts src/net/__tests__/Matchmaker.test.ts
git commit -m "feat: add Matchmaker class for quick match"
```

---

### Task 4: Create MatchmakingButton Component

**Files:**
- Create: `src/ui/MatchmakingButton.tsx`
- Create: `src/ui/__tests__/MatchmakingButton.test.tsx`

**Interfaces:**
- Consumes: `Matchmaker` (Task 3)
- Produces: Quick match button with queue status

- [ ] **Step 1: Write the failing test**

```typescript
// src/ui/__tests__/MatchmakingButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchmakingButton } from '../MatchmakingButton'

describe('MatchmakingButton', () => {
  it('renders quick match button', () => {
    const onFind = vi.fn()
    render(<MatchmakingButton onFind={onFind} queuing={false} />)
    expect(screen.getByText('Quick Match')).toBeDefined()
  })

  it('shows queuing state', () => {
    const onCancel = vi.fn()
    render(<MatchmakingButton onCancel={onCancel} queuing={true} />)
    expect(screen.getByText('Searching...')).toBeDefined()
    expect(screen.getByText('Cancel')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/MatchmakingButton.test.tsx`
Expected: FAIL with "Cannot find module '../MatchmakingButton'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/ui/MatchmakingButton.tsx
import React from 'react'

interface MatchmakingButtonProps {
  onFind?: () => void
  onCancel?: () => void
  queuing: boolean
}

export function MatchmakingButton({ onFind, onCancel, queuing }: MatchmakingButtonProps) {
  const btn: React.CSSProperties = {
    padding: '16px 32px',
    fontSize: 18,
    fontWeight: 'bold',
    background: queuing ? '#ff6600' : '#3399ff',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    width: '100%',
  }

  return (
    <button
      style={btn}
      onClick={queuing ? onCancel : onFind}
    >
      {queuing ? 'Searching... (Click to Cancel)' : 'Quick Match'}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/MatchmakingButton.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/MatchmakingButton.tsx src/ui/__tests__/MatchmakingButton.test.tsx
git commit -m "feat: add MatchmakingButton component for quick match"
```

---

### Task 5: Redesign MultiplayerMenu Layout

**Files:**
- Modify: `src/ui/MultiplayerMenu.tsx`

**Interfaces:**
- Consumes: `MatchmakingButton`, `ServerFilters`
- Produces: New 3-option layout

- [ ] **Step 1: Write the failing test**

```typescript
// Add to MultiplayerMenu tests
describe('new layout', () => {
  it('shows three options', () => {
    // Test that all three options are visible
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/MultiplayerMenu.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/ui/MultiplayerMenu.tsx
import { MatchmakingButton } from './MatchmakingButton'

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = (p) => {
  const [code, setCode] = useState('')
  const [queuing, setQueuing] = useState(false)
  const inLobby = p.roomCode !== null || p.players.length > 0

  if (inLobby) {
    // ... existing lobby code (unchanged)
  }

  return (
    <div style={panel}>
      <div style={panelInner}>
        <h2>Multiplayer</h2>

        {/* Quick Match */}
        <div style={{ width: '100%', maxWidth: 400 }}>
          <MatchmakingButton
            queuing={queuing}
            onFind={() => {
              setQueuing(true)
              // TODO: Integrate with Matchmaker
            }}
            onCancel={() => setQueuing(false)}
          />
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4, textAlign: 'center' }}>
            Auto-find a competitive match
          </p>
        </div>

        {/* Browse Servers */}
        <div style={{ width: '100%', maxWidth: 600 }}>
          <ServerList servers={p.servers} onJoin={p.onJoin} onRefresh={p.onRefresh} />
        </div>

        {/* Create Room */}
        <div style={{ width: '100%', maxWidth: 400, borderTop: '1px solid #3a3a55', paddingTop: 16 }}>
          <button style={btn} onClick={p.onHost}>Create Room</button>
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4, textAlign: 'center' }}>
            Host your own game
          </p>
        </div>

        {/* Room Code Join */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input placeholder="Room code" value={code} onChange={(e) => setCode(e.target.value)}
            style={{ padding: 10, fontSize: 16 }} />
          <button style={btn} onClick={() => { if (code.trim()) p.onJoin(code.trim()) }}>Join</button>
        </div>

        <button style={{ ...btn, background: '#555' }} onClick={p.onBack}>Back</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/MultiplayerMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/MultiplayerMenu.tsx
git commit -m "feat: redesign MultiplayerMenu with 3 connection options"
```

---

### Task 6: Update DirectoryClient for Mode Filtering

**Files:**
- Modify: `src/net/DirectoryClient.ts`

**Interfaces:**
- Consumes: None
- Produces: Mode field in server entries

- [ ] **Step 1: Write the failing test**

```typescript
// Add to DirectoryClient tests
describe('mode filtering', () => {
  it('includes mode in server entries', () => {
    // Test that mode is included
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/DirectoryClient.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/net/DirectoryClient.ts
interface ServerEntry {
  roomCode: string
  hostName: string
  players: number
  maxPlayers: number
  status: 'lobby' | 'in-progress'
  mode?: string  // Add mode field
}

// In fetchList method, include mode from server data
async fetchList(): Promise<ServerEntry[]> {
  const entries = await this.client.fetchList()
  return entries.map((e) => ({
    ...e,
    mode: e.mode ?? 'unknown',
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/DirectoryClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/net/DirectoryClient.ts
git commit -m "feat: add mode field to DirectoryClient server entries"
```

---

### Task 7: Update Protocol with Mode Field

**Files:**
- Modify: `src/session/protocol.ts`

**Interfaces:**
- Consumes: None
- Produces: Mode in welcome/join messages

- [ ] **Step 1: Write the failing test**

```typescript
// Add to protocol tests
describe('mode in protocol', () => {
  it('welcome message includes mode', () => {
    // Test welcome message type
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/session/__tests__/protocol.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Update src/session/protocol.ts NetMessage type
export type NetMessage =
  // ... existing messages
  | { type: 'welcome'; playerId: string; mode: GameMode; config: MatchConfig; players: string[] }
```

This is already defined, just ensure mode is passed through correctly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/session/__tests__/protocol.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/protocol.ts
git commit -m "feat: ensure mode is included in protocol messages"
```

---

### Task 8: Integrate Matchmaker into App.tsx

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Matchmaker`, `MatchmakingButton`
- Produces: Working quick match flow

- [ ] **Step 1: Write the failing test**

```typescript
// No unit test - integration testing
```

- [ ] **Step 2: Add matchmaker state and logic**

```typescript
// In src/App.tsx
import { Matchmaker } from './net/Matchmaker'

const matchmakerRef = useRef(new Matchmaker())

const handleQuickMatch = useCallback(async () => {
  const dialed = await dialDirectory()
  if (!dialed) return

  const match = await matchmakerRef.current.findMatch(dialed.client)
  dialed.peer.destroy()

  if (match) {
    joinGame(match.roomCode)
  } else {
    // No servers available, create new room
    setShowMatchSetup(true)
  }
}, [joinGame])
```

- [ ] **Step 3: Pass handler to MultiplayerMenu**

```typescript
<MultiplayerMenu
  // ... existing props
  onQuickMatch={handleQuickMatch}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate Matchmaker into game UI"
```

---

### Task 9: E2E Test for Lobby Enhancement

**Files:**
- Create: `e2e/lobby-enhancement.spec.ts`

**Interfaces:**
- Consumes: All previous tasks
- Produces: E2E test for new lobby

- [ ] **Step 1: Write the E2E test**

```typescript
// e2e/lobby-enhancement.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Lobby Enhancement', () => {
  test('shows three connection options', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Multiplayer')
    await expect(page.locator('text=Quick Match')).toBeVisible()
    await expect(page.locator('text=Create Room')).toBeVisible()
  })

  test('server browser shows filters', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Multiplayer')
    await expect(page.locator('text=Mode')).toBeVisible()
    await expect(page.locator('text=Status')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run E2E test**

Run: `npx playwright test e2e/lobby-enhancement.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/lobby-enhancement.spec.ts
git commit -m "test: add E2E tests for lobby enhancement"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test**

1. Start dev server
2. Go to Multiplayer menu
3. Verify Quick Match button appears
4. Verify Create Room button appears
5. Verify server browser shows with filters
6. Click mode filter - verify filtering works
7. Test Quick Match flow (should find server or create room)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 4 lobby enhancement"
```

---

## Summary

| Task | Deliverable | Tests |
|------|-------------|-------|
| 1 | ServerFilters component | Component tests |
| 2 | ServerList enhancement | Component tests |
| 3 | Matchmaker class | Unit tests |
| 4 | MatchmakingButton component | Component tests |
| 5 | MultiplayerMenu redesign | Component tests |
| 6 | DirectoryClient update | Unit tests |
| 7 | Protocol update | Type tests |
| 8 | App.tsx integration | Integration |
| 9 | E2E tests | E2E tests |
| 10 | Final verification | All tests |

**Total estimated time:** 2-3 hours for experienced developer
