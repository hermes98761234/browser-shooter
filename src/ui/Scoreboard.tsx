import React from 'react'
import type { EntityState, MatchScores } from '../session/protocol'

interface ScoreboardProps {
  players: EntityState[]
  roomCode?: string | null
  scores?: MatchScores
}

const overlay: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  pointerEvents: 'none', zIndex: 60, fontFamily: 'monospace',
}
const panel: React.CSSProperties = {
  width: 'min(480px, calc(100vw - 24px))', maxWidth: 'calc(100vw - 24px)',
  maxHeight: 'calc(100vh - 24px)', overflow: 'auto',
  background: 'rgba(10,10,25,0.92)', border: '1px solid #2a2a3f',
  borderRadius: 12, padding: 'clamp(14px, 4vw, 24px)', color: '#e0e0f0',
  boxShadow: '0 0 40px rgba(0,0,0,0.6)',
}
function pingColor(ping: number): string {
  if (ping < 60) return '#00ff88'
  if (ping < 120) return '#ffcc33'
  return '#ff5544'
}
const teamColor = (t?: string) => (t === 'ct' ? '#3a6ea5' : t === 't' ? '#a5703a' : '#8888aa')

export const Scoreboard: React.FC<ScoreboardProps> = ({ players, roomCode, scores }) => {
  const rows = [...players].sort((a, b) => {
    const ka = scores?.players[a.id]?.kills ?? 0
    const kb = scores?.players[b.id]?.kills ?? 0
    return kb - ka
  })
  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          borderBottom: '1px solid #2a2a3f', paddingBottom: 10, marginBottom: 10 }}>
          <h2 style={{ margin: 0, color: '#ff6600', fontSize: 22 }}>SCOREBOARD</h2>
          {scores && <span style={{ fontSize: 18 }}>
            <span style={{ color: '#3a6ea5' }}>CT {scores.teams.ct}</span>
            {'  :  '}
            <span style={{ color: '#a5703a' }}>{scores.teams.t} T</span>
          </span>}
          {roomCode && <span style={{ opacity: 0.5, fontSize: 13 }}>Room {roomCode}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '6px clamp(10px, 3vw, 24px)',
          fontSize: 13, opacity: 0.6, marginBottom: 6 }}>
          <span>PLAYER</span><span>K</span><span>D</span><span>STATUS</span><span style={{ textAlign: 'right' }}>PING</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '8px clamp(10px, 3vw, 24px)', fontSize: 16 }}>
          {rows.map((p) => {
            const ps = scores?.players[p.id]
            return (
              <React.Fragment key={p.id}>
                <span style={{ opacity: p.isDead ? 0.45 : 1, color: teamColor(p.team) }}>{p.name ?? p.id}</span>
                <span>{ps?.kills ?? 0}</span>
                <span>{ps?.deaths ?? 0}</span>
                <span style={{ color: p.isDead ? '#ff5544' : '#8888aa' }}>{p.isDead ? 'DEAD' : 'ALIVE'}</span>
                <span style={{ textAlign: 'right', color: p.isBot ? '#8888aa' : pingColor(p.ping ?? 0) }}>
                  {p.isBot ? 'BOT' : `${p.ping ?? 0} ms`}
                </span>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
