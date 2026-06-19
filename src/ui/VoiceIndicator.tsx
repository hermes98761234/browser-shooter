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
