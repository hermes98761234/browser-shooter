import React, { useState } from 'react'
import type { MatchConfig, DamagePolicy } from '../session/MatchConfig'
import { defaultCompetitiveConfig } from '../session/MatchConfig'
import type { GameMode } from '../session/protocol'

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

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, background: '#0d0d14',
      fontFamily: 'monospace', color: '#fff', zIndex: 50 }}>
      <h2 style={{ margin: 0 }}>MATCH SETUP</h2>

      <div><div style={{ opacity: 0.6, marginBottom: 6 }}>MODE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {MODES.map(m => <button key={m.value} style={btn(mode === m.value)} onClick={() => setMode(m.value)}>{m.label}</button>)}
        </div>
      </div>

      {mode !== 'coop' && (
        <div><div style={{ opacity: 0.6, marginBottom: 6 }}>DAMAGE POLICY</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {POLICIES.map(p => <button key={p.value} style={btn(policy === p.value)} onClick={() => setPolicy(p.value)}>{p.label}</button>)}
          </div>
        </div>
      )}

      {mode !== 'coop' && mode !== 'competitive' && (
        <div><div style={{ opacity: 0.6, marginBottom: 6 }}>FRAG LIMIT</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {FRAG_LIMITS.map(f => <button key={f} style={btn(frag === f)} onClick={() => setFrag(f)}>{f === 0 ? 'Endless' : f}</button>)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button style={btn(false)} onClick={onBack}>Back</button>
        <button style={btn(true)} onClick={() => onConfirm(
          mode === 'competitive' ? { ...defaultCompetitiveConfig(), damagePolicy: policy } : { mode, damagePolicy: policy, fragLimit: frag }
        )}>Create Room</button>
      </div>
    </div>
  )
}
