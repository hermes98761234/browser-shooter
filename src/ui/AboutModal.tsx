interface AboutModalProps {
  onClose: () => void
}

export const AboutModal = ({ onClose }: AboutModalProps) => {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', zIndex: 100, fontFamily: 'monospace', color: '#fff',
    }}>
      <div style={{
        background: '#15151f', border: '1px solid #3a3a55', padding: 32,
        minWidth: 320, maxWidth: 400,
      }}>
        <h2 style={{ margin: '0 0 20px', color: '#ff6600' }}>About</h2>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#8a8aad', fontSize: 12 }}>VERSION</div>
          <div style={{ fontSize: 18 }}>0.1.0</div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#8a8aad', fontSize: 12 }}>BUILD</div>
          <div style={{ fontSize: 14 }}>Browser Shooter</div>
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: '#8a8aad', fontSize: 12 }}>CREDITS</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            Built with Three.js, React, Vite
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
