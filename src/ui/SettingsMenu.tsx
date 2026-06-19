import React from 'react'
import type { Settings, MobileControlsMode } from '../settings/Settings'
import { isTouchDevice } from '../settings/Settings'
import { CrosshairEditor } from './CrosshairEditor'

interface SettingsMenuProps {
  settings: Settings
  onChange: (settings: Settings) => void
  onBack: () => void
}

const panel: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'flex-start', gap: 24,
  padding: 'calc(40px + var(--safe-top)) 16px calc(40px + var(--safe-bottom))',
  boxSizing: 'border-box', overflowY: 'auto',
  background: 'linear-gradient(180deg,#0a0a1a,#1a1a3e)', color: 'white', fontFamily: 'monospace',
}
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 'clamp(18px, 5vw, 28px)',
  display: 'flex', flexDirection: 'column', gap: 22,
  width: 'min(360px, calc(100vw - 32px))', boxSizing: 'border-box',
}
const label: React.CSSProperties = { fontSize: 13, opacity: 0.6, marginBottom: 8, display: 'block' }
const btn: React.CSSProperties = {
  padding: '12px 32px', fontSize: 18, fontWeight: 'bold', background: '#3399ff',
  color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
}

const MOBILE_OPTIONS: { value: MobileControlsMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ settings, onChange, onBack }) => {
  return (
    <div style={panel}>
      <h2 style={{ color: '#ff6600', margin: 0 }}>SETTINGS</h2>

      <div style={card}>
        <div>
          <span style={label}>PLAYER NAME</span>
          <input
            value={settings.playerName}
            maxLength={16}
            onChange={(e) => onChange({ ...settings, playerName: e.target.value })}
            style={{
              padding: 10, fontSize: 16, width: '100%', boxSizing: 'border-box',
              background: '#12121f', color: 'white', border: '1px solid #2a2a3f', borderRadius: 6,
            }}
          />
        </div>

        <div>
          <span style={label}>
            MOBILE / TOUCH CONTROLS{' '}
            {settings.mobileControls === 'auto' && (
              <em style={{ opacity: 0.7 }}>
                (detected: {isTouchDevice() ? 'touch' : 'no touch'})
              </em>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {MOBILE_OPTIONS.map((opt) => {
              const active = settings.mobileControls === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => onChange({ ...settings, mobileControls: opt.value })}
                  style={{
                    ...btn, flex: 1, padding: '10px 0', fontSize: 15,
                    background: active ? '#ff6600' : '#2a2a3f',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <span style={label}>TOUCH LOOK SENSITIVITY — {settings.lookSensitivity.toFixed(1)}×</span>
          <input
            type="range" min={0.5} max={2.5} step={0.1} value={settings.lookSensitivity}
            onChange={(e) => onChange({ ...settings, lookSensitivity: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin: 0, fontSize: 15, color: '#ff6600', letterSpacing: 1 }}>CROSSHAIR</h3>
        <CrosshairEditor
          value={settings.crosshair}
          onChange={(crosshair) => onChange({ ...settings, crosshair })}
        />
      </div>

      <button style={{ ...btn, background: '#555' }} onClick={onBack}>Back</button>
    </div>
  )
}
