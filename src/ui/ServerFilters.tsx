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
              data-active={filter.mode === m.value ? 'true' : 'false'}
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
