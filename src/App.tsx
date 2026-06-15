import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GameEngine } from './engine/GameEngine'
import { createArena } from './engine/Arena'
import { Player } from './player/Player'
import { Controls } from './player/Controls'
import { WeaponManager } from './weapons/WeaponManager'
import { Enemy } from './enemies/Enemy'
import { WaveManager } from './enemies/WaveManager'
import { HealthSystem } from './systems/HealthSystem'
import { ScoreSystem } from './systems/ScoreSystem'
import { Pickup } from './systems/Pickup'
import type { PickupType } from './systems/Pickup'
import { ParticleSystem } from './effects/ParticleSystem'
import { AudioManager } from './audio/AudioManager'
import type { GameState } from './types'
import { HUD } from './ui/HUD'
import { Minimap } from './ui/Minimap'
import { MainMenu } from './ui/MainMenu'
import { GameOver } from './ui/GameOver'

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

  const gameDataRef = useRef({
    player: new Player(),
    controls: null as Controls | null,
    weaponManager: new WeaponManager(),
    enemies: [] as Enemy[],
    waveManager: new WaveManager(),
    healthSystem: new HealthSystem(),
    scoreSystem: new ScoreSystem(),
    pickups: [] as Pickup[],
    particleSystem: null as ParticleSystem | null,
    audio: new AudioManager(),
    time: 0,
    weaponIndex: 0,
  })

  const startGame = useCallback(() => {
    const data = gameDataRef.current
    data.player = new Player()
    data.weaponManager = new WeaponManager()
    data.enemies = []
    data.pickups = []
    data.healthSystem.reset()
    data.scoreSystem.reset()
    data.waveManager = new WaveManager()
    data.waveManager.currentWave = 0
    data.waveManager.waveActive = false
    data.waveManager.wavePauseTimer = 2
    data.time = 0

    if (data.particleSystem) data.particleSystem.clear()

    setScore(0)
    setWave(0)
    setHealth(100)
    setAmmo(60)
    setWeaponName('Pistol')
    setWaveActive(false)
    setEnemiesRemaining(0)
    setEnemyPositions([])

    const engine = engineRef.current
    if (engine) {
      engine.start()
    }

    data.audio.init()
    setGameState('playing')
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const engine = new GameEngine(container)
    engineRef.current = engine
    createArena(engine.scene)

    const data = gameDataRef.current
    data.particleSystem = new ParticleSystem(engine.scene)
    data.controls = new Controls(container)

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

      player.update(dt, controls.getMovement(), ARENA_SIZE)

      engine.camera.position.copy(player.position)
      engine.camera.rotation.copy(player.rotation)

      if (document.pointerLockElement === container) {
        document.addEventListener('mousemove', onMouseMove)
      }

      weaponManager.update(dt)

      if (controls.shoot && weaponManager.current.canShoot()) {
        weaponManager.current.shoot()
        data.audio.playShoot(weaponManager.current.type)

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(engine.camera.quaternion)
        const spreadDir = weaponManager.current.getSpreadDirection(forward)

        if (weaponManager.current.type === 'shotgun') {
          for (let i = 0; i < 6; i++) {
            const dir = weaponManager.current.getSpreadDirection(forward)
            checkHit(player.position, dir, weaponManager.current.def.range, data, engine)
          }
        } else {
          checkHit(player.position, spreadDir, weaponManager.current.def.range, data, engine)
        }

        particleSystem.muzzleFlash(
          player.position.clone().add(spreadDir.clone().multiplyScalar(1)),
          spreadDir
        )
      }

      setAmmo(weaponManager.current.ammo)
      setWeaponName(weaponManager.current.def.name)

      const newEnemy = waveManager.update(dt, ARENA_SIZE)
      if (newEnemy) {
        engine.scene.add(newEnemy.mesh)
      }

      setWaveActive(waveManager.waveActive)
      setWave(waveManager.currentWave)
      setEnemiesRemaining(waveManager.enemiesRemaining)

      const enemyPosArr: THREE.Vector3[] = []
      for (let i = data.enemies.length - 1; i >= 0; i--) {
        const enemy = data.enemies[i]
        const result = enemy.update(dt, player.position)

        if (enemy.isDead) {
          if (enemy.deathTimer <= 0) {
            engine.scene.remove(enemy.mesh)
            enemy.dispose()
            data.enemies.splice(i, 1)
          }
          continue
        }

        enemyPosArr.push(enemy.mesh.position)

        if (result) {
          player.takeDamage(result.damage)
          data.healthSystem.health = player.health
          data.healthSystem.invincibleTimer = player.invincibleTimer
          data.audio.playPlayerHit()
          setHealth(player.health)

          if (player.isDead) {
            data.scoreSystem.saveHighScore()
            setHighScore(data.scoreSystem.highScore)
            engine.stop()
            setGameState('gameover')
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
      data: typeof gameDataRef.current,
      engine: GameEngine
    ) {
      shootRaycaster.set(origin, direction)
      shootRaycaster.far = range

      for (const enemy of data.enemies) {
        if (enemy.isDead) continue
        const intersects = shootRaycaster.intersectObject(enemy.mesh)
        if (intersects.length > 0) {
          const killed = enemy.takeDamage(data.weaponManager.current.def.damage)
          if (killed) {
            data.scoreSystem.addKill(enemy.def.scoreValue)
            setScore(data.scoreSystem.score)
            data.waveManager.onEnemyKilled()
            data.particleSystem!.explosion(enemy.mesh.position.clone())
            data.audio.playEnemyDeath()
          } else {
            data.particleSystem!.bloodSplatter(intersects[0].point)
            data.audio.playHit()
          }
          return
        }
      }

      if (shootRaycaster.intersectObjects(engine.scene.children).length > 0) {
        const hitPoint = shootRaycaster.intersectObjects(engine.scene.children)[0]?.point
        if (hitPoint) {
          data.particleSystem!.bulletImpact(hitPoint)
        }
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const data = gameDataRef.current
      if (e.code === 'Escape' && gameState === 'playing') {
        engineRef.current?.pause()
        setGameState('paused')
      } else if (e.code === 'Escape' && gameState === 'paused') {
        engineRef.current?.resume()
        setGameState('playing')
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
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousemove', onMouseMove)
      data.controls?.destroy()
      engine.stop()
    }
  }, [gameState])

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
        </>
      )}

      {gameState === 'paused' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          fontFamily: 'monospace',
        }}>
          <h1 style={{ fontSize: 48, marginBottom: 30 }}>PAUSED</h1>
          <button
            onClick={() => {
              engineRef.current?.resume()
              setGameState('playing')
            }}
            style={{
              padding: '14px 36px',
              fontSize: 18,
              background: '#ff6600',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            RESUME
          </button>
        </div>
      )}

      {gameState === 'gameover' && (
        <GameOver
          score={score}
          wave={wave}
          highScore={highScore}
          onRestart={startGame}
          onMenu={() => {
            engineRef.current?.stop()
            setGameState('menu')
          }}
        />
      )}
    </div>
  )
}

export default App
