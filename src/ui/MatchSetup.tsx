import React, { useState } from 'react'
import type { MatchConfig, DamagePolicy, JoinPolicy } from '../session/MatchConfig'
import { defaultCompetitiveConfig } from '../session/MatchConfig'
import type { GameMode } from '../session/protocol'
import { ZONES, DEFAULT_ZONE_ID } from '../zones/registry'
import { BattlefieldBackground } from './BattlefieldBackground'

const MODES: { value: GameMode; label: string }[] = [
  { value: 'coop', label: 'Co-op (vs AI)' },
  { value: 'pvp', label: 'Team PvP (no AI)' },
  { value: 'hybrid', label: 'Hybrid (teams + AI)' },
  { value: 'competitive', label: 'Competitive (CS-style)' },
]
const POLICIES: { value: DamagePolicy; label: string }[] = [
  { value: 'team', label: 'Opposite team only' },
  { value: 'friendly', label: 'Friendly fire ON' },
  { value: 'ffa', label: 'Free-for-all' },
]
const FRAG_LIMITS = [10, 30, 50, 0]

const btn = (active: boolean): React.CSSProperties => ({
  padding: '10px 16px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 14,
  background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
  border: '1px solid #3a3a55',
})

export function MatchSetup({ onConfirm, onBack }: { onConfirm: (c: MatchConfig) => void; onBack: () => void }) {
  const [mode, setMode] = useState<GameMode>('pvp')
  const [policy, setPolicy] = useState<DamagePolicy>('team')
  const [frag, setFrag] = useState(30)
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>('lobby')
  const [password, setPassword] = useState('')
  const [zoneId, setZoneId] = useState<string>(DEFAULT_ZONE_ID)

  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate', zIndex: 50 }}>
      <BattlefieldBackground />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start', gap: 20,
        fontFamily: 'monospace', color: '#fff', overflowY: 'auto',
        padding: 'calc(24px + var(--safe-top)) 16px calc(24px + var(--safe-bottom))', boxSizing: 'border-box' }}>
      <h2 style={{ margin: 0 }}>MATCH SETUP</h2>

      <div><div style={{ opacity: 0.6, marginBottom: 6 }}>MODE</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {MODES.map(m => <button key={m.value} style={btn(mode === m.value)} onClick={() => setMode(m.value)}>{m.label}</button>)}
        </div>
      </div>

      <div><div style={{ opacity: 0.6, marginBottom: 6 }}>ZONE</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560 }}>
          {ZONES.map(m => {
            const active = zoneId === m.id
            return (
              <button key={m.id} onClick={() => setZoneId(m.id)} style={{
                cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left',
                padding: '8px 12px', width: 170, boxSizing: 'border-box',
                background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
                border: active ? '1px solid #ff6600' : '1px solid #3a3a55',
              }}>
                <div style={{ fontSize: 14, fontWeight: 'bold' }}>{m.name}</div>
                <div style={{ fontSize: 11, opacity: active ? 0.75 : 0.6, marginTop: 3, lineHeight: 1.3 }}>{m.description}</div>
              </button>
            )
          })}
        </div>
      </div>

      {mode !== 'coop' && (
        <div><div style={{ opacity: 0.6, marginBottom: 6 }}>DAMAGE POLICY</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {POLICIES.map(p => <button key={p.value} style={btn(policy === p.value)} onClick={() => setPolicy(p.value)}>{p.label}</button>)}
          </div>
        </div>
      )}

      {mode !== 'coop' && mode !== 'competitive' && (
        <div><div style={{ opacity: 0.6, marginBottom: 6 }}>FRAG LIMIT</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {FRAG_LIMITS.map(f => <button key={f} style={btn(frag === f)} onClick={() => setFrag(f)}>{f === 0 ? 'Endless' : f}</button>)}
          </div>
        </div>
      )}

      <div><div style={{ opacity: 0.6, marginBottom: 6 }}>JOIN POLICY</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button style={btn(joinPolicy === 'lobby')} onClick={() => setJoinPolicy('lobby')}>Lobby</button>
          <button style={btn(joinPolicy === 'free')} onClick={() => setJoinPolicy('free')}>Free</button>
        </div>
        <input
          placeholder="Password (optional)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginTop: 8, padding: 8, fontFamily: 'monospace', fontSize: 16,
            background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55',
            width: 'min(220px, calc(100vw - 64px))', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button style={btn(false)} onClick={onBack}>Back</button>
        <button style={btn(true)} onClick={() => onConfirm({
          ...(mode === 'competitive'
            ? { ...defaultCompetitiveConfig(), damagePolicy: policy }
            : { mode, damagePolicy: policy, fragLimit: frag }),
          joinPolicy,
          zoneId,
          ...(password ? { password } : {}),
        })}>Create Room</button>
      </div>
      </div>
    </div>
  )
}
