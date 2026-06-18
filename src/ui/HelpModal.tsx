interface HelpModalProps {
  onClose: () => void
}

export const HelpModal = ({ onClose }: HelpModalProps) => {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', zIndex: 100, fontFamily: 'monospace', color: '#fff',
    }}>
      <div style={{
        background: '#15151f', border: '1px solid #3a3a55', padding: 32,
        minWidth: 320, maxWidth: 400,
      }}>
        <h2 style={{ margin: '0 0 20px', color: '#ff6600' }}>Help</h2>
        
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14, color: '#8a8aad' }}>CONTROLS</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 14 }}>
            <span style={{ opacity: 0.6 }}>WASD</span><span>Move</span>
            <span style={{ opacity: 0.6 }}>Mouse</span><span>Look</span>
            <span style={{ opacity: 0.6 }}>Click</span><span>Shoot</span>
            <span style={{ opacity: 0.6 }}>1-3</span><span>Switch Weapon</span>
            <span style={{ opacity: 0.6 }}>R</span><span>Reload</span>
            <span style={{ opacity: 0.6 }}>Space</span><span>Jump</span>
            <span style={{ opacity: 0.6 }}>Tab</span><span>Scoreboard</span>
            <span style={{ opacity: 0.6 }}>B</span><span>Buy Menu</span>
            <span style={{ opacity: 0.6 }}>M</span><span>Mute Sound</span>
            <span style={{ opacity: 0.6 }}>ESC</span><span>Pause</span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14, color: '#8a8aad' }}>COMPETITIVE MODE (Bomb)</h3>
          <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.8 }}>
            <p style={{ margin: '0 0 8px' }}>Available in <strong>Multiplayer → Create Room → Competitive (CS-style)</strong></p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
              <span style={{ opacity: 0.6 }}>5</span><span>Plant Bomb (T side, in bombsite)</span>
              <span style={{ opacity: 0.6 }}>E</span><span>Defuse Bomb (CT side, near bomb)</span>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12, opacity: 0.6 }}>
              T side: Carry bomb to site A or B, hold 5 to plant (3s). Bomb explodes after 40s = T wins.
              <br />CT side: Defuse before explosion, hold E near bomb (5s with kit, 10s without) = CT wins.
            </p>
          </div>
        </div>
        
        <button onClick={onClose} style={{
          width: '100%', padding: 12, background: '#3a3a55', color: '#fff',
          border: 'none', cursor: 'pointer', fontSize: 14,
        }}>
          CLOSE
        </button>
      </div>
    </div>
  )
}
