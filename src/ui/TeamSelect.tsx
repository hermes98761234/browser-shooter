import type { Team } from '../types'

interface TeamSelectProps {
  onSelect: (team: Team) => void
  selected?: Team
  counts?: { ct: number; t: number }
}

export function TeamSelect({ onSelect, selected, counts }: TeamSelectProps) {
  const card = (team: Team, label: string, bg: string, border: string) => (
    <button
      onClick={() => onSelect(team)}
      style={{
        padding: '20px 32px', background: bg, color: '#fff',
        border: selected === team ? '3px solid #fff' : `1px solid ${border}`,
        cursor: 'pointer', fontSize: 16, minWidth: 'min(200px, calc(50vw - 28px))',
      }}
    >
      <div>{label}</div>
      {counts && <div style={{ opacity: 0.7, fontSize: 13, marginTop: 6 }}>{team === 'ct' ? counts.ct : counts.t} players</div>}
    </button>
  )

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#0d0d14', fontFamily: 'monospace', color: '#fff', zIndex: 50,
      padding: '16px', boxSizing: 'border-box',
    }}>
      <h2 style={{ margin: 0 }}>CHOOSE YOUR SIDE</h2>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {card('ct', 'Counter-Terrorist', '#1d3a5f', '#3a6ea5')}
        {card('t', 'Terrorist', '#5f3a1d', '#a5703a')}
      </div>
    </div>
  )
}
