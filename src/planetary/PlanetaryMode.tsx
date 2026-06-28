import { useEffect, useRef, useState, useCallback } from 'react'
import { PlanetaryEngine } from './PlanetaryEngine'
import { GeoControls } from './GeoControls'
import { PlanetaryCollision } from './PlanetaryCollision'
import { PlanetaryNavmesh } from './PlanetaryNavmesh'
import { MapPicker } from './MapPicker'
import { RoundBoundary } from './RoundBoundary'
import { GameSession } from '../session/GameSession'
import { defaultCompetitiveConfig } from '../session/MatchConfig'
import { HUD } from '../ui/HUD'

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
  const navmeshRef = useRef<PlanetaryNavmesh | null>(null)
  const sessionRef = useRef<GameSession | null>(null)
  const boundaryRef = useRef<RoundBoundary>(new RoundBoundary())
  const rafRef = useRef<number>(0)

  const [showPicker, setShowPicker] = useState(true)
  const [boundaryStatus, setBoundaryStatus] = useState<'safe' | 'warn' | 'out'>('safe')
  const [hudState, setHudState] = useState<HudState>({
    health: 100, maxHealth: 100, ammo: 30, maxAmmo: 30, weaponName: 'pistol', money: 800,
  })
  const [remoteDots] = useState<Array<{ id: string; lng: number; lat: number; team: 'ct' | 't' }>>([])

  useEffect(() => {
    if (!containerRef.current) return
    const engine = new PlanetaryEngine(containerRef.current)
    engineRef.current = engine

    engine.onReady(() => {
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
      navmeshRef.current = new PlanetaryNavmesh()
      navmeshRef.current.build(engine.map)

      // GameSession uses MatchConfig — competitive mode, no zone (planetary provides the map)
      const config = { ...defaultCompetitiveConfig(), zoneId: undefined }
      const session = new GameSession(config)
      session.collisionWorld = collisionRef.current.collisionWorld
      // Add 5 bots split across teams
      for (let i = 0; i < 3; i++) session.addBot('ct')
      for (let i = 0; i < 2; i++) session.addBot('t')
      sessionRef.current = session

      let last = performance.now()
      function loop(now: number) {
        const dt = Math.min((now - last) / 1000, 0.05)
        last = now
        controls.update(dt)

        const center = engine.map.getCenter()

        // Update collision from visible tiles
        if (collisionRef.current) {
          session.collisionWorld = collisionRef.current.update(center.lng, center.lat)
        }

        // Advance game simulation: bots, combat, round logic
        session.step(dt)

        // Check round boundary
        const status = boundaryRef.current.check(center.lng, center.lat)
        setBoundaryStatus(status)
        if (status === 'out' && !session.player.isDead) {
          session.player.takeDamage(50 * dt)
        }

        // Sync HUD state from session
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
      cancelAnimationFrame(rafRef.current)
      controlsRef.current?.detach()
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  const handleTeleport = useCallback((lng: number, lat: number) => {
    setShowPicker(false)
    engineRef.current?.map.flyTo({ center: [lng, lat], zoom: 17, pitch: 60, duration: 1500 })
    setTimeout(() => {
      if (navmeshRef.current && engineRef.current) {
        navmeshRef.current.build(engineRef.current.map)
        boundaryRef.current.update([[lng, lat]])
      }
    }, 2000)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        tabIndex={0}
        style={{ width: '100%', height: '100%', outline: 'none' }}
        onClick={() => containerRef.current?.requestPointerLock()}
      />

      {showPicker && (
        <MapPicker
          playerPositions={remoteDots}
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
