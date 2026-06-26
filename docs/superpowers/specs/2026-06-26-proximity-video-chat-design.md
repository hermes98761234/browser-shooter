# Proximity Video Chat — Design Spec

**Date:** 2026-06-26

## Summary

Add proximity-based video chat: when players are within voice range of each other, they can toggle their camera on and see floating video tiles of nearby players in the bottom-right corner. Same proximity roster and PeerJS mesh as voice — no new protocol messages.

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/voice/VideoChat.ts` | Proximity video call orchestrator — parallel to `VoiceChat.ts` |
| `src/ui/VideoTiles.tsx` | Floating corner overlay rendering `<video>` elements |

### Modified files

| File | Change |
|------|--------|
| `src/settings/Settings.ts` | Add `toggleVideo: string` to `Keymap`; default `'KeyV'` |
| `src/ui/KeybindsScreen.tsx` | Add "Toggle Video" to the COMMUNICATION group |
| `src/player/Controls.ts` | Handle `toggleVideo` keydown → `onVideoToggle?.()` callback |
| `src/App.tsx` | Wire up `VideoChat`; call `setRoster` on each `voiceRoster` message |
| `src/voice/VoiceTransport.ts` | Add `CamProvider` (6-line class, mirrors `BrowserMicProvider`) |

### Unchanged

`NetHost.ts`, `NetClient.ts`, `voiceMesh.ts`, `VoiceTransport.ts` interfaces, all protocol files. The existing `voiceRoster` push already delivers the proximity peer list — no new server-side logic needed.

## VideoChat class

```ts
interface VideoChatDeps {
  peer: VoicePeer              // same interface as voice
  cam: CamProvider             // getUserMedia({ video: true, audio: false })
  localPlayerId: string
  onStreamsChanged: (streams: Map<string, MediaStream>) => void
}

class VideoChat {
  setRoster(teammates: VoiceRosterEntry[]): void
  toggleCamera(): Promise<void>   // lazy cam acquisition, toggle on/off
  peerDisconnected(playerId: string): void
  dispose(): void
}
```

- Camera is acquired lazily on first `toggleCamera()` (same pattern as `BrowserMicProvider`)
- Uses `voiceMesh.reconcileMesh()` to decide which peer initiates each call (smaller peer ID calls, larger answers) — same as voice
- On toggle off: camera track is disabled but stream is kept (re-enable on next toggle without re-prompting permissions)
- `onStreamsChanged` fires whenever the remote stream map changes; `VideoTiles` re-renders from this

## CamProvider

```ts
class BrowserCamProvider implements CamProvider {
  getStream(): Promise<MediaStream>  // getUserMedia({ video: true, audio: false }), lazy + cached
}
```

Added alongside `BrowserMicProvider` in `VoiceTransport.ts`.

## VideoTiles UI

- Floating `<video>` tiles pinned to the bottom-right corner of the game canvas
- Self-preview tile: always shown when camera is on (`muted`, local stream)
- Remote tiles: one per entry in the streams map (not muted)
- Tile size: ~120×90px, stacked vertically
- Hidden entirely when camera is off and no remote streams
- No player name labels (add later if wanted)

## Keybind

- Default key: **V** (`KeyV`) — free, obvious mnemonic
- Added to `Keymap.toggleVideo` in `Settings.ts`
- Shown in COMMUNICATION group in `KeybindsScreen.tsx`
- `Controls.ts` fires `onVideoToggle()` on keydown only (not keyup — it's a toggle, not hold)

## Data flow

```
keydown V
  → Controls.onVideoToggle()
  → App: videoChat.toggleCamera()
    → acquires camera (once)
    → enables/disables camera track
    → calls App: setLocalStream(stream | null)
      → VideoTiles re-renders self-preview

voiceRoster message arrives (same as voice)
  → App: videoChat.setRoster(teammates)
    → reconcileMesh() → open/close PeerJS calls with camera stream
    → onStreamsChanged(streams)
      → VideoTiles re-renders remote tiles
```

## Error handling

- Camera permission denied: show same-style notice as voice ("Camera unavailable — video disabled"), auto-dismiss after 4s
- Peer disconnects: `videoChat.peerDisconnected(id)` cleans up the call and stream (same as `voiceChat.peerDisconnected`)

## Out of scope

- Player name labels on video tiles
- Video-specific proximity radius (uses same `PROXIMITY_VOICE_RADIUS = 7` as voice)
- Bandwidth/quality controls
- Recording
