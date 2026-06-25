import React, { useState } from 'react'
import type { Team } from '../types'

interface PreJoinPromptProps {
  protected?: boolean
  showTeam?: boolean
  error?: string | null
  onSubmit: (team: Team, password: string) => void
  onCancel: () => void
}

const overlay: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.75)', zIndex: 60,
}

export const PreJoinPrompt: React.FC<PreJoinPromptProps> = ({ protected: isProtected, showTeam = true, error, onSubmit, onCancel }) => {
  const [team, setTeam] = useState<Team>('ct')
  const [password, setPassword] = useState('')

  return (
    <div style={overlay}>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 28px',
        background: 'rgba(5,12,8,0.97)',
        border: '1px solid rgba(0,200,80,0.18)',
        borderTop: '2px solid rgba(0,200,80,0.4)',
        borderRadius: 8,
        color: '#fff', fontFamily: 'monospace', minWidth: 300,
        boxShadow: '0 0 40px rgba(0,0,0,0.8)',
      }}>
        <div style={{ fontSize: 10, color: '#5aff8a', letterSpacing: 3, opacity: 0.8 }}>JOIN MATCH</div>
        {showTeam && <h3 style={{ margin: 0, fontSize: 18, letterSpacing: 2, color: '#fff' }}>SELECT TEAM</h3>}

        {showTeam && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setTeam('ct')}
              style={{
                flex: 1, padding: '14px 0', cursor: 'pointer',
                fontFamily: 'monospace', fontWeight: 'bold', fontSize: 15, letterSpacing: 2,
                background: team === 'ct' ? '#1a4a7a' : 'rgba(255,255,255,0.04)',
                color: team === 'ct' ? '#7ab8f5' : 'rgba(255,255,255,0.4)',
                border: team === 'ct' ? '1px solid #3a6ea5' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                transition: 'all 0.1s',
              }}
            >CT</button>
            <button
              onClick={() => setTeam('t')}
              style={{
                flex: 1, padding: '14px 0', cursor: 'pointer',
                fontFamily: 'monospace', fontWeight: 'bold', fontSize: 15, letterSpacing: 2,
                background: team === 't' ? '#6b3a10' : 'rgba(255,255,255,0.04)',
                color: team === 't' ? '#d4924a' : 'rgba(255,255,255,0.4)',
                border: team === 't' ? '1px solid #a5703a' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                transition: 'all 0.1s',
              }}
            >T</button>
          </div>
        )}

        {isProtected && (
          <input
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: '10px 12px', background: 'rgba(255,255,255,0.05)',
              color: '#fff', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, fontFamily: 'monospace', fontSize: 14, outline: 'none',
            }}
          />
        )}

        {error && (
          <div style={{ color: '#ff6b6b', fontSize: 12, letterSpacing: 0.5 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            style={{
              flex: 1, padding: '12px 0', cursor: 'pointer', fontFamily: 'monospace',
              fontWeight: 'bold', fontSize: 14, letterSpacing: 1,
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
            }}
            onClick={onCancel}
          >CANCEL</button>
          <button
            style={{
              flex: 2, padding: '12px 0', cursor: 'pointer', fontFamily: 'monospace',
              fontWeight: 'bold', fontSize: 14, letterSpacing: 1,
              background: '#ff6600', color: '#fff',
              border: 'none', borderRadius: 6,
            }}
            onClick={() => onSubmit(team, password)}
          >JOIN MATCH</button>
        </div>
      </div>
    </div>
  )
}
