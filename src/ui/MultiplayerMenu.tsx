import React, { useState } from 'react'
import { ServerList, type ServerRow } from './ServerList'

interface MultiplayerMenuProps {
  roomCode: string | null      // set once hosting; null while choosing/joining
  players: string[]            // lobby roster (names)
  isHost: boolean
  servers: ServerRow[]         // discovered open games
  onHost: () => void           // start hosting (creates the room)
  onJoin: (code: string) => void
  onStart: () => void          // host begins the match
  onBack: () => void
  onRefresh: () => void        // re-query the directory
  myTeam?: import('../types').Team
  onSelectTeam?: (team: import('../types').Team) => void
  roster?: { ct: string[]; t: string[] }
}

const panel: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 16, overflow: 'auto',
  background: 'linear-gradient(180deg,#0a0a1a,#1a1a3e)', color: 'white', fontFamily: 'monospace',
}
const panelInner: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  margin: 'auto 0', padding: '24px 16px',
}
const btn: React.CSSProperties = {
  padding: '12px 32px', fontSize: 18, fontWeight: 'bold', background: '#3399ff',
  color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
}

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = (p) => {
  const [code, setCode] = useState('')
  const inLobby = p.roomCode !== null || p.players.length > 0

  if (inLobby) {
    return (
      <div style={panel}>
        <div style={panelInner}>
          <h2>Lobby</h2>
          {p.roomCode && (
            <div>Room code: <strong style={{ fontSize: 24 }}>{p.roomCode}</strong>{' '}
              <button style={btn} onClick={() => navigator.clipboard?.writeText(p.roomCode!)}>Copy</button>
            </div>
          )}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {p.players.map((name) => <li key={name}>{name}</li>)}
          </ul>
          {p.onSelectTeam && (
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <button onClick={() => p.onSelectTeam!('ct')}
                style={{ padding: '8px 16px', background: p.myTeam === 'ct' ? '#3a6ea5' : '#1d3a5f', color: '#fff', border: '1px solid #3a6ea5', cursor: 'pointer' }}>
                CT{p.roster ? ` (${p.roster.ct.length})` : ''}
              </button>
              <button onClick={() => p.onSelectTeam!('t')}
                style={{ padding: '8px 16px', background: p.myTeam === 't' ? '#a5703a' : '#5f3a1d', color: '#fff', border: '1px solid #a5703a', cursor: 'pointer' }}>
                T{p.roster ? ` (${p.roster.t.length})` : ''}
              </button>
            </div>
          )}
          {p.roster && (
            <div style={{ display: 'flex', gap: 40, marginTop: 12, fontFamily: 'monospace' }}>
              <div><div style={{ color: '#3a6ea5' }}>COUNTER-TERRORISTS</div>{p.roster.ct.map((n, i) => <div key={i}>{n}</div>)}</div>
              <div><div style={{ color: '#a5703a' }}>TERRORISTS</div>{p.roster.t.map((n, i) => <div key={i}>{n}</div>)}</div>
            </div>
          )}
          {p.isHost
            ? <button style={btn} onClick={p.onStart}>Start</button>
            : <p>Waiting for host to start…</p>}
          <button style={{ ...btn, background: '#555' }} onClick={p.onBack}>Back</button>
        </div>
      </div>
    )
  }

  return (
    <div style={panel}>
      <div style={panelInner}>
        <h2>Multiplayer (Co-op)</h2>
        <button style={btn} onClick={p.onHost}>Host Game</button>
        <ServerList servers={p.servers} onJoin={p.onJoin} onRefresh={p.onRefresh} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Room code" value={code} onChange={(e) => setCode(e.target.value)}
            style={{ padding: 10, fontSize: 16 }} />
          <button style={btn} onClick={() => onJoinClick()}>Join</button>
        </div>
        <button style={{ ...btn, background: '#555' }} onClick={p.onBack}>Back</button>
      </div>
    </div>
  )

  function onJoinClick() { if (code.trim()) p.onJoin(code.trim()) }
}
