import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GameEngine } from './engine/GameEngine'
import { createArena } from './engine/Arena'
import { Player } from './player/Player'
import { Controls } from './player/Controls'
import { WeaponManager } from './weapons/WeaponManager'
import { Enemy } from './enemies/Enemy'
import { Viewmodel } from './weapons/Viewmodel'
import type { CollisionWorld } from './engine/CollisionWorld'
import { WaveManager } from './enemies/WaveManager'
import { ScoreSystem } from './systems/ScoreSystem'
import { Pickup } from './systems/Pickup'
import type { PickupType } from './systems/Pickup'
import { ParticleSystem } from './effects/ParticleSystem'
import { AudioManager } from './audio/AudioManager'
import { SoundEffects } from './audio/SoundEffects'
import { createDamageIndicatorState, triggerDamage, updateDamageIndicator, type DamageIndicatorState } from './effects/DamageIndicator'
import type { GameState } from './types'
import { HUD } from './ui/HUD'
import { Minimap } from './ui/Minimap'
import { WaveAnnounce } from './ui/WaveAnnounce'
import { MainMenu } from './ui/MainMenu'
import { GameOver } from './ui/GameOver'
import { PauseMenu } from './ui/PauseMenu'
import { DamageOverlay } from './ui/DamageOverlay'

