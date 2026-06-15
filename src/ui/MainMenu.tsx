import React from 'react'

interface MainMenuProps {
  onStart: () => void
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 100%)',
      color: 'white',
      fontFamily: 'monospace',
    }}>
      <h1 style={{
        fontSize: 64,
        fontWeight: 'bold',
        textShadow: '0 0 30px #ff6600, 0 0 60px #ff3300',
        marginBottom: 10,
        color: '#ff6600',
      }}>
        BROWSER SHOOTER
      </h1>
      <p style={{ fontSize: 18, opacity: 0.6, marginBottom: 40 }}>
        3D FPS Arena Wave Survival
      </p>

      <button
        onClick={onStart}
        style={{
          padding: '16px 48px',
          fontSize: 24,
          fontWeight: 'bold',
          background: '#ff6600',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#ff8800'
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#ff6600'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        START GAME
      </button>

      <div style={{
        marginTop: 60,
        padding: 30,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        maxWidth: 400,
      }}>
        <h3 style={{ marginBottom: 15, color: '#ff6600' }}>Controls</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 14 }}>
          <span style={{ opacity: 0.6 }}>WASD</span><span>Move</span>
          <span style={{ opacity: 0.6 }}>Mouse</span><span>Look</span>
          <span style={{ opacity: 0.6 }}>Click</span><span>Shoot</span>
          <span style={{ opacity: 0.6 }}>1-3</span><span>Switch Weapon</span>
          <span style={{ opacity: 0.6 }}>R</span><span>Reload</span>
          <span style={{ opacity: 0.6 }}>Space</span><span>Jump</span>
          <span style={{ opacity: 0.6 }}>M</span><span>Mute Sound</span>
          <span style={{ opacity: 0.6 }}>ESC</span><span>Pause</span>
        </div>
      </div>
    </div>
  )
}
