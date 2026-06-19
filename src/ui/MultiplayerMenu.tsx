import React, { useState } from 'react'
import { ServerList, type ServerRow } from './ServerList'
import { PreJoinPrompt } from './PreJoinPrompt'
import { MatchmakingButton } from './MatchmakingButton'
import type { Team } from '../types'

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
  onQuickMatch?: () => void    // quick match handler
  myTeam?: import('../types').Team
  onSelectTeam?: (team: import('../types').Team) => void
  roster?: { ct: string[]; t: string[] }
  onJoinFree?: (code: string, team: Team, password: string) => void
  joinError?: string | null
  onCancelJoin?: () => void
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
  const [queuing, setQueuing] = useState(false)
  const [joining, setJoining] = useState<ServerRow | null>(null)
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
        <h2>Multiplayer</h2>

        {/* Quick Match */}
        <div style={{ width: '100%', maxWidth: 400 }}>
          <MatchmakingButton
            queuing={queuing}
            onFind={() => {
              setQueuing(true)
              p.onQuickMatch?.()
            }}
            onCancel={() => setQueuing(false)}
          />
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4, textAlign: 'center' }}>
            Auto-find a competitive match
          </p>
        </div>

        {/* Browse Servers */}
        <div style={{ width: '100%', maxWidth: 600 }}>
          <ServerList
            servers={p.servers}
            onJoin={(server) => {
              if (server.joinPolicy === 'free') setJoining(server)
              else p.onJoin(server.roomCode)
            }}
            onRefresh={p.onRefresh}
          />
        </div>

        {/* Create Room */}
        <div style={{ width: '100%', maxWidth: 400, borderTop: '1px solid #3a3a55', paddingTop: 16 }}>
          <button style={btn} onClick={p.onHost}>Create Room</button>
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4, textAlign: 'center' }}>
            Host your own game
          </p>
        </div>

        {/* Room Code Join */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input placeholder="Room code" value={code} onChange={(e) => setCode(e.target.value)}
            style={{ padding: 10, fontSize: 16 }} />
          {code.trim() && <button style={btn} onClick={() => onJoinClick()}>Join</button>}
        </div>

        <button style={{ ...btn, background: '#555' }} onClick={p.onBack}>Back</button>
      </div>

      {joining && (
        <PreJoinPrompt
          protected={joining.protected}
          error={p.joinError}
          onSubmit={(team, password) => p.onJoinFree?.(joining.roomCode, team, password)}
          onCancel={() => { setJoining(null); p.onCancelJoin?.() }}
        />
      )}
    </div>
  )

  function onJoinClick() { if (code.trim()) p.onJoin(code.trim()) }
}
