# CS-Style Team Bots — Design

**Date:** 2026-06-20
**Status:** Approved
**Goal:** Use one model for bots and players, and show bots in the scoreboard the way Counter-Strike does.

## Summary

Add Counter-Strike-style **team bots**: AI-controlled players that join CT or T, use the
same animated humanoid model as human players, fight with the player weapon system, and
appear on the scoreboard with names and K/D. The existing wave-survival `Enemy` system is
left completely untouched and continues to serve co-op mode.

## Key Insight

The simulation already advances **every** player from a `PlayerInput` (see
`GameSession.step`, the `playerMap` loop). A bot is therefore just a `PlayerEntity` whose
`PlayerInput` is produced by an AI controller each tick instead of by keyboard or network.

This means bots automatically inherit, with no duplicate code:

- Movement + collision (`Player.update`)
- The weapon / hit-resolution system (`fireWeapon`, `resolveShot`, `resolvePlayerHit`)
- Scoring, kills, deaths, respawn (`Scoreboard`, `RespawnQueue`)
- The network snapshot (`getSnapshot().players`)
- The player model + limb animation (`RemotePlayerManager` → `RemotePlayer` → `buildCharacter`)
- The scoreboard UI (lists all snapshot players, keyed by id)

## Components

### 1. `BotController` (new — `src/bots/BotController.ts`)

One instance per bot. Pure-ish AI: given the bot's `PlayerEntity` and a read-only view of
the session (other players' positions/teams and `collisionWorld` for line-of-sight), it
returns a `PlayerInput` for the current tick.

Behavior (v1, combat only):

- **Target selection:** nearest *living, enemy-team* player. If none, idle.
- **Aim:** rotate `yaw`/`pitch` toward the target, with a small bounded aim error and a
  reaction delay before opening fire (so bots are beatable — mirrors the telegraph idea in
  `Enemy.updateRanged`).
- **Movement:** set `forward`/`back`/`left`/`right` to advance toward the target, but hold
  at a standoff distance once in range. Straight-line seek; collision sliding is handled by
  `Player.update`. No pathfinding.
- **Fire:** `shoot = true` only when the target is within weapon range, has line of sight
  (`collisionWorld.segmentBlocked` returns null), and aim is roughly on target.
- **No** bomb plant/defuse, **no** buying. (Out of scope for v1.)

The controller holds its own small amount of state (current target id, reaction timer, aim
jitter seed). It does not mutate the session.

### 2. Session bot registry (`GameSession`)

- `PlayerEntity` gains `isBot?: boolean`.
- `GameSession` keeps `private bots = new Map<string, BotController>()`.
- New methods:
  - `addBot(team: Team): PlayerEntity | null` — allocate a bot id (`bot-<n>`), pick the next
    unused name from the CS-style name pool, `addPlayer(...)` with `isBot: true`, give it a
    rifle loadout, register a `BotController`. Returns null if a bot cap is hit.
  - `removeBot(id?: string): void` — remove the given bot (or the most recently added) from
    `playerMap`, `inputs`, and the bot registry.
- In `step()`, **before** the player-advance loop, iterate `bots`; for each, compute its
  input via the controller and call `applyInput(botId, input)`.
- `reset()`/teardown paths clear the bot registry.

Bot names: a fixed pool prefixed `BOT ` (`BOT Wade`, `BOT Cooper`, `BOT Gandhi`, …), assigned
in order and recycled on removal.

### 3. Rendering

Bots are in `snapshot.players`, so they render with the player model via
`RemotePlayerManager`. The host path already does this. We additionally instantiate and
`sync()` a `RemotePlayerManager` in **single-player** so bots (and their limb animation)
render there too. The local human remains first-person (the manager skips `localId`).

### 4. Scoreboard ("like real CS")

- Add `isBot?: boolean` to `EntityState`; `getSnapshot()` sets it from the entity.
- `Scoreboard.tsx`: for a bot row, show `BOT` in the PING column instead of `0 ms`. Name and
  K/D already work via the existing id-keyed `MatchScores`. Rows are colored by team as today.
- No change to `Scoreboard.ts` (backend) — bots are scored through the same id-keyed
  `recordKill`/`recordDeath` as humans.

### 5. Adding/removing bots (authority side only)

New `Controls` callbacks and key bindings, active only for the authoritative session
(single-player or host):

- `[` (`BracketLeft`) → `onAddBot('ct')`
- `]` (`BracketRight`) → `onAddBot('t')`
- `\` (`Backslash`) → `onRemoveBot()` (kick last bot)

Wired in `App.tsx` to call `session.addBot` / `session.removeBot`. Clients do **not** add
bots; they receive bots through the normal snapshot sync. In co-op mode these keys are inert.

### Single-player "choose which to use"

No new menu is required: the existing `MatchSetup` already offers non-co-op modes (pvp /
competitive). Launching one of those single-player and pressing the add-bot keys gives a CS
"vs bots" match. Co-op (wave survival) is launched as today and is unaffected.

## Data Flow

```
keypress [ / ] ──► App ──► session.addBot(team)
                              │  creates PlayerEntity{isBot} + BotController
                              ▼
each step(): for each bot ──► BotController.computeInput(session) ──► applyInput
                              │
                              ▼
            step() advances bots like players (move / aim / shoot)
                              │  kills & deaths ──► Scoreboard (id-keyed)
                              ▼
            getSnapshot().players includes bots (isBot, team, name, K/D)
                              │
              ┌───────────────┴───────────────┐
              ▼                                ▼
   RemotePlayerManager.sync             Scoreboard.tsx
   (player model + animation)           (BOT rows, team color, K/D)
```

## Testing

- **`BotController` unit tests:** selects nearest enemy-team player; aims toward target;
  fires when within range + LOS; holds fire without LOS or before reaction delay; idles with
  no valid target.
- **Session tests:** `addBot` adds to `playerMap` and bot registry with `isBot` + a `BOT `
  name; `removeBot` removes from both; a bot's input is applied during `step`; a bot kill is
  recorded on the scoreboard (victim deaths / attacker kills by id).

## Out of Scope (v1)

- Bot buying / economy participation (bots use a fixed default loadout).
- Bomb plant / defuse AI.
- Pathfinding beyond straight-line seek with collision sliding.
- Per-bot difficulty tuning UI (a single sensible difficulty is hardcoded).

## Non-Goals / Unchanged

- Wave-survival `Enemy`, `WaveManager`, `EnemyModel`, `EnemyDefs` — unchanged.
- Co-op mode behavior — unchanged.
- Network protocol envelope — unchanged except the additive `EntityState.isBot` field.
