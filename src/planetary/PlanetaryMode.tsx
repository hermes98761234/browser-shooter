import { useEffect, useRef, useState, useCallback } from 'react'
import { PlanetaryEngine } from './PlanetaryEngine'
import { GeoControls } from './GeoControls'
import { PlanetaryCollision } from './PlanetaryCollision'
import { MapPicker } from './MapPicker'
import { RoundBoundary } from './RoundBoundary'
import { GameSession } from '../session/GameSession'
import { defaultCompetitiveConfig } from '../session/MatchConfig'
import { HUD } from '../ui/HUD'
import { offsetLngLat } from './geoUtils'

interface PlanetaryModeProps {
  onExit: () => void
}

interface HudState {
  health: number
  maxHealth: number
  ammo: number
  maxAmmo: number
  weaponName: string
  money: number
}

export function PlanetaryMode({ onExit }: PlanetaryModeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PlanetaryEngine | null>(null)
  const controlsRef = useRef<GeoControls | null>(null)
  const collisionRef = useRef<PlanetaryCollision | null>(null)
  const sessionRef = useRef<GameSession | null>(null)
  const boundaryRef = useRef<RoundBoundary>(new RoundBoundary())
  const rafRef = useRef<number>(0)

  const [showPicker, setShowPicker] = useState(true)
  const [startCenter, setStartCenter] = useState<[number, number] | null>(null)
  const [boundaryStatus, setBoundaryStatus] = useState<'safe' | 'warn' | 'out'>('safe')
  const [hudState, setHudState] = useState<HudState>({
    health: 100, maxHealth: 100, ammo: 30, maxAmmo: 30, weaponName: 'pistol', money: 800,
  })

  // Engine is created lazily after the user picks a drop-in location.
  // This avoids two concurrent MapLibre/WebGL contexts during the picker phase.
  useEffect(() => {
    if (!startCenter || !containerRef.current) return
    let mounted = true
    const engine = new PlanetaryEngine(containerRef.current, startCenter)
    engineRef.current = engine

    engine.onReady(() => {
      if (!mounted) return
      const controls = new GeoControls(engine.map, containerRef.current!)
      controls.attach()
      controlsRef.current = controls

      // Disable MapLibre's built-in camera handlers that fight the FPS controls
      engine.map.dragPan.disable()
      engine.map.dragRotate.disable()
      engine.map.scrollZoom.disable()
      engine.map.doubleClickZoom.disable()
      engine.map.touchZoomRotate.disable()

      collisionRef.current = new PlanetaryCollision(engine.map)

      const config = defaultCompetitiveConfig()
      const session = new GameSession(config)
      session.collisionWorld = collisionRef.current.collisionWorld
      for (let i = 0; i < 3; i++) session.addBot('ct')
      for (let i = 0; i < 2; i++) session.addBot('t')
      sessionRef.current = session

      let last = performance.now()
      function loop(now: number) {
        const dt = Math.min((now - last) / 1000, 0.05)
        last = now

        // 1. Get input from GeoControls
        const input = controls.getInput()

        // 2. Mouse look (bearing/pitch)
        input.yaw = engine.map.getBearing()
        input.pitch = engine.map.getPitch()

        // 3. Apply input to the session so the logical player moves
        session.applyInput(session.localId, input)

        // 4. Step the session (movement, combat, bots)
        session.step(dt)

        // 5. Sync map center to player's world position
        const p = session.player.position
        const [lng, lat] = offsetLngLat(startCenter[0], startCenter[1], p.x, -p.z)
        engine.map.setCenter([lng, lat])

        // 6. Update collision world
        const center = engine.map.getCenter()
        if (collisionRef.current) {
          session.collisionWorld = collisionRef.current.update(center.lng, center.lat)
        }

        // 7. Round boundary check
        const status = boundaryRef.current.check(center.lng, center.lat)
        setBoundaryStatus(status)
        if (status === 'out' && !session.player.isDead) {
          session.player.takeDamage(50 * dt)
          if (session.player.isDead) {
            session.handleDeath(session.localId)
          }
        }

        // 8. Update HUD state
        setHudState({
          health: session.player.health,
          maxHealth: session.player.maxHealth,
          ammo: session.weaponManager.current.ammo,
          maxAmmo: session.weaponManager.current.def.maxAmmo,
          weaponName: session.weaponManager.current.def.name,
          money: session.economy?.money ?? 0,
        })

        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    })

    return () => {
      mounted = false
      cancelAnimationFrame(rafRef.current)
      controlsRef.current?.detach()
      engine.dispose()
      engineRef.current = null
    }
  }, [startCenter])

  const handleTeleport = useCallback((lng: number, lat: number) => {
    // Anchor the boundary immediately so the game loop never sees [0,0] as center
    boundaryRef.current.update([[lng, lat]])
    setShowPicker(false)
    // Wait for React to unmount the picker, then focus the game canvas so
    // keydown/keyup events reach GeoControls without requiring a click first.
    requestAnimationFrame(() => containerRef.current?.focus())

    if (!engineRef.current) {
      // First drop-in: create the engine at the chosen location
      setStartCenter([lng, lat])
    } else {
      // Re-teleport: fly to the new location; rebuild collision after tiles settle
      engineRef.current.map.flyTo({ center: [lng, lat], zoom: 17, pitch: 60, duration: 1500 })
      engineRef.current.map.once('idle', () => {
        if (collisionRef.current && engineRef.current) {
          const c = engineRef.current.map.getCenter()
          collisionRef.current.update(c.lng, c.lat)
        }
      })
    }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        ref={containerRef}
        tabIndex={0}
        style={{ width: '100%', height: '100%', outline: 'none' }}
        onClick={() => containerRef.current?.requestPointerLock()}
      />

      {showPicker && (
        <MapPicker
          playerPositions={[]}
          onTeleport={handleTeleport}
          onClose={() => setShowPicker(false)}
        />
      )}

      {!showPicker && (
        <HUD
          health={hudState.health}
          maxHealth={hudState.maxHealth}
          ammo={hudState.ammo}
          maxAmmo={hudState.maxAmmo}
          weaponName={hudState.weaponName}
          score={0}
          wave={0}
          waveActive={false}
          enemiesRemaining={0}
          money={hudState.money}
        />
      )}

      {!showPicker && boundaryStatus !== 'safe' && (
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          color: boundaryStatus === 'out' ? '#ff3300' : '#ffaa00',
          fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
          textShadow: '0 0 8px rgba(0,0,0,0.8)', pointerEvents: 'none',
        }}>
          {boundaryStatus === 'out' ? '⚠ OUT OF BOUNDS — TAKING DAMAGE' : '⚠ LEAVING PLAY AREA'}
        </div>
      )}

      <button
        onClick={() => setShowPicker(true)}
        style={{
          position: 'absolute', top: 16, left: 16, padding: '6px 12px',
          background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
          borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
        }}
      >
        [M] Map
      </button>

      <button
        onClick={onExit}
        style={{
          position: 'absolute', top: 16, right: 16, padding: '6px 12px',
          background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
          borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
        }}
      >
        Exit
      </button>
    </div>
  )
}
