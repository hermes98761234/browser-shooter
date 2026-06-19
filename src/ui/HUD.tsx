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
  grenadeInventory?: { he: number; flash: number; smoke: number }
  selectedGrenade?: string | null
  /** When the on-screen touch controls are active, relocate HUD clusters so
      they don't sit underneath the joystick / fire button. */
  mobile?: boolean
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
  grenadeInventory,
  selectedGrenade,
  mobile,
}) => {
  const healthPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0
  const healthColor = healthPercent > 60 ? '#00ff00' : healthPercent > 30 ? '#ffff00' : '#ff0000'

  // On touch devices the bottom corners belong to the joystick (left) and fire
  // button (right), so move the health bar to the bottom-centre and the ammo
  // readout just above the fire button. Safe-area vars are 0 on desktop.
  const healthPos: React.CSSProperties = mobile
    ? { bottom: 'calc(16px + var(--safe-bottom))', left: '50%', transform: 'translateX(-50%)', width: 'min(200px, 46vw)' }
    : { bottom: 'calc(20px + var(--safe-bottom))', left: 'calc(20px + var(--safe-left))', width: 'min(200px, 40vw)' }
  const ammoPos: React.CSSProperties = mobile
    ? { bottom: 'calc(78px + var(--safe-bottom))', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }
    : { bottom: 'calc(20px + var(--safe-bottom))', right: 'calc(20px + var(--safe-right))', textAlign: 'right' }

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
        <div style={{ position: 'absolute', top: 'calc(10px + var(--safe-top))', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
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

      {/* Money (competitive mode) — inset on touch to clear the grenade row and
          the right-edge action column. */}
      {money !== undefined && (
        <div style={{ position: 'absolute', top: mobile ? 'calc(74px + var(--safe-top))' : 'calc(10px + var(--safe-top))', right: mobile ? 'calc(86px + var(--safe-right))' : 'calc(10px + var(--safe-right))', fontSize: 18, fontFamily: 'monospace', color: '#00ff00' }}>
          ${money}
        </div>
      )}

      {/* Health bar */}
      <div style={{
        position: 'absolute',
        ...healthPos,
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
        ...ammoPos,
      }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>{weaponName}</div>
        <div style={{ fontSize: 32, fontWeight: 'bold', textShadow: '0 0 10px black' }}>
          {ammo}
        </div>
        <div style={{ fontSize: 12, opacity: 0.5 }}>/ {maxAmmo}</div>
      </div>

      {/* Grenade inventory — hidden on touch, where TouchControls shows its own selector */}
      {grenadeInventory && !mobile && (
        <div style={{ position: 'absolute', bottom: 80, right: 20, display: 'flex', gap: 8 }}>
          {grenadeInventory.he > 0 && (
            <div style={{ 
              padding: '4px 8px', 
              background: selectedGrenade === 'he' ? '#4a5c3a' : 'rgba(0,0,0,0.5)',
              border: selectedGrenade === 'he' ? '2px solid #7a9c5a' : '1px solid #555',
              borderRadius: 4,
              color: '#fff',
              fontSize: 12
            }}>
              4: HE ×{grenadeInventory.he}
            </div>
          )}
          {grenadeInventory.flash > 0 && (
            <div style={{ 
              padding: '4px 8px', 
              background: selectedGrenade === 'flash' ? '#c0c0c0' : 'rgba(0,0,0,0.5)',
              border: selectedGrenade === 'flash' ? '2px solid #fff' : '1px solid #555',
              borderRadius: 4,
              color: selectedGrenade === 'flash' ? '#000' : '#fff',
              fontSize: 12
            }}>
              5: Flash ×{grenadeInventory.flash}
            </div>
          )}
          {grenadeInventory.smoke > 0 && (
            <div style={{ 
              padding: '4px 8px', 
              background: selectedGrenade === 'smoke' ? '#3a5c3a' : 'rgba(0,0,0,0.5)',
              border: selectedGrenade === 'smoke' ? '2px solid #5a9c5a' : '1px solid #555',
              borderRadius: 4,
              color: '#fff',
              fontSize: 12
            }}>
              6: Smoke ×{grenadeInventory.smoke}
            </div>
          )}
        </div>
      )}

      {/* Score — moved to top-centre on touch, where the right edge is taken by
          the action column / fire button. */}
      <div style={mobile ? {
        position: 'absolute',
        top: 'calc(74px + var(--safe-top))',
        left: '50%', transform: 'translateX(-50%)', textAlign: 'center',
      } : {
        position: 'absolute',
        top: 'calc(20px + var(--safe-top))',
        right: 'calc(20px + var(--safe-right))',
        textAlign: 'right',
      }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>SCORE</div>
        <div style={{ fontSize: 24, fontWeight: 'bold' }}>{score.toLocaleString()}</div>
      </div>

      {/* Wave info */}
      <div style={{
        position: 'absolute',
        top: mobile && round !== undefined ? 'calc(54px + var(--safe-top))' : 'calc(20px + var(--safe-top))',
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
          width: 'min(200px, 60vw)',
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
          width: 'min(200px, 60vw)',
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
