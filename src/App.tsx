import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GameEngine } from './engine/GameEngine'
import { createArena } from './engine/Arena'
import { Controls } from './player/Controls'
import { Viewmodel } from './weapons/Viewmodel'
import { Pickup } from './systems/Pickup'
import type { PickupType } from './systems/Pickup'
import { ParticleSystem } from './effects/ParticleSystem'
import { AudioManager } from './audio/AudioManager'
import { SoundEffects } from './audio/SoundEffects'
import { createDamageIndicatorState, triggerDamage, updateDamageIndicator, type DamageIndicatorState } from './effects/DamageIndicator'
import type { GameState } from './types'
import { GameSession, ARENA_SIZE } from './session/GameSession'
import { emptyInput } from './session/protocol'
import { HUD } from './ui/HUD'
import { Minimap } from './ui/Minimap'
import { WaveAnnounce } from './ui/WaveAnnounce'
import { MainMenu } from './ui/MainMenu'
import { GameOver } from './ui/GameOver'
import { PauseMenu } from './ui/PauseMenu'
import { DamageOverlay } from './ui/DamageOverlay'

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const [gameState, setGameState] = useState<GameState>('menu')
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(0)
  const [health, setHealth] = useState(100)
  const [ammo, setAmmo] = useState(60)
  const [weaponName, setWeaponName] = useState('Pistol')
  const [waveActive, setWaveActive] = useState(false)
  const [enemiesRemaining, setEnemiesRemaining] = useState(0)
  const [playerPos, setPlayerPos] = useState(new THREE.Vector3())
  const [playerRot, setPlayerRot] = useState(0)
  const [enemyPositions, setEnemyPositions] = useState<THREE.Vector3[]>([])
  const [highScore, setHighScore] = useState(0)
  const [damageIndicator, setDamageIndicator] = useState<DamageIndicatorState | null>(null)
  const [showWaveAnnounce, setShowWaveAnnounce] = useState(false)
  const lastWaveRef = useRef(0)
  const gameStateRef = useRef<GameState>('menu')

  const updateGameState = useCallback((state: GameState) => {
    gameStateRef.current = state
    setGameState(state)
  }, [])

  const lookRef = useRef({ yaw: 0, pitch: 0 })

  const gameDataRef = useRef({
    session: new GameSession(),
    controls: null as Controls | null,
    particleSystem: null as ParticleSystem | null,
    viewmodel: null as Viewmodel | null,
    audio: new SoundEffects(new AudioManager()),
    damageIndicator: createDamageIndicatorState(),
    money: 800, // local stub for the buy store (Phase 3 makes this real)
  })

  const startGame = useCallback(() => {
    const data = gameDataRef.current
    const scene = engineRef.current?.scene
    for (const enemy of data.session.enemies) { scene?.remove(enemy.mesh); enemy.dispose() }
    for (const pickup of data.session.pickups) { scene?.remove(pickup.mesh); pickup.dispose() }

    const fresh = new GameSession()
    fresh.collisionWorld = data.session.collisionWorld
    fresh.waveManager.wavePauseTimer = 2 // 2s grace before wave 1 (matches pre-refactor behavior)
    fresh.waveManager.onEnemySpawned = data.session.waveManager.onEnemySpawned
    fresh.waveManager.onWaveComplete = data.session.waveManager.onWaveComplete
    data.session = fresh
    lookRef.current = { yaw: 0, pitch: 0 }
    data.money = 800

    if (data.particleSystem) data.particleSystem.clear()
    data.damageIndicator = createDamageIndicatorState()

    setScore(0); setWave(0); setHealth(100); setAmmo(60); setWeaponName('Pistol')
    data.viewmodel?.setWeapon('pistol')
    setWaveActive(false); setEnemiesRemaining(0); setEnemyPositions([]); setDamageIndicator(null)

    engineRef.current?.start()
    data.audio.init(); data.audio.loadSounds()
    updateGameState('playing')
  }, [updateGameState])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const engine = new GameEngine(container)
    engineRef.current = engine
    const data = gameDataRef.current
    data.session.collisionWorld = createArena(engine.scene)
    engine.scene.add(engine.camera) // so the camera-parented viewmodel renders
    data.viewmodel = new Viewmodel(engine.camera)
    data.particleSystem = new ParticleSystem(engine.scene)
    data.controls = new Controls(container)
    data.controls.onMouseMove = onMouseMove
    data.controls.onCycleWeapon = () => {
      if (gameStateRef.current !== 'playing') return
      const wm = gameDataRef.current.session.weaponManager
      wm.cycleNext()
      setWeaponName(wm.current.def.name)
      setAmmo(wm.current.ammo)
      gameDataRef.current.viewmodel?.setWeapon(wm.current.type)
    }

    data.session.waveManager.onEnemySpawned = (enemy) => {
      gameDataRef.current.session.enemies.push(enemy)
      engine.scene.add(enemy.mesh)
    }

    data.session.waveManager.onWaveComplete = () => {
      const session = gameDataRef.current.session
      session.scoreSystem.completeWave()
      setWave(session.scoreSystem.wave)
      setScore(session.scoreSystem.score)
      const pickupTypes: PickupType[] = ['health', 'ammo']
      for (let i = 0; i < 3; i++) {
        const type = pickupTypes[Math.floor(Math.random() * pickupTypes.length)]
        const pos = new THREE.Vector3((Math.random() - 0.5) * ARENA_SIZE * 1.5, 0, (Math.random() - 0.5) * ARENA_SIZE * 1.5)
        const pickup = new Pickup(type, pos)
        session.pickups.push(pickup)
        engine.scene.add(pickup.mesh)
      }
      data.audio.playWaveStart()
    }

    engine.onUpdate((dt) => {
      const session = data.session
      const controls = data.controls
      const particleSystem = data.particleSystem!
      if (!controls) return

      const m = controls.getMovement()
      const input = {
        ...emptyInput(),
        forward: m.forward, backward: m.backward, left: m.left, right: m.right, jump: m.jump,
        shoot: controls.shoot,
        yaw: lookRef.current.yaw,
        pitch: lookRef.current.pitch,
      }
      session.applyInput(session.localId, input)

      const enemiesBefore = new Set(session.enemies)
      const pickupsBefore = new Set(session.pickups)

      const events = session.step(dt)

      engine.camera.position.copy(session.player.position)
      engine.camera.rotation.copy(session.player.rotation)
      data.audio.updateListenerPosition(session.player.position.x, session.player.position.y, session.player.position.z)
      const isMoving = m.forward || m.backward || m.left || m.right
      data.viewmodel?.update(dt, isMoving)

      for (const ev of events) {
        switch (ev.type) {
          case 'playerHitEnemy': {
            const p = ev.hit.point
            const point = new THREE.Vector3(p.x, p.y, p.z)
            if (ev.hit.killed) {
              data.particleSystem!.explosion(point, ev.enemyType)
              data.audio.playEnemyDeath(point)
            } else {
              data.particleSystem!.bloodSplatter(point)
              data.audio.playEnemyHit(point)
            }
            break
          }
          case 'enemyKilled':
            setScore(session.scoreSystem.score)
            break
          case 'wallImpact':
            data.particleSystem!.bulletImpact(new THREE.Vector3(ev.point.x, ev.point.y, ev.point.z))
            break
          case 'enemyShoot': {
            const from = new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z)
            const to = new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z)
            data.audio.playWeaponShoot('rifle', from)
            particleSystem.tracer(from, to)
            if (ev.hit) {
              data.audio.playPlayerHit()
              setHealth(session.player.health)
              data.damageIndicator = triggerDamage(from.clone(), session.player.position.clone(), session.player.rotation.y)
              setDamageIndicator({ ...data.damageIndicator })
            }
            break
          }
          case 'enemyMelee':
            data.audio.playPlayerHit()
            setHealth(session.player.health)
            data.damageIndicator = triggerDamage(
              new THREE.Vector3(ev.enemyPos.x, ev.enemyPos.y, ev.enemyPos.z), session.player.position.clone(), session.player.rotation.y)
            setDamageIndicator({ ...data.damageIndicator })
            break
          case 'enemyTelegraph':
            particleSystem.muzzleFlash(
              new THREE.Vector3(ev.enemyPos.x, 1.35, ev.enemyPos.z),
              new THREE.Vector3(ev.facing.x, ev.facing.y, ev.facing.z))
            break
          case 'pickup':
            if (ev.pickupType === 'health') setHealth(session.player.health)
            data.audio.playPickup()
            break
          case 'playerDied':
            document.exitPointerLock()
            data.audio.playPlayerDeath()
            session.scoreSystem.saveHighScore()
            setHighScore(session.scoreSystem.highScore)
            engine.stop()
            updateGameState('gameover')
            return
        }
      }

      // Player fire feedback (muzzle flash + recoil + sound): the weapon fired this frame
      // iff step() just reset fireTimer to def.fireRate this tick.
      if (controls.shoot && session.weaponManager.current.fireTimer > session.weaponManager.current.def.fireRate - dt) {
        data.viewmodel?.fire()
        data.audio.playWeaponShoot(session.weaponManager.current.type, session.player.position)
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(engine.camera.quaternion)
        particleSystem.muzzleFlash(session.player.position.clone().add(fwd), fwd)
      }

      // Reconcile removed enemies/pickups → dispose their meshes.
      for (const e of enemiesBefore) {
        if (!session.enemies.includes(e)) { engine.scene.remove(e.mesh); e.dispose() }
      }
      for (const pk of pickupsBefore) {
        if (!session.pickups.includes(pk)) { engine.scene.remove(pk.mesh); pk.dispose() }
      }

      setAmmo(session.weaponManager.current.ammo)
      setWeaponName(session.weaponManager.current.def.name)
      setWaveActive(session.waveManager.waveActive)
      setWave(session.waveManager.currentWave)
      setEnemiesRemaining(session.waveManager.enemiesRemaining)
      if (session.waveManager.currentWave > lastWaveRef.current) {
        lastWaveRef.current = session.waveManager.currentWave
        setShowWaveAnnounce(true)
        setTimeout(() => setShowWaveAnnounce(false), 2600)
      }
      setEnemyPositions(session.enemies.map(e => e.mesh.position.clone()))
      setPlayerPos(session.player.position.clone())
      setPlayerRot(session.player.rotation.y)

      particleSystem.update(dt)
      data.damageIndicator = updateDamageIndicator(data.damageIndicator, dt)
      if (data.damageIndicator.active) setDamageIndicator({ ...data.damageIndicator })
      else if (damageIndicator !== null) setDamageIndicator(null)
    })

    function onMouseMove(e: MouseEvent) {
      const look = lookRef.current
      look.yaw -= e.movementX * 0.002
      look.pitch -= e.movementY * 0.002
      look.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, look.pitch))
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const data = gameDataRef.current
      if (e.code === 'Escape' && gameStateRef.current === 'playing') {
        document.exitPointerLock()
        engineRef.current?.pause()
        updateGameState('paused')
      } else if (e.code === 'Escape' && gameStateRef.current === 'paused') {
        engineRef.current?.resume()
        updateGameState('playing')
      }

      if (e.code === 'KeyM') {
        data.audio.toggleMute()
      }

      if (e.code === 'KeyR') {
        data.session.weaponManager.current.reload()
      }

      const weaponKeys: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2 }
      if (e.code in weaponKeys) {
        data.session.weaponManager.switchByIndex(weaponKeys[e.code])
        setWeaponName(data.session.weaponManager.current.def.name)
        setAmmo(data.session.weaponManager.current.ammo)
        data.viewmodel?.setWeapon(data.session.weaponManager.current.type)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousemove', onMouseMove)
      data.controls?.destroy()
      data.viewmodel?.dispose()
      engine.stop()
    }
  }, [updateGameState])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {gameState === 'menu' && <MainMenu onStart={startGame} />}

      {gameState === 'playing' && (
        <>
          <HUD
            health={health}
            maxHealth={100}
            ammo={ammo}
            maxAmmo={gameDataRef.current.session.weaponManager.current.def.maxAmmo}
            weaponName={weaponName}
            score={score}
            wave={wave}
            waveActive={waveActive}
            enemiesRemaining={enemiesRemaining}
          />
          <Minimap
            playerPosition={playerPos}
            playerRotation={playerRot}
            enemies={enemyPositions}
            arenaSize={ARENA_SIZE}
          />
          <WaveAnnounce wave={wave} visible={showWaveAnnounce} />
          <DamageOverlay indicator={damageIndicator} />
        </>
      )}

      {gameState === 'paused' && (
        <PauseMenu
          onResume={() => {
            engineRef.current?.resume()
            updateGameState('playing')
          }}
          onMainMenu={() => {
            engineRef.current?.stop()
            updateGameState('menu')
          }}
        />
      )}

      {gameState === 'gameover' && (
        <GameOver
          score={score}
          wave={wave}
          highScore={highScore}
          onRestart={startGame}
          onMenu={() => {
            engineRef.current?.stop()
            updateGameState('menu')
          }}
        />
      )}
    </div>
  )
}

export default App
