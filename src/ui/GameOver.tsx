import React from 'react'

interface GameOverProps {
  score: number
  wave: number
  highScore: number
  onRestart: () => void
  onMenu: () => void
}

export const GameOver: React.FC<GameOverProps> = ({
  score,
  wave,
  highScore,
  onRestart,
  onMenu,
}) => {
  const isNewHighScore = score >= highScore && score > 0

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.85)',
      color: 'white',
      fontFamily: 'monospace',
    }}>
      <h1 style={{
        fontSize: 56,
        fontWeight: 'bold',
        color: '#ff0000',
        textShadow: '0 0 20px #ff0000',
        marginBottom: 20,
      }}>
        GAME OVER
      </h1>

      {isNewHighScore && (
        <div style={{
          fontSize: 24,
          color: '#ffcc00',
          textShadow: '0 0 15px #ffcc00',
          marginBottom: 20,
          animation: 'pulse 1s infinite',
        }}>
          NEW HIGH SCORE!
        </div>
      )}

      <div style={{
        padding: 30,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        marginBottom: 40,
        minWidth: 250,
      }}>
        <div style={{ marginBottom: 15, textAlign: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.5 }}>SCORE</div>
          <div style={{ fontSize: 36, fontWeight: 'bold' }}>{score.toLocaleString()}</div>
        </div>
        <div style={{ marginBottom: 15, textAlign: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.5 }}>WAVE REACHED</div>
          <div style={{ fontSize: 24 }}>{wave}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.5 }}>HIGH SCORE</div>
          <div style={{ fontSize: 20, color: '#ffcc00' }}>{highScore.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <button
          onClick={onRestart}
          style={{
            padding: '14px 36px',
            fontSize: 18,
            fontWeight: 'bold',
            background: '#ff6600',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          PLAY AGAIN
        </button>
        <button
          onClick={onMenu}
          style={{
            padding: '14px 36px',
            fontSize: 18,
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            border: '1px solid #555',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          MAIN MENU
        </button>
      </div>
    </div>
  )
}
