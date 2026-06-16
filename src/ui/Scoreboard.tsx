import React from 'react'
import type { EntityState } from '../session/protocol'

interface ScoreboardProps {
  players: EntityState[]
  roomCode?: string | null
}

const overlay: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  pointerEvents: 'none', zIndex: 60, fontFamily: 'monospace',
}

const panel: React.CSSProperties = {
  minWidth: 420, maxWidth: '90%',
  background: 'rgba(10,10,25,0.92)', border: '1px solid #2a2a3f',
  borderRadius: 12, padding: 24, color: '#e0e0f0',
  boxShadow: '0 0 40px rgba(0,0,0,0.6)',
}

function pingColor(ping: number): string {
  if (ping < 60) return '#00ff88'
  if (ping < 120) return '#ffcc33'
  return '#ff5544'
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ players, roomCode }) => {
  const rows = [...players].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          borderBottom: '1px solid #2a2a3f', paddingBottom: 10, marginBottom: 10,
        }}>
          <h2 style={{ margin: 0, color: '#ff6600', fontSize: 22 }}>SCOREBOARD</h2>
          {roomCode && <span style={{ opacity: 0.5, fontSize: 13 }}>Room {roomCode}</span>}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '6px 24px',
          fontSize: 13, opacity: 0.5, marginBottom: 6,
        }}>
          <span>PLAYER</span><span>STATUS</span><span style={{ textAlign: 'right' }}>PING</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px 24px', fontSize: 16 }}>
          {rows.map((p) => (
            <React.Fragment key={p.id}>
              <span style={{ opacity: p.isDead ? 0.45 : 1 }}>{p.name ?? p.id}</span>
              <span style={{ opacity: p.isDead ? 0.45 : 1, color: p.isDead ? '#ff5544' : '#8888aa' }}>
                {p.isDead ? 'DEAD' : 'ALIVE'}
              </span>
              <span style={{ textAlign: 'right', color: pingColor(p.ping ?? 0) }}>
                {p.ping ?? 0} ms
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
