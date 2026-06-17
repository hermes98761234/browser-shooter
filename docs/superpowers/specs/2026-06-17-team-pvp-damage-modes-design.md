# Team Selection + PvP Damage Modes — Design

**Date:** 2026-06-17
**Status:** Approved (ready for implementation plan)
**Approach:** Match-rules layer inside `GameSession`, host-authoritative, built on the current netcode with an M2 lag-compensation seam.

## Summary

Make team selection a real gameplay mechanic and add player-vs-player combat. The host chooses a **game mode** and a **damage policy** when starting a match; players pick a team in a lobby; players can damage other players according to the policy; killed players respawn after a delay; teams accumulate score toward a frag limit and a winner is declared.

Today `Team = 'ct' | 't'` exists but is cosmetic (it only filters the weapon store). There is no player-vs-player damage; damage flows only players → AI enemies and enemies → players. `GameMode = 'coop' | 'pvp'` is typed but `'pvp'` is unused. This feature wires teams through to the simulation and adds the PvP rules, scoring, and UI on top.

## Requirements

- **3 host-selectable game modes** at match start:
  - **Co-op** — existing behaviour: AI waves, no PvP.
  - **Team PvP** — teams fight each other, no AI enemies spawn.
  - **Hybrid** — AI waves spawn *and* players can damage other teams.
- **3 host-selectable damage policies** (apply to PvP/Hybrid):
  - **Opposite-team-only** (`team`) — you can only hurt the enemy team.
  - **Friendly-fire-on** (`friendly`) — you can hurt anyone, including teammates; teammate kills are penalized.
  - **Free-for-all** (`ffa`) — everyone can damage everyone; every kill scores normally.
- **Team picking** in a lobby before spawn; re-pickable until the host starts the match.
- **PvP damage** against players, fully host-authoritative.
- **Respawn after a delay** (~3s) at a team spawn point with full health.
- **Team score + frag limit** → win screen → reset to lobby. `fragLimit: 0` = endless.

## Architecture

Approach A: a **match-rules layer** owned by `GameSession`. PvP logic is centralized and unit-testable; `GameSession` remains the single authority over player health, death, scoring, and respawn. UI is a pure projection of host state delivered via snapshots.

### Data model

```ts
type DamagePolicy = 'team' | 'friendly' | 'ffa'
type GameMode = 'coop' | 'pvp' | 'hybrid'

interface MatchConfig {
  mode: GameMode
  damagePolicy: DamagePolicy   // ignored when mode === 'coop'
  fragLimit: number            // team score to win; 0 = endless
}
```

**Team plumbing.** `Team = 'ct' | 't'` is threaded end-to-end:
- `EntityState` (snapshot) gains `team?: Team`.
- `GameSession`'s player entity gains a `team: Team` field.
- Flow: lobby UI → `join` message (clients) / local state (host) → `NetHost.addClient` → session player entity → snapshot → all clients render team colors.

**Pure damage rule** (no networking; the single most important unit to test):

```ts
function canDamage(attacker: Team, target: Team, policy: DamagePolicy): boolean {
  if (policy === 'ffa') return true
  if (policy === 'friendly') return true      // any player, any team
  return attacker !== target                  // 'team': opposite only
}
```

`friendly` and `ffa` resolve player-vs-player *damage* identically. They differ in **scoring** (see below): under `friendly`, teams stay meaningful and teammate kills are penalized; under `ffa`, every player is fair game and every kill scores normally.

## Components

| Module | Responsibility |
|---|---|
| `src/session/MatchConfig.ts` *(new)* | `MatchConfig`/`DamagePolicy`/`GameMode` types, `canDamage()` pure function, default config. Zero deps. |
| `src/session/Scoreboard.ts` *(new)* | Per-player K/D, per-team totals, `recordKill()`, `teamReachedLimit()`. Pure data + methods. |
| `src/session/Spawns.ts` *(new)* | Per-team spawn points for the map; `pickSpawn(team)` with fallback. |
| `src/session/RespawnQueue.ts` *(new)* | Tracks dead players + respawn timers; emits respawn when a timer elapses. |
| `src/session/GameSession.ts` *(edit)* | Holds `MatchConfig`, scoreboard, respawn queue; extends `resolveShot()` to hit players and apply `canDamage`. |
| `src/net/NetHost.ts` *(edit)* | Carries `MatchConfig`, sends it in `welcome`, includes scores in snapshot, validates client team. |
| `src/net/NetClient.ts` *(edit)* | Reads config + scores from messages/snapshots. |
| `src/session/protocol.ts` *(edit)* | `EntityState.team`; snapshot `scores`; `MatchConfig` in `welcome`; `setTeam` message; `playerKilledPlayer` / `matchOver` events. |
| UI components | Host setup, lobby roster, scoreboard/kill-feed, respawn overlay, win screen, team colors. |

## Data flow (host-authoritative, one direction)

```
Host Match Setup ─► MatchConfig ─► NetHost
        │
clients join ─► team pick ─► host assigns team ─► session player.team
        │
host sim: inputs ─► resolveShot ─► canDamage ─► damage/kill ─► scoreboard/respawn
        │
snapshot { players(+team,health), enemies, scores, events } ─► all clients ─► UI render
```

Clients never compute hits, scores, or respawns. They render a projection of host state.

## PvP hit resolution

`resolveShot()` today raycasts AI enemies only. It is extended to raycast **both enemies and other players' character models**, choose the nearest blocking-aware hit, and for a player target:

```
on player-target hit:
  if mode == 'coop'                                   -> ignore (no PvP)
  else if !canDamage(shooterTeam, targetTeam, policy) -> ignore
  else:
    apply zonedDamage to target player
    if killed:
      scoreboard.recordKill(shooterId, targetId)
      respawnQueue.enqueue(targetId, RESPAWN_DELAY)
      emit 'playerKilledPlayer' event (kill feed)
      if scoreboard.teamReachedLimit(fragLimit) -> emit 'matchOver'
```

