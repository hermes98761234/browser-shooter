import React, { useState, useMemo } from 'react'
import { ServerFilters, type ServerFilter } from './ServerFilters'
import type { DirectoryEntry } from '../net/directoryProtocol'

export interface ServerRow extends DirectoryEntry {
  ping: number | null
}

interface ServerListProps {
  servers: ServerRow[]
  onJoin: (roomCode: string) => void
  onRefresh: () => void
  filterMode?: string
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

export const ServerList: React.FC<ServerListProps> = ({ servers, onJoin, onRefresh, filterMode }) => {
  const [filter, setFilter] = useState<ServerFilter>({
    mode: (filterMode as ServerFilter['mode']) ?? 'all',
    status: 'all',
    playerCount: 'all',
  })

  const filteredServers = useMemo(() => {
    return servers
      .filter((s) => {
        if (filter.mode !== 'all' && s.mode !== filter.mode) return false
        if (filter.status !== 'all' && s.status !== filter.status) return false
        if (filter.playerCount === '1-2' && s.players > 2) return false
        if (filter.playerCount === '3-4' && (s.players < 3 || s.players > 4)) return false
        if (filter.playerCount === '5+' && s.players < 5) return false
        return true
      })
      .sort((a, b) => {
        if (a.ping === null) return 1
        if (b.ping === null) return -1
        return a.ping - b.ping
      })
  }, [servers, filter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <ServerFilters filter={filter} onChange={setFilter} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 460 }}>
        <strong>Games</strong>
        <button style={{ ...refreshBtn, marginLeft: 'auto' }} onClick={onRefresh}>Refresh</button>
      </div>
      {filteredServers.length === 0
        ? <div style={{ opacity: 0.6, padding: 12 }}>No games found</div>
        : filteredServers.map((s) => (
          <div key={s.roomCode} style={rowStyle}>
            <span style={{ ...cell, minWidth: 120 }}>{s.hostName}</span>
            <span style={cell}>{s.mode ?? 'Unknown'}</span>
            <span style={cell}>{s.players}/{s.maxPlayers}</span>
            <span style={{ ...cell, opacity: 0.8 }}>{s.status === 'lobby' ? 'Lobby' : 'In progress'}</span>
            <span style={{ ...cell, opacity: 0.8 }}>{s.ping === null ? '—' : `${s.ping} ms`}</span>
            <button style={joinBtn} onClick={() => onJoin(s.roomCode)}>Join</button>
          </div>
        ))}
    </div>
  )
}
