# Proximity Voice Chat — Design Spec

**Date:** 2026-06-26  
**Status:** Approved

---

## Overview

Add a `'proximity'` voice mode alongside the existing `'team'` mode. In proximity mode, players hear anyone within 7 game units regardless of team — enemies included. A talking indicator (3D sprite above the character head) shows in both modes when a player is speaking.

---

## MatchConfig change

Add an optional field to `src/session/MatchConfig.ts`:

```ts
voiceMode?: 'team' | 'proximity'   // default: 'team'
```

`defaultMatchConfig()` and `defaultCompetitiveConfig()` leave `voiceMode` undefined (treated as `'team'`). The field is forwarded to clients in the `welcome` message (already carries the full `MatchConfig`).

---

## NetHost changes (`src/net/NetHost.ts`)

### Constant

```ts
const PROXIMITY_VOICE_RADIUS = 7
```

### `voiceParticipants()`

Add `position: THREE.Vector3` to each entry, sourced from `this.session.getPlayer(id)?.player.position`. Skip participants whose position is unavailable.

### `voiceTeammatesFor(playerId)` → branching filter

- `'team'` mode (existing): keep players where `p.team === me.team`.
- `'proximity'` mode: keep players where `p.position.distanceTo(me.position) <= PROXIMITY_VOICE_RADIUS`. Team is ignored.

### `relayVoice(msg, speakerId)`

Same branch — relay `voiceStart`/`voiceStop` only to players in range (proximity) or on the same team (team mode).

### Tick throttle (proximity mode only)

`NetHost` accumulates elapsed time in `tick(dt)`. Every 200 ms it calls `refreshVoiceRoster()`. Team mode keeps the existing event-driven refresh (on join / team change) — no periodic refresh needed.

---

## Talking indicator

### `CharacterModel.ts`

Add `buildTalkingSprite(): THREE.Sprite`:
- Canvas texture: 32×32 px, filled green circle.
- Returns a `THREE.Sprite` scaled to 0.3 × 0.3, positioned at `y = 2.3` (above the nameTag).
- Initially invisible.

### `RemotePlayer.ts`

- Add `private talkingSprite: THREE.Sprite` (created via `buildTalkingSprite()`).
- `setTalking(on: boolean)` — sets `talkingSprite.visible`.
- Sprite added to `this.group` in constructor.

### `RemotePlayerManager.ts`

Add `setTalking(playerId: string, on: boolean)`:
```ts
this.players.get(playerId)?.setTalking(on)
```

### `App.tsx`

Wire in both host and client paths:
- **Client path:** `netClient.onVoiceStart(id => remotePlayerManager.setTalking(id, true))` and `onVoiceStop`.
- **Host path:** `host.onRemoteVoiceStart(id => remotePlayerManager.setTalking(id, true))` and `onRemoteVoiceStop`.

Local player speaking is already shown by the existing bottom-left `VoiceIndicator` — no 3D sprite needed for self.

---

## MatchSetup UI (`src/ui/MatchSetup.tsx`)

Add a **Voice** toggle alongside existing config buttons:

```
[ Team ]  [ Proximity ]
```

Writes `voiceMode` into the config object passed to `NetHost`. Default: `'team'`.

---

## Tests

### `NetHost.voice.test.ts`

- Add a `proximity()` helper (two players on **opposite** teams, within 7 units).
- Assert proximity mode roster includes the cross-team player.
- Assert team mode roster excludes cross-team player (existing behaviour preserved).
- Assert relay reaches cross-team player in proximity mode.
- Assert periodic roster refresh fires in `tick()` at 200 ms.

---

## Constraints / non-goals

- Radius 7 is fixed — no per-match config.
- No audio spatialization (volume does not fall off with distance) — the roster is binary: in/out.
- Bots have no voice; bot positions are not considered for roster.
- The local player's own talking indicator is the existing HUD `VoiceIndicator`; no 3D sprite for first-person self.
