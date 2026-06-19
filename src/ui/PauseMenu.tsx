import React from 'react'

interface PauseMenuProps {
  onResume: () => void
  onMainMenu: () => void
  onHelp: () => void
}

export const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onMainMenu, onHelp }) => {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.75)',
      color: 'white',
      fontFamily: 'monospace',
      zIndex: 30,
    }}>
      <h1 style={{
        fontSize: 'clamp(32px, 10vw, 48px)',
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#ff6600',
        textShadow: '0 0 20px #ff6600',
      }}>
        PAUSED
      </h1>
      <p style={{ fontSize: 14, opacity: 0.5, marginBottom: 40, textAlign: 'center' }}>
        Press ESC or tap RESUME to continue
      </p>

      <button
        className="ui-btn"
        onClick={onResume}
        style={{
          padding: '14px 48px',
          fontSize: 18,
          fontWeight: 'bold',
          background: '#ff6600',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          marginBottom: 16,
          minWidth: 'min(240px, calc(100vw - 48px))',
        }}
      >
        RESUME
      </button>

      <button
        className="ui-btn"
        onClick={onHelp}
        style={{
          padding: '12px 36px',
          fontSize: 16,
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          border: '1px solid #555',
          borderRadius: 8,
          cursor: 'pointer',
          marginBottom: 16,
          minWidth: 'min(240px, calc(100vw - 48px))',
        }}
      >
        HELP
      </button>

      <button
        className="ui-btn"
        onClick={onMainMenu}
        style={{
          padding: '12px 36px',
          fontSize: 16,
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          border: '1px solid #555',
          borderRadius: 8,
          cursor: 'pointer',
          minWidth: 'min(240px, calc(100vw - 48px))',
        }}
      >
        MAIN MENU
      </button>
    </div>
  )
}
