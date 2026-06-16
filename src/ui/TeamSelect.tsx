import type { Team } from '../types'

interface TeamSelectProps {
  onSelect: (team: Team) => void
}

export function TeamSelect({ onSelect }: TeamSelectProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#0d0d14', fontFamily: 'monospace', color: '#fff', zIndex: 50,
    }}>
      <h2 style={{ margin: 0 }}>CHOOSE YOUR SIDE</h2>
      <div style={{ display: 'flex', gap: 24 }}>
        <button
          onClick={() => onSelect('ct')}
          style={{ padding: '20px 32px', background: '#1d3a5f', color: '#fff', border: '1px solid #3a6ea5', cursor: 'pointer', fontSize: 16 }}
        >
          Counter-Terrorist
        </button>
        <button
          onClick={() => onSelect('t')}
          style={{ padding: '20px 32px', background: '#5f3a1d', color: '#fff', border: '1px solid #a5703a', cursor: 'pointer', fontSize: 16 }}
        >
          Terrorist
        </button>
      </div>
    </div>
  )
}