const ARENA_SIZE = 30

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

  const gameDataRef = useRef({
    player: new Player(),
    controls: null as Controls | null,
    weaponManager: new WeaponManager(),
    enemies: [] as Enemy[],
    waveManager: new WaveManager(),
    scoreSystem: new ScoreSystem(),
    pickups: [] as Pickup[],
    particleSystem: null as ParticleSystem | null,
    collisionWorld: null as CollisionWorld | null,
    viewmodel: null as Viewmodel | null,
    audio: new SoundEffects(new AudioManager()),
    time: 0,
    weaponIndex: 0,
    damageIndicator: createDamageIndicatorState(),
  })

  const startGame = useCallback(() => {
    const data = gameDataRef.current
    data.player = new Player()
    data.weaponManager = new WeaponManager()
    data.enemies = []
    data.pickups = []
    data.scoreSystem.reset()
    data.waveManager.currentWave = 0
    data.waveManager.waveActive = false
    data.waveManager.wavePauseTimer = 2
    data.waveManager.enemiesRemaining = 0
    data.waveManager.spawnTimer = 0
    data.waveManager.spawnQueue = []
    data.time = 0
    data.damageIndicator = createDamageIndicatorState()

    if (data.particleSystem) data.particleSystem.clear()

    setScore(0)
    setWave(0)
    setHealth(100)
    setAmmo(60)
    setWeaponName('Pistol')
    gameDataRef.current.viewmodel?.setWeapon('pistol')
    setWaveActive(false)
    setEnemiesRemaining(0)
    setEnemyPositions([])
    setDamageIndicator(null)

    const engine = engineRef.current
    if (engine) {
      engine.start()
    }

    data.audio.init()
    data.audio.loadSounds()
    updateGameState('playing')
  }, [updateGameState])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const engine = new GameEngine(container)
    engineRef.current = engine
    const data = gameDataRef.current
    data.collisionWorld = createArena(engine.scene)
    engine.scene.add(engine.camera) // so the camera-parented viewmodel renders
    data.viewmodel = new Viewmodel(engine.camera)
    data.particleSystem = new ParticleSystem(engine.scene)
    data.controls = new Controls(container)
    data.controls.onMouseMove = onMouseMove

    data.waveManager.onEnemySpawned = (enemy) => {
      data.enemies.push(enemy)
      engine.scene.add(enemy.mesh)
    }

    data.waveManager.onWaveComplete = () => {
      data.scoreSystem.completeWave()
      setWave(data.scoreSystem.wave)
      setScore(data.scoreSystem.score)

      const pickupTypes: PickupType[] = ['health', 'ammo']
      for (let i = 0; i < 3; i++) {
        const type = pickupTypes[Math.floor(Math.random() * pickupTypes.length)]
        const pos = new THREE.Vector3(
          (Math.random() - 0.5) * ARENA_SIZE * 1.5,
          0,
          (Math.random() - 0.5) * ARENA_SIZE * 1.5
        )
        const pickup = new Pickup(type, pos)
        data.pickups.push(pickup)
        engine.scene.add(pickup.mesh)
      }

      data.audio.playWaveStart()
    }

    const shootRaycaster = new THREE.Raycaster()
    shootRaycaster.far = 100

    engine.onUpdate((dt) => {
      data.time += dt
      const player = data.player
      const controls = data.controls
      const weaponManager = data.weaponManager
      const waveManager = data.waveManager
      const particleSystem = data.particleSystem!

      if (!controls) return

      const movement = controls.getMovement()
      player.update(dt, movement, ARENA_SIZE)
      if (data.collisionWorld) data.collisionWorld.resolve(player.position, 0.5)

      engine.camera.position.copy(player.position)
      engine.camera.rotation.copy(player.rotation)
      data.audio.updateListenerPosition(player.position.x, player.position.y, player.position.z)

      const isMoving = movement.forward || movement.backward || movement.left || movement.right
      data.viewmodel?.update(dt, isMoving)

      weaponManager.update(dt)

      if (controls.shoot && weaponManager.current.canShoot()) {
        weaponManager.current.shoot()
        data.viewmodel?.fire()
        data.audio.playWeaponShoot(weaponManager.current.type, player.position)

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(engine.camera.quaternion)
        const spreadDir = weaponManager.current.getSpreadDirection(forward)

        if (weaponManager.current.type === 'shotgun') {
          for (let i = 0; i < 6; i++) {
            const dir = weaponManager.current.getSpreadDirection(forward)
            checkHit(player.position, dir, weaponManager.current.def.range, data)
          }
        } else {
          checkHit(player.position, spreadDir, weaponManager.current.def.range, data)
        }

        particleSystem.muzzleFlash(
          player.position.clone().add(spreadDir.clone().multiplyScalar(1)),
          spreadDir
        )
      }

      setAmmo(weaponManager.current.ammo)
      setWeaponName(weaponManager.current.def.name)

      waveManager.update(dt, ARENA_SIZE)

      setWaveActive(waveManager.waveActive)
      setWave(waveManager.currentWave)
      setEnemiesRemaining(waveManager.enemiesRemaining)

      if (waveManager.currentWave > lastWaveRef.current) {
        lastWaveRef.current = waveManager.currentWave
        setShowWaveAnnounce(true)
        setTimeout(() => setShowWaveAnnounce(false), 2600)
      }

      const enemyPosArr: THREE.Vector3[] = []
      for (let i = data.enemies.length - 1; i >= 0; i--) {
        const enemy = data.enemies[i]
        const result = enemy.update(dt, player.position, data.collisionWorld ?? undefined)

        if (enemy.isDead) {
          if (enemy.deathTimer <= 0) {
            engine.scene.remove(enemy.mesh)
            enemy.dispose()
            data.enemies.splice(i, 1)
          }
          continue
        }

        enemyPosArr.push(enemy.mesh.position)

        // Telegraph cue: brief muzzle flash when a ranged enemy starts aiming.
        if (enemy.telegraphCue) {
          particleSystem.muzzleFlash(
            enemy.mesh.position.clone().setY(1.35),
            new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.mesh.quaternion)
          )
        }

        if (result) {
          if (result.type === 'shoot') {
            data.audio.playWeaponShoot('rifle', result.from)
            const endpoint = result.hit ? player.position.clone() : result.to
            particleSystem.tracer(result.from, endpoint)
            if (result.hit) {
              player.takeDamage(result.damage)
              data.audio.playPlayerHit()
              setHealth(player.health)
              data.damageIndicator = triggerDamage(
                enemy.mesh.position.clone(),
                player.position.clone(),
                player.rotation.y
              )
              setDamageIndicator({ ...data.damageIndicator })
            }
          } else {
            player.takeDamage(result.damage)
            data.audio.playPlayerHit()
            setHealth(player.health)
            data.damageIndicator = triggerDamage(
              enemy.mesh.position.clone(),
              player.position.clone(),
              player.rotation.y
            )
            setDamageIndicator({ ...data.damageIndicator })
          }

          if (player.isDead) {
            document.exitPointerLock()
            data.audio.playPlayerDeath()
            data.scoreSystem.saveHighScore()
            setHighScore(data.scoreSystem.highScore)
            engine.stop()
            updateGameState('gameover')
            return
          }
        }
      }

      setEnemyPositions(enemyPosArr)
      setPlayerPos(player.position.clone())
      setPlayerRot(player.rotation.y)

      for (let i = data.pickups.length - 1; i >= 0; i--) {
        const pickup = data.pickups[i]
        pickup.update(dt, data.time)

        if (pickup.checkCollision(player.position)) {
          if (pickup.type === 'health') {
            player.heal(pickup.value)
            setHealth(player.health)
          } else {
            weaponManager.addAmmo(weaponManager.current.type, pickup.value)
          }
          data.audio.playPickup()
          engine.scene.remove(pickup.mesh)
          pickup.dispose()
          data.pickups.splice(i, 1)
        }
      }

      particleSystem.update(dt)

      data.damageIndicator = updateDamageIndicator(data.damageIndicator, dt)
      if (data.damageIndicator.active) {
        setDamageIndicator({ ...data.damageIndicator })
      } else if (damageIndicator !== null) {
        setDamageIndicator(null)
      }
    })

    function onMouseMove(e: MouseEvent) {
      const data = gameDataRef.current
      data.player.rotation.y -= e.movementX * 0.002
      data.player.rotation.x -= e.movementY * 0.002
      data.player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, data.player.rotation.x))
    }

    function checkHit(
      origin: THREE.Vector3,
      direction: THREE.Vector3,
      range: number,
      data: typeof gameDataRef.current
    ) {
      shootRaycaster.set(origin, direction)
      shootRaycaster.far = range

      let nearestEnemy: Enemy | null = null
      let nearestDist = Infinity
      let hitPoint: THREE.Vector3 | null = null

      for (const enemy of data.enemies) {
        if (enemy.isDead) continue
        const intersects = shootRaycaster.intersectObject(enemy.mesh, true)
        if (intersects.length > 0 && intersects[0].distance < nearestDist) {
          nearestDist = intersects[0].distance
          nearestEnemy = enemy
          hitPoint = intersects[0].point
        }
      }

      const wallDist = data.collisionWorld
        ? data.collisionWorld.segmentBlocked(origin, origin.clone().addScaledVector(direction, range))
        : null

      if (nearestEnemy && (wallDist === null || nearestDist < wallDist)) {
        const killed = nearestEnemy.takeDamage(data.weaponManager.current.def.damage)
        if (killed) {
          data.scoreSystem.addKill(nearestEnemy.def.scoreValue)
          setScore(data.scoreSystem.score)
          data.waveManager.onEnemyKilled()
          data.particleSystem!.explosion(nearestEnemy.mesh.position.clone(), nearestEnemy.type)
          data.audio.playEnemyDeath(nearestEnemy.mesh.position.clone())
        } else if (hitPoint) {
          data.particleSystem!.bloodSplatter(hitPoint)
          data.audio.playEnemyHit(hitPoint)
        }
        return
      }

      if (wallDist !== null) {
        data.particleSystem!.bulletImpact(origin.clone().addScaledVector(direction, wallDist))
      }
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
        data.weaponManager.current.reload()
      }

      const weaponKeys: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2 }
      if (e.code in weaponKeys) {
        data.weaponManager.switchByIndex(weaponKeys[e.code])
        setWeaponName(data.weaponManager.current.def.name)
        setAmmo(data.weaponManager.current.ammo)
        data.viewmodel?.setWeapon(data.weaponManager.current.type)
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
            maxAmmo={gameDataRef.current.weaponManager.current.def.maxAmmo}
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
