import React from 'react'

interface HUDProps {
  health: number
  maxHealth: number
  ammo: number
  maxAmmo: number
  weaponName: string
  score: number
  wave: number
  waveActive: boolean
  enemiesRemaining: number
  round?: number
  roundTimer?: number
  buyPhase?: boolean
  buyPhaseTimer?: number
  money?: number
  ctScore?: number
  tScore?: number
  bombState?: 'none' | 'carried' | 'dropped' | 'planting' | 'planted' | 'defusing' | 'defused' | 'exploded'
  bombTimer?: number
  bombSite?: 'A' | 'B'
  plantProgress?: number
  defuseProgress?: number
}

export const HUD: React.FC<HUDProps> = ({
  health,
  maxHealth,
  ammo,
  maxAmmo,
  weaponName,
  score,
  wave,
  waveActive,
  enemiesRemaining,
  round,
  roundTimer,
  buyPhase,
  buyPhaseTimer,
  money,
  ctScore,
  tScore,
  bombState,
  bombTimer,
  bombSite,
  plantProgress,
  defuseProgress,
}) => {
  const healthPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0
  const healthColor = healthPercent > 60 ? '#00ff00' : healthPercent > 30 ? '#ffff00' : '#ff0000'

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      fontFamily: 'monospace',
      color: 'white',
    }}>
      {/* Crosshair is rendered separately (see <Crosshair/> in App) so it can animate
          its dynamic bloom without re-rendering the HUD every frame. */}

      {/* Round info (competitive mode) */}
      {round !== undefined && (
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontFamily: 'monospace', color: '#fff' }}>
            Round {round} | CT: {ctScore} - T: {tScore}
          </div>
          {buyPhase ? (
            <div style={{ fontSize: 16, color: '#ffcc00', textAlign: 'center' }}>
              BUY PHASE: {Math.ceil(buyPhaseTimer ?? 0)}s
            </div>
          ) : (
            <div style={{ fontSize: 16, color: '#fff', textAlign: 'center' }}>
              {Math.ceil(roundTimer ?? 0)}s
            </div>
          )}
        </div>
      )}

      {/* Money (competitive mode) */}
      {money !== undefined && (
        <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 18, fontFamily: 'monospace', color: '#00ff00' }}>
          ${money}
        </div>
      )}

      {/* Health bar */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        width: 200,
      }}>
        <div style={{ fontSize: 12, marginBottom: 4 }}>HP</div>
        <div style={{
          height: 20,
          background: '#333',
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid #555',
        }}>
          <div style={{
            width: `${healthPercent}%`,
            height: '100%',
            background: healthColor,
            transition: 'width 0.2s',
          }} />
        </div>
        <div style={{ fontSize: 12, marginTop: 2 }}>{Math.ceil(health)} / {maxHealth}</div>
      </div>

      {/* Ammo */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        textAlign: 'right',
      }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>{weaponName}</div>
        <div style={{ fontSize: 32, fontWeight: 'bold', textShadow: '0 0 10px black' }}>
          {ammo}
        </div>
        <div style={{ fontSize: 12, opacity: 0.5 }}>/ {maxAmmo}</div>
      </div>

      {/* Score */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        textAlign: 'right',
      }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>SCORE</div>
        <div style={{ fontSize: 24, fontWeight: 'bold' }}>{score.toLocaleString()}</div>
      </div>

      {/* Wave info */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>WAVE</div>
        <div style={{ fontSize: 20, fontWeight: 'bold' }}>{wave}</div>
        {waveActive && (
          <div style={{ fontSize: 12, opacity: 0.5 }}>
            {enemiesRemaining} enemies remaining
          </div>
        )}
      </div>

      {/* Wave announcement */}
      {!waveActive && wave > 0 && (
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 48,
          fontWeight: 'bold',
          textShadow: '0 0 20px #ff6600',
          color: '#ff6600',
        }}>
          WAVE {wave + 1} INCOMING
        </div>
      )}

      {/* Bomb timer when planted */}
      {bombState === 'planted' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 24,
          fontFamily: 'monospace',
          color: '#ff0000',
          textAlign: 'center',
        }}>
          <div>BOMB PLANTED AT {bombSite}</div>
          <div>{Math.ceil(bombTimer ?? 0)}s</div>
        </div>
      )}

      {/* Plant progress bar */}
      {bombState === 'planting' && (
        <div style={{
          position: 'absolute',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 200,
          height: 10,
          background: '#333',
        }}>
          <div style={{
            width: `${(plantProgress ?? 0) * 100}%`,
            height: '100%',
            background: '#ffcc00',
          }} />
        </div>
      )}

      {/* Defuse progress bar */}
      {bombState === 'defusing' && (
        <div style={{
          position: 'absolute',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 200,
          height: 10,
          background: '#333',
        }}>
          <div style={{
            width: `${(defuseProgress ?? 0) * 100}%`,
            height: '100%',
            background: '#00ff00',
          }} />
        </div>
      )}
    </div>
  )
}
