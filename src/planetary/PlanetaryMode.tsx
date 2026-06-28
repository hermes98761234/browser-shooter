import { useEffect, useRef, useState, useCallback } from 'react'
import { PlanetaryEngine } from './PlanetaryEngine'
import { GeoControls } from './GeoControls'
import { PlanetaryCollision } from './PlanetaryCollision'
import { MapPicker } from './MapPicker'
import { RoundBoundary } from './RoundBoundary'
import { GameSession } from '../session/GameSession'
import { defaultCompetitiveConfig } from '../session/MatchConfig'
import { Bombsite } from '../session/Bombsite'
import { RoundState } from '../session/RoundManager'
import { HUD } from '../ui/HUD'
import { BuyMenu } from '../ui/BuyMenu'
import { Scoreboard } from '../ui/Scoreboard'
import { TouchControls } from '../ui/TouchControls'
import { Viewmodel } from '../weapons/Viewmodel'
import { Controls } from '../player/Controls'
import { mobileControlsActive, loadSettings } from '../settings/Settings'
import type { EntityState } from '../session/protocol'

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
  const touchLookRef = useRef({ yaw: 0, pitch: 0 })
  const desktopControlsRef = useRef<Controls | null>(null)

  const [showPicker, setShowPicker] = useState(true)
  const [startCenter, setStartCenter] = useState<[number, number] | null>(null)
  const [boundaryStatus, setBoundaryStatus] = useState<'safe' | 'warn' | 'out'>('safe')
  const [hudState, setHudState] = useState<HudState>({
    health: 100, maxHealth: 100, ammo: 30, maxAmmo: 30, weaponName: 'pistol', money: 800,
  })
  const [showBuyMenu, setShowBuyMenu] = useState(false)
  const [showScoreboard, setShowScoreboard] = useState(false)
  const [roundState, setRoundState] = useState<{ state: RoundState; round: number; ctScore: number; tScore: number; buyTimer: number; roundTimer: number } | null>(null)
  const [scoreboardPlayers, setScoreboardPlayers] = useState<EntityState[]>([])
  const [killFeed, setKillFeed] = useState<{ id: number; attacker: string; victim: string; ts?: number }[]>([])
  const [isDead, setIsDead] = useState(false)
  const [respawnIn, setRespawnIn] = useState<number | null>(null)
  const killSeqRef = useRef(0)
  const lastBuildingsVersionRef = useRef(-1)
  const mouseShootRef = useRef(false)
  const [mobileControls] = useState(() => mobileControlsActive(loadSettings()))
  const [csMode, setCsMode] = useState(false)

  // Auto-clear kill feed entries after 5 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setKillFeed(prev => prev.filter(k => k.ts && Date.now() - k.ts < 5000))
    }, 500)
    return () => clearInterval(id)
  }, [])

  // Engine is created lazily after the user picks a drop-in location.
  // This avoids two concurrent MapLibre/WebGL contexts during the picker phase.
  useEffect(() => {
    if (!startCenter || !containerRef.current) return
    let mounted = true
    const engine = new PlanetaryEngine(containerRef.current, startCenter)
    engineRef.current = engine

    engine.onReady(() => {
      if (!mounted) return
      const controls = new GeoControls(containerRef.current!)
      controls.attach()
      controls.setLook(0, 0) // initial: looking north, level
      controlsRef.current = controls

      collisionRef.current = new PlanetaryCollision(
        engine.map,
        (lng, lat) => engine.lngLatToLocal(lng, lat),
      )

      const config = defaultCompetitiveConfig()
      const session = new GameSession(config)
      session.collisionWorld = collisionRef.current.collisionWorld

      // Place 2 bombsites near the drop location (in meters from origin)
      session.bombsites = [
        new Bombsite('A', { x: 20, y: 0, z: 20 }),
        new Bombsite('B', { x: -20, y: 0, z: -20 }),
      ]

      // ponytail: large enough to never clamp in open-world play
      session.map.arenaSize = 5000

      // Set up round manager for competitive play
      if (session.roundManager) {
        session.roundManager.state = RoundState.Buying
        session.roundManager.buyPhaseTimer = config.buyPhaseDuration ?? 15
      }

      // Add viewmodel (first-person gun) to the camera
      const viewmodel = new Viewmodel(engine.camera)
      engine.scene.add(engine.camera) // ensure camera is in scene graph

      // Create a Controls instance for touch input (TouchControls writes to it)
      const gameControls = new Controls(containerRef.current!, () => 'planetary', { ...loadSettings().keymap })
      desktopControlsRef.current = gameControls

      sessionRef.current = session

      let last = performance.now()
      function loop(now: number) {
        const dt = Math.min((now - last) / 1000, 0.05)
        last = now

        // 1. Get input from GeoControls (keyboard) and merge with touch
        const input = controls.getInput()
        const touch = desktopControlsRef.current
        if (touch) {
          const mv = touch.getMovement()
          input.forward = input.forward || mv.forward
          input.backward = input.backward || mv.backward
          input.left = input.left || mv.left
          input.right = input.right || mv.right
          input.jump = input.jump || mv.jump
          input.shoot = input.shoot || touch.shoot || mouseShootRef.current
        } else {
          input.shoot = input.shoot || mouseShootRef.current
        }

        // 2. Look: write GeoControls yaw/pitch into player rotation
        if (touchLookRef.current.yaw !== 0 || touchLookRef.current.pitch !== 0) {
          controlsRef.current!.yaw -= touchLookRef.current.yaw * 60 * 0.002
          controlsRef.current!.pitch -= touchLookRef.current.pitch * 60 * 0.002
          controlsRef.current!.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, controlsRef.current!.pitch))
          touchLookRef.current.yaw = 0
          touchLookRef.current.pitch = 0
        }
        const gc = controlsRef.current!
        session.player.rotation.y = gc.yaw
        session.player.rotation.x = gc.pitch
        input.yaw = gc.yaw
        input.pitch = gc.pitch

        // 3. Apply input to the session so the logical player moves
        session.applyInput(session.localId, input)

        // 4. Step the session (movement, combat, bots)
        const events = session.step(dt)

        // 4. Update the Three.js camera from player state (eye pos + look).
        const p = session.player.position
        engine.setViewFromPlayer(p, session.player.rotation.y, session.player.rotation.x)

        // 5. Process session events for round flow
        let scoreboardDirty = false
        for (const ev of events) {
          switch (ev.type) {
            case 'roundStart':
              setRoundState({
                state: RoundState.Active,
                round: ev.round,
                ctScore: ev.ctScore,
                tScore: ev.tScore,
                buyTimer: 0,
                roundTimer: 115,
              })
              scoreboardDirty = true
              break
            case 'buyPhaseStart':
              setShowBuyMenu(true)
              setRoundState(prev => prev ? { ...prev, state: RoundState.Buying, buyTimer: ev.duration } : null)
              break
            case 'roundEnd':
              setShowBuyMenu(false)
              setIsDead(false)
              setRespawnIn(null)
              setRoundState(prev => prev ? { ...prev, state: RoundState.Over, ctScore: ev.ctScore, tScore: ev.tScore } : null)
              scoreboardDirty = true
              break
            case 'matchOver':
              setShowBuyMenu(false)
              setRoundState(prev => prev ? { ...prev, state: RoundState.Over } : null)
              break
            case 'playerKilledPlayer': {
              const a = session.getPlayer(ev.attackerId)?.name ?? 'Unknown'
              const v = session.getPlayer(ev.victimId)?.name ?? 'Unknown'
              const id = killSeqRef.current++
              setKillFeed(prev => [...prev.slice(-4), { id, attacker: a, victim: v, ts: Date.now() }])
              if (ev.victimId === session.localId) {
                setIsDead(true)
              }
              scoreboardDirty = true
              break
            }
            case 'playerDied':
              if (ev.playerId === session.localId) {
                setIsDead(true)
                setRespawnIn(session.respawnQueue.isPending(session.localId) ? session.respawnQueue.remaining(session.localId) : null)
              }
              scoreboardDirty = true
              break
            case 'playerRespawned':
              if (ev.playerId === session.localId) {
                setIsDead(false)
                setRespawnIn(null)
              }
              scoreboardDirty = true
              break
            case 'bombPlanted':
              break
            case 'bombExploded':
            case 'bombDefused':
              break
          }
        }

        // Only update timers per-frame; event handlers own state/scores
        if (session.roundManager) {
          setRoundState(prev => prev ? {
            ...prev,
            buyTimer: session.roundManager!.buyPhaseTimer,
            roundTimer: session.roundManager!.roundTimer,
          } : null)
        }

        // Scoreboard only updates when a kill/death/respawn event occurs
        if (scoreboardDirty) {
          setScoreboardPlayers(session.getSnapshot().players.map(p => ({
            id: p.id, kind: 'player', type: 'player',
            position: p.position, rotationY: p.rotationY, rotationX: p.rotationX,
            health: p.health, isDead: p.isDead, weaponType: p.weaponType,
            name: p.name, team: p.team, isBot: p.isBot,
            respawnIn: p.respawnIn, hasArmor: p.hasArmor, hasHelmet: p.hasHelmet,
          })))
        }

        // 5. Keep the (hidden) map centered on the player so vector tiles load.
        const [lng, lat] = engine.localToLngLat(p.x, p.z)
        engine.map.setCenter([lng, lat])

        // 6. Rebuild collision near the player; mirror the boxes into the visible scene.
        const center = engine.map.getCenter()
        if (collisionRef.current) {
          session.collisionWorld = collisionRef.current.update(center.lng, center.lat)
          // Re-mesh exactly when (and only when) the collision world was actually rebuilt.
          const v = collisionRef.current.rebuildVersion
          if (v !== lastBuildingsVersionRef.current) {
            lastBuildingsVersionRef.current = v
            engine.setBuildings(collisionRef.current.collisionWorld.boxes)
          }
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

        // 9. Draw the FPS scene (lazily creates the WebGL canvas on first frame).
        engine.render()
        viewmodel.update(dt, false)

        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    })

    return () => {
      mounted = false
      cancelAnimationFrame(rafRef.current)
      controlsRef.current?.detach()
      desktopControlsRef.current?.destroy()
      engine.dispose()
      engineRef.current = null
    }
  }, [startCenter])

  // Keyboard handler for buy menu, scoreboard, bomb plant/defuse
  useEffect(() => {
    if (showPicker) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyB') {
        setShowBuyMenu(prev => !prev)
      } else if (e.code === 'Tab') {
        e.preventDefault()
        setShowScoreboard(true)
      } else if (e.code === 'Digit5') {
        if (sessionRef.current) {
          sessionRef.current.tryPlant(sessionRef.current.localId)
        }
      } else if (e.code === 'KeyE') {
        if (sessionRef.current) {
          sessionRef.current.tryDefuse(sessionRef.current.localId, false)
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        setShowScoreboard(false)
      }
    }
    const handleMouseDown = (e: MouseEvent) => { if (e.button === 0) mouseShootRef.current = true }
    const handleMouseUp = (e: MouseEvent) => { if (e.button === 0) mouseShootRef.current = false }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [showPicker])

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
      engineRef.current.map.flyTo({ center: [lng, lat], zoom: 17, pitch: 0, duration: 1500 })
      engineRef.current.map.once('idle', () => {
        if (collisionRef.current && engineRef.current) {
          const c = engineRef.current.map.getCenter()
          collisionRef.current.update(c.lng, c.lat)
        }
      })
    }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, filter: csMode ? 'saturate(0.7) contrast(1.1)' : 'none' }}>
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

      {!showPicker && showBuyMenu && (
        <BuyMenu
          team="ct"
          money={hudState.money}
          owned={[]}
          onBuy={(itemId) => {
            const session = sessionRef.current
            if (!session || !session.economy) return
            import('../weapons/StoreCatalog').then(({ findItem, canAffordItem }) => {
              import('../player/applyPurchase').then(({ applyItem }) => {
                if (canAffordItem(session.economy!.money, itemId)) {
                  const item = findItem(itemId)
                  if (item) {
                    session.economy!.spendMoney(item.price)
                    applyItem(item, session.player, session.weaponManager)
                  }
                }
              })
            })
          }}
          onClose={() => setShowBuyMenu(false)}
        />
      )}

      {!showPicker && showScoreboard && (
        <Scoreboard
          players={scoreboardPlayers}
        />
      )}

      {!showPicker && !showBuyMenu && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          pointerEvents: 'none', zIndex: 50,
        }}>
          <div style={{ width: 2, height: 14, background: '#0f0', position: 'absolute', left: -1, top: -20 }} />
          <div style={{ width: 2, height: 14, background: '#0f0', position: 'absolute', left: -1, top: 10 }} />
          <div style={{ width: 14, height: 2, background: '#0f0', position: 'absolute', top: -1, left: -20 }} />
          <div style={{ width: 14, height: 2, background: '#0f0', position: 'absolute', top: -1, left: 10 }} />
        </div>
      )}

      {!showPicker && roundState && roundState.state !== 'over' && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 16, zIndex: 50, pointerEvents: 'none',
          fontFamily: 'monospace', fontSize: 14,
        }}>
          <span style={{ color: '#3a6ea5', fontWeight: 'bold' }}>CT {roundState.ctScore}</span>
          <span style={{ color: '#888' }}>
            {roundState.state === 'buying' ? `BUY ${Math.ceil(roundState.buyTimer)}s` : `${Math.ceil(roundState.roundTimer)}s`}
          </span>
          <span style={{ color: '#a5703a', fontWeight: 'bold' }}>{roundState.tScore} T</span>
        </div>
      )}

      {!showPicker && killFeed.length > 0 && (
        <div style={{
          position: 'absolute', top: 80, right: 16, display: 'flex', flexDirection: 'column',
          gap: 4, zIndex: 50, pointerEvents: 'none',
        }}>
          {killFeed.slice(-5).map(k => (
            <div key={k.id} style={{
              background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px',
              fontSize: 12, fontFamily: 'monospace', borderRadius: 4,
            }}>
              <span style={{ color: '#3a6ea5' }}>{k.attacker}</span>
              <span style={{ color: '#888' }}> → </span>
              <span style={{ color: '#a5703a' }}>{k.victim}</span>
            </div>
          ))}
        </div>
      )}

      {!showPicker && isDead && (
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
          color: '#ff3300', fontSize: 24, fontFamily: 'monospace', fontWeight: 'bold',
          textShadow: '0 0 12px rgba(0,0,0,0.9)', pointerEvents: 'none', zIndex: 55,
        }}>
          YOU DIED
          {respawnIn !== null && (
            <div style={{ fontSize: 16, color: '#ffaa00', marginTop: 8 }}>
              Respawn in {Math.ceil(respawnIn)}s
            </div>
          )}
        </div>
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

      {/* Overlay buttons sit above TouchControls look pad (zIndex: 25).
          onPointerDown.stopPropagation prevents the full-screen look pad from
          eating touch events on mobile — without it, onClick never fires. */}
      <button
        onClick={() => setShowPicker(true)}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 16, left: 16, padding: '6px 12px',
          background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
          borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
          zIndex: 100,
        }}
      >
        [M] Map
      </button>

      <button
        onClick={() => setCsMode(v => !v)}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 52, left: 16, padding: '6px 12px',
          background: csMode ? '#ff6600' : 'rgba(0,0,0,0.6)', color: 'white',
          border: '1px solid #555', borderRadius: 4, cursor: 'pointer',
          fontSize: 12, fontFamily: 'monospace', zIndex: 100,
        }}
      >
        [V] {csMode ? 'View Default Mode' : 'View CS Mode'}
      </button>

      <button
        onClick={onExit}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 16, right: 16, padding: '6px 12px',
          background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
          borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
          zIndex: 100,
        }}
      >
        Exit
      </button>

      {/* Mobile touch controls */}
      {!showPicker && !showBuyMenu && desktopControlsRef.current && mobileControls && (
        <TouchControls
          controls={desktopControlsRef.current}
          lookRef={touchLookRef}
          lookSensitivity={1}
          onReload={() => { if (sessionRef.current) sessionRef.current.weaponManager.current.reload() }}
          onCycleWeapon={() => { if (sessionRef.current) sessionRef.current.weaponManager.cycleNext() }}
          onToggleStore={() => setShowBuyMenu(prev => !prev)}
          onToggleScoreboard={() => setShowScoreboard(prev => !prev)}
          onSelectGrenade={() => {}}
        />
      )}
    </div>
  )
}
