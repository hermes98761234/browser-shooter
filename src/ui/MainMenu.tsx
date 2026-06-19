import React from 'react'

interface MainMenuProps {
  onSingleplayer: () => void
  onMultiplayer: () => void
  onSettings: () => void
  onAbout: () => void
  onHelp: () => void
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onSingleplayer, onMultiplayer, onSettings, onAbout, onHelp,
}) => {
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
      padding: 'calc(16px + var(--safe-top)) 16px calc(16px + var(--safe-bottom))',
    }}>
      <h1 style={{
        fontSize: 'clamp(34px, 11vw, 64px)',
        fontWeight: 'bold',
        textShadow: '0 0 30px #ff6600, 0 0 60px #ff3300',
        marginBottom: 10,
        color: '#ff6600',
        textAlign: 'center',
      }}>
        BROWSER SHOOTER
      </h1>
      <p style={{ fontSize: 'clamp(13px, 4vw, 18px)', opacity: 0.6, marginBottom: 40, textAlign: 'center' }}>
        3D FPS Arena Wave Survival
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 'min(280px, calc(100vw - 32px))' }}>
        <button className="ui-btn" onClick={onSingleplayer} style={{
          padding: '16px 40px', fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 'bold', background: '#ff6600',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>SINGLEPLAYER</button>
        <button className="ui-btn" onClick={onMultiplayer} style={{
          padding: '16px 40px', fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 'bold', background: '#3399ff',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>MULTIPLAYER</button>
        <button className="ui-btn" onClick={onSettings} style={{
          padding: '16px 40px', fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 'bold', background: '#444',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>SETTINGS</button>
        <button className="ui-btn" onClick={onAbout} style={{
          padding: '16px 40px', fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 'bold', background: '#333',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>ABOUT</button>
        <button className="ui-btn" onClick={onHelp} style={{
          padding: '16px 40px', fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 'bold', background: '#333',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>HELP</button>
      </div>
    </div>
  )
}
