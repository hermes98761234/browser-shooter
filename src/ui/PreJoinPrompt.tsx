import React, { useState } from 'react'
import type { Team } from '../types'

interface PreJoinPromptProps {
  protected?: boolean
  error?: string | null
  onSubmit: (team: Team, password: string) => void
  onCancel: () => void
}

const overlay: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.6)', zIndex: 60,
}
const card: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 14, padding: 24, background: '#11111a',
  border: '1px solid #3a3a55', borderRadius: 10, color: '#fff', fontFamily: 'monospace', minWidth: 280,
}
const teamBtn = (active: boolean, t: Team): React.CSSProperties => ({
  padding: '8px 16px', cursor: 'pointer', color: '#fff', border: '1px solid',
  borderColor: t === 'ct' ? '#3a6ea5' : '#a5703a',
  background: active ? (t === 'ct' ? '#3a6ea5' : '#a5703a') : (t === 'ct' ? '#1d3a5f' : '#5f3a1d'),
})
const actionBtn: React.CSSProperties = {
  padding: '10px 16px', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold',
  background: '#3399ff', color: '#fff', border: 'none', borderRadius: 6,
}

export const PreJoinPrompt: React.FC<PreJoinPromptProps> = ({ protected: isProtected, error, onSubmit, onCancel }) => {
  const [team, setTeam] = useState<Team>('ct')
  const [password, setPassword] = useState('')
  return (
    <div style={overlay}>
      <div style={card}>
        <h3 style={{ margin: 0 }}>Select Team</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={teamBtn(team === 'ct', 'ct')} onClick={() => setTeam('ct')}>CT</button>
          <button style={teamBtn(team === 't', 't')} onClick={() => setTeam('t')}>T</button>
        </div>
        {isProtected && (
          <input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 8, background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55' }} />
        )}
        {error && <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={{ ...actionBtn, background: '#555' }} onClick={onCancel}>Cancel</button>
          <button style={actionBtn} onClick={() => onSubmit(team, password)}>Join Match</button>
        </div>
      </div>
    </div>
  )
}
