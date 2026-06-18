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

  if (queuing) {
    return (
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <button style={{ ...btn, flex: 1 }} disabled>
          Searching...
        </button>
        <button style={{ ...btn, background: '#cc3300', flex: 0, padding: '16px 20px' }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button style={btn} onClick={onFind}>
      Quick Match
    </button>
  )
}
