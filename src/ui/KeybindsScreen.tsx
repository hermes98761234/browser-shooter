import React, { useEffect, useState } from 'react'
import type { Keymap, Settings } from '../settings/Settings'
import { DEFAULT_KEYMAP } from '../settings/Settings'
import { BattlefieldBackground } from './BattlefieldBackground'

interface KeybindsScreenProps {
  settings: Settings
  onChange: (settings: Settings) => void
  onBack: () => void
}

// Maps KeyboardEvent.code to a short human-readable label
function labelFor(code: string): string {
  const labels: Record<string, string> = {
    Space: 'SPACE', Tab: 'TAB', Escape: 'ESC', Enter: 'ENTER',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
    Backquote: '`', Minus: '-', Equal: '=',
    ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
    AltLeft: 'L-ALT', AltRight: 'R-ALT',
    CapsLock: 'CAPS',
  }
  if (labels[code]) return labels[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}

const GROUPS: { label: string; actions: { key: keyof Keymap; label: string }[] }[] = [
  {
    label: 'MOVEMENT',
    actions: [
      { key: 'forward', label: 'Forward' },
      { key: 'backward', label: 'Backward' },
      { key: 'left', label: 'Left' },
      { key: 'right', label: 'Right' },
      { key: 'jump', label: 'Jump' },
    ],
  },
  {
    label: 'COMBAT',
    actions: [
      { key: 'buy', label: 'Buy Menu' },
      { key: 'scoreboard', label: 'Scoreboard' },
    ],
  },
  {
    label: 'GRENADES',
    actions: [
      { key: 'cycleGrenade', label: 'Cycle Grenade' },
      { key: 'selectGrenadeHE', label: 'HE Grenade' },
      { key: 'selectGrenadeFlash', label: 'Flashbang' },
      { key: 'selectGrenadeSmoke', label: 'Smoke' },
    ],
  },
  {
    label: 'COMMUNICATION',
    actions: [
      { key: 'pushToTalk', label: 'Push to Talk' },
    ],
  },
  {
    label: 'ADMIN',
    actions: [
      { key: 'addBotCT', label: 'Add CT Bot' },
      { key: 'addBotT', label: 'Add T Bot' },
      { key: 'removeBot', label: 'Remove Bot' },
    ],
  },
]

const scroll: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 12,
  padding: 'calc(28px + var(--safe-top)) 16px calc(28px + var(--safe-bottom))',
  boxSizing: 'border-box', overflowY: 'auto',
  color: 'white', fontFamily: 'monospace',
}

const card: React.CSSProperties = {
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(0,200,80,0.13)',
  borderTop: '2px solid rgba(0,200,80,0.3)',
  borderRadius: 8,
  padding: '18px 20px',
  display: 'flex', flexDirection: 'column', gap: 12,
  width: 'min(400px, calc(100vw - 32px))', boxSizing: 'border-box',
}

const cardLabel: React.CSSProperties = {
  fontSize: 10, color: '#5aff8a', letterSpacing: 2, opacity: 0.75,
  marginBottom: 4,
}

export const KeybindsScreen: React.FC<KeybindsScreenProps> = ({ settings, onChange, onBack }) => {
  const [waiting, setWaiting] = useState<keyof Keymap | null>(null)

  useEffect(() => {
    if (!waiting) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.code === 'Escape') {
        setWaiting(null)
        return
      }
      onChange({ ...settings, keymap: { ...settings.keymap, [waiting]: e.code } })
      setWaiting(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [waiting, settings, onChange])

  const keymap = settings.keymap

  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      <BattlefieldBackground />
      <div style={scroll}>
        <h1 style={{
          fontSize: 'clamp(26px, 8vw, 40px)', fontWeight: 'bold',
          color: '#ff6600', textShadow: '0 0 20px #ff6600, 0 0 40px #ff3300',
          letterSpacing: 4, margin: '0 0 4px',
        }}>KEYBINDS</h1>

        {GROUPS.map((group) => (
          <div key={group.label} style={card}>
            <div style={cardLabel}>{group.label}</div>
            {group.actions.map(({ key, label }) => {
              const isWaiting = waiting === key
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 }}>
                    {label}
                  </span>
                  <button
                    onClick={() => setWaiting(isWaiting ? null : key)}
                    style={{
                      minWidth: 90, padding: '6px 12px',
                      fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, letterSpacing: 1,
                      background: isWaiting ? 'rgba(255,102,0,0.25)' : 'rgba(255,255,255,0.05)',
                      color: isWaiting ? '#ff6600' : 'rgba(255,255,255,0.8)',
                      border: isWaiting ? '1px solid #ff6600' : '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                    }}
                  >
                    {isWaiting ? 'PRESS ANY KEY' : labelFor(keymap[key])}
                  </button>
                </div>
              )
            })}
          </div>
        ))}

        <div style={{ ...card, flexDirection: 'row', gap: 8, padding: '12px 20px' }}>
          <button
            onClick={() => onChange({ ...settings, keymap: DEFAULT_KEYMAP })}
            style={{
              flex: 1, padding: '10px 0',
              fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, letterSpacing: 1,
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer',
            }}
          >RESET DEFAULTS</button>
          <button
            onClick={onBack}
            style={{
              flex: 1, padding: '10px 0',
              fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, letterSpacing: 1,
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer',
            }}
          >BACK</button>
        </div>
      </div>
    </div>
  )
}
