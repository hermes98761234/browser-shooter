import React from 'react'
import type { DirectoryEntry } from '../net/directoryProtocol'

export interface ServerRow extends DirectoryEntry {
  ping: number | null
}

interface ServerListProps {
  servers: ServerRow[]
  onJoin: (roomCode: string) => void
  onRefresh: () => void
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px',
  background: 'rgba(255,255,255,0.06)', borderRadius: 6, width: 460,
}
const cell: React.CSSProperties = { fontSize: 14 }
const joinBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '6px 16px', background: '#3399ff', color: 'white',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold',
}
const refreshBtn: React.CSSProperties = {
  padding: '6px 16px', background: '#555', color: 'white', border: 'none',
  borderRadius: 6, cursor: 'pointer',
}

export const ServerList: React.FC<ServerListProps> = ({ servers, onJoin, onRefresh }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 460 }}>
      <strong>Games</strong>
      <button style={{ ...refreshBtn, marginLeft: 'auto' }} onClick={onRefresh}>Refresh</button>
    </div>
    {servers.length === 0
      ? <div style={{ opacity: 0.6, padding: 12 }}>No games found</div>
      : servers.map((s) => (
        <div key={s.roomCode} style={rowStyle}>
          <span style={{ ...cell, minWidth: 120 }}>{s.hostName}</span>
          <span style={cell}>{s.players}/{s.maxPlayers}</span>
          <span style={{ ...cell, opacity: 0.8 }}>{s.status === 'lobby' ? 'Lobby' : 'In progress'}</span>
          <span style={{ ...cell, opacity: 0.8 }}>{s.ping === null ? '—' : `${s.ping} ms`}</span>
          <button style={joinBtn} onClick={() => onJoin(s.roomCode)}>Join</button>
        </div>
      ))}
  </div>
)