Because the host already simulates every player's shots (it applies each client's inputs to drive their player in the session), PvP resolution is automatically authoritative and cheat-resistant.

**M2 seam.** The player-target raycast is factored into one helper (`resolvePlayerHit`) so M2 lag-compensation can later rewind player positions to the shooter's view by wrapping just that call. This feature does **not** block on M2; until then, PvP hits carry ~1 RTT of lag with no lag compensation.

## Respawn

1. Player dies → `RespawnQueue.enqueue(playerId, RESPAWN_DELAY)` (default ~3s).
2. The dead entity stays in the world marked `isDead`; the local dead player sees a "Respawning in N…" overlay, others see them down/hidden.
3. Each tick `GameSession` decrements timers; on elapse it repositions the player at `Spawns.pickSpawn(team)`, restores full health/armor, clears `isDead`.
4. Respawn is reflected in the next snapshot — no special message needed.

## Scoring

`Scoreboard` tracks per-player `kills`/`deaths` and per-team `ct`/`t` totals.

`recordKill(attackerId, victimId)`:
- **Enemy-team kill** → +1 attacker kills, +1 attacker's team score, +1 victim deaths.
- **Self-kill / teammate kill** (possible under `friendly`) → +1 victim deaths, attacker kills **−1**, no team-score gain. Discourages teamkilling.
- **`ffa`** → every kill counts to the attacker's team score (teams still exist as spawn groups); every kill is valid.

## Win + reset

- After each kill, check `teamReachedLimit(fragLimit)`. If reached → emit `matchOver { winningTeam, finalScores }`.
- Host freezes scoring, broadcasts `matchOver`; all clients show a **win screen** with the final scoreboard.
- **Reset:** host returns everyone to the lobby/team-select state (scores cleared, players re-pick teams, host can adjust config) before starting the next match. No automatic round restarts.
- `fragLimit: 0` (endless) skips the win check — pure kill-feed + scoreboard play.

## UI

- **Host Match Setup** (before `peerHost.start()`): mode (Co-op / Team PvP / Hybrid), damage policy (hidden/disabled when mode = Co-op), frag limit (e.g. 10/30/50/Endless). Produces the `MatchConfig` passed to `new NetHost(session, config)`.
- **Lobby team select** (extend `src/ui/TeamSelect.tsx`): both team rosters (names from lobby/snapshot state) + CT/T buttons. Re-pickable until the host clicks **Start Match**. Team choice sent via `join` (initial) and `setTeam` (change in lobby); host is authoritative over assignment.
- **Scoreboard** (hold Tab): per-team score + per-player K/D, read from snapshot.
- **Kill feed**: transient lines from `playerKilledPlayer` events in the snapshot `events` array (M2 snapshot already bundles events).
- **Respawn overlay**: "Respawning in N…" when the local player is dead.
- **Win screen**: on `matchOver` — winning team, final scoreboard, "back to lobby."
- **Team visual identity**: color remote `CharacterModel`s and nameplates by team (CT blue / T orange-red) so friend vs foe is instantly readable.

## Error handling & edge cases

- **Late joiners mid-match.** `welcome` carries current `MatchConfig` + scores; joiner enters the lobby, picks a team, then spawns immediately into the running match (default).
- **Team imbalance.** No auto-balance (free lobby picking was chosen); the lobby shows team counts for self-balancing. Auto-balance is a noted future option, out of scope.
- **Invalid/missing team from a client.** Host validates `team` on `join`/`setTeam`; anything not `'ct'|'t'` defaults to the smaller team. Damage can't be spoofed since hits are host-resolved.
- **Coop safety.** When `mode === 'coop'`, the player-target branch in `resolveShot` is skipped entirely — zero behaviour change to existing co-op.
- **Self-damage / suicide.** Counts as a death, no kill credit; respawn normally.
- **Disconnect while dead/queued.** `RespawnQueue` and `Scoreboard` drop entries for removed players in `NetHost`'s existing client-removal path.
- **Frag limit during a multi-kill.** Win check runs after each `recordKill`; first team to the limit wins; further kills ignored once `matchOver` fired.
- **No spawn points for a map.** `Spawns.pickSpawn` falls back to the existing single-player spawn with a small random offset, so PvP works on any map.

## Testing strategy

**Unit (pure, fast — Vitest):**
- `canDamage()` — full truth table: `team`/`friendly`/`ffa` × same/opposite team.
- `Scoreboard` — enemy kill, teammate-kill penalty (`friendly`), self-kill, `ffa` scoring, `teamReachedLimit`.
- `RespawnQueue` — enqueue, timer decrement, respawn emission, removal on disconnect.
- `Spawns.pickSpawn` — team-correct points; fallback when none defined.

**GameSession:**
- `resolveShot` damages a player when `canDamage` is true; ignores the hit in `coop` and when policy forbids it.
- Kill enqueues respawn, records score, emits `playerKilledPlayer`; reaching frag limit emits `matchOver`.
- Respawn restores health and repositions after the delay.

**Integration (loopback transport; extend existing M-series tests):**
- Two players, opposite teams: shooter input → host resolves → victim health drops in snapshot → death → respawn appears.
- Same-team shot under `team` → no damage; under `friendly` → damage applies.
- `MatchConfig` propagates host → client via `welcome`.

**TDD:** each unit written test-first (red → green → refactor).

## Out of scope

- M2 client prediction / lag compensation (designed separately; this leaves a seam for it).
- Auto-balancing teams.
- Automatic round restarts (manual return-to-lobby instead).
- Map-specific spawn authoring beyond simple per-team spawn point lists.
