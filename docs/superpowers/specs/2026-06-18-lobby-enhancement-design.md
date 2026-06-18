# Lobby Enhancement Design

**Date:** 2026-06-18
**Phase:** 4 of 4
**Status:** Approved

---

## Overview

Enhance the multiplayer lobby system with multiple connection types: keep current room code mode, improve server browser, and add matchmaking as a stretch goal. Builds on Phase 1-3 being stable.

## Goals

- Keep current room code / host + join mode as-is
- Enhance server browser with filters and better UX
- Add quick match matchmaking (auto-find game, auto-assign teams)
- Unified lobby UI with clear mode selection
- Matchmaking as stretch goal (requires server infrastructure)

---

## Lobby Types

### 1. Current Mode (Room Code)

**Keep as-is:**
- Host creates room, gets a code
- Share code with friends
- Players join via code or server list
- Full control over match settings

**No changes needed** — this already works.

### 2. Server Browser (Enhanced)

**Current State:**
- `ServerList.tsx` exists with basic server list
- `DirectoryClient.ts` fetches server list
- Ping measurement already implemented

**Enhancements:**

| Feature | Description |
|---------|-------------|
| Mode filter | Filter by game mode (competitive, casual, co-op) |
| Player count | Show current/max players per server |
| Map info | Show map name per server (future: multiple maps) |
| Status filter | Show only servers in lobby (not in-progress) |
| Quick join | One-click join button per server |
| Refresh | Auto-refresh every 10 seconds |
| Sort | Sort by ping, players, or name |

**UI Layout:**
```
┌─────────────────────────────────────────┐
│  SERVER BROWSER                         │
├─────────────────────────────────────────┤
│  Filter: [All ▼] [Mode ▼] [Status ▼]   │
│  Sort:   [Ping ▼]                       │
├─────────────────────────────────────────┤
│  Server Name      Mode    Players  Ping │
│  ─────────────────────────────────────  │
│  [CS Server 1]    Comp    4/8     23ms  │
│  [Fun Server]     Co-op   2/4     45ms  │
│  [Pro Match]      Comp    6/8     12ms  │
├─────────────────────────────────────────┤
│  [JOIN] [REFRESH] [BACK]                │
└─────────────────────────────────────────┘
```

### 3. Matchmaking (Stretch Goal)

**Concept:**
- Player clicks "Quick Match"
- System finds an available server with open slots
- Auto-assigns to balanced team
- Starts match when enough players join

**Requirements:**
- Matchmaking server/relay (not implemented yet)
- Skill rating system (future)
- Server capacity tracking

**Implementation (Minimal):**
- For now: auto-join any available competitive server
- If no servers available: create new room and wait
- Auto-assign teams based on balance

---

## UI Flow

### Main Menu Update

```
Main Menu
├── Singleplayer
├── Multiplayer
│   ├── Quick Match (NEW - matchmaking)
│   ├── Browse Servers (ENHANCED)
│   └── Create Room (CURRENT)
├── Settings
└── About / Help
```

### Multiplayer Menu Redesign

```
┌─────────────────────────────────────────┐
│  MULTIPLAYER                            │
├─────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐      │
│  │ QUICK MATCH │  │  BROWSE     │      │
│  │ Auto-find   │  │  SERVERS    │      │
│  │ a game      │  │  Pick one   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ CREATE ROOM                     │   │
│  │ Host your own game              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [BACK]                                │
└─────────────────────────────────────────┘
```

---

## Server Browser Enhancements

### Filter System

**Mode Filter:**
- All modes
- Competitive
- Co-op
- Hybrid
- PvP

**Status Filter:**
- All statuses
- Lobby (waiting for players)
- In-progress (mid-match)
- Full (skip full servers)

**Player Count Filter:**
- Any
- 1-2 players
- 3-4 players
- 5+ players

### Sort Options

| Sort By | Description |
|---------|-------------|
| Ping | Lowest ping first |
| Players | Most players first |
| Name | Alphabetical |
| Mode | Group by game mode |

### Auto-Refresh

- Refresh server list every 10 seconds
- Show "Last updated: Xs ago" indicator
- Manual refresh button

### Quick Join

- Click server row → instantly join
- Show connection status (connecting, waiting, joined)
- Auto-close server browser on successful join

---

## Matchmaking Implementation (Stretch)

### Minimal Version

1. Player clicks "Quick Match"
2. System queries server list for:
   - Competitive mode
   - In lobby state
   - Not full (< 8 players)
3. If available: auto-join best server (lowest ping)
4. If none available: create new room and wait
5. Auto-assign to smaller team

### Future Enhancements

- Skill rating (ELO/Glicko)
- Queue timer
- Estimated wait time
- Rank display
- Seasonal rewards

---

## Network Protocol Changes

### Server List Updates

```typescript
interface ServerEntry {
  roomCode: string
  hostName: string
  players: number
  maxPlayers: number
  status: 'lobby' | 'in-progress' | 'full'
  mode: GameMode          // NEW: game mode filter
  map?: string            // FUTURE: map name
}
```

### Matchmaking Events (Stretch)

```typescript
| { type: 'matchmakingQueue'; estimatedWait: number }
| { type: 'matchmakingFound'; server: ServerEntry }
| { type: 'matchmakingCancelled' }
```

---

## Implementation Details

### ServerList Enhancements

```typescript
interface ServerListProps {
  servers: ServerRow[]
  onJoin: (code: string) => void
  onRefresh: () => void
  filter?: ServerFilter    // NEW: filter state
  sort?: ServerSort        // NEW: sort state
}

interface ServerFilter {
  mode: GameMode | 'all'
  status: 'all' | 'lobby' | 'in-progress'
  playerCount: 'all' | '1-2' | '3-4' | '5+'
}

interface ServerSort {
  by: 'ping' | 'players' | 'name' | 'mode'
  direction: 'asc' | 'desc'
}
```

### Matchmaking Client

```typescript
class Matchmaker {
  private queue: boolean = false
  private estimatedWait: number = 0

  async findMatch(preferences: MatchPreferences): Promise<ServerEntry | null> {
    // Query servers matching preferences
    // Return best match or null
  }

  cancel(): void {
    this.queue = false
  }
}
```

---

## UI Components

### New Components

- `src/ui/MatchmakingButton.tsx` — Quick match button with queue status
- `src/ui/ServerFilters.tsx` — Filter controls for server browser

### Modified Components

- `src/ui/MultiplayerMenu.tsx` — New layout with 3 options
- `src/ui/ServerList.tsx` — Enhanced with filters and sort

---

## Testing Strategy

- Unit tests for ServerFilter logic
- Unit tests for ServerSort logic
- Unit tests for Matchmaker (mock server list)
- Integration test for server browser flow
- Integration test for matchmaking flow
- E2E test for quick match join

---

## Dependencies

- Phase 1: Competitive Round System (match mode)
- Phase 2: Bomb Sites (objective mode)
- Phase 3: New Items (bomb/kit mechanics)

## Deliverables

- `src/ui/MatchmakingButton.tsx`
- `src/ui/ServerFilters.tsx`
- Updated `src/ui/MultiplayerMenu.tsx`
- Updated `src/ui/ServerList.tsx`
- Updated `src/net/DirectoryClient.ts`
- Updated `src/session/protocol.ts` (server entry fields)
- Tests for all new modules
