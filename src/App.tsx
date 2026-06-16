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
import type { GameState, Team } from './types'
import { GameSession, ARENA_SIZE } from './session/GameSession'
import { emptyInput, type EntityState } from './session/protocol'
import { NetHost } from './net/NetHost'
import { NetClient } from './net/NetClient'
import { PeerHost } from './net/PeerHost'
import { PeerClient } from './net/PeerClient'
import { RemotePlayerManager } from './net/RemotePlayerManager'
import { HUD } from './ui/HUD'
import { Crosshair, type CrosshairRuntime } from './ui/Crosshair'
import { Minimap } from './ui/Minimap'
import { WaveAnnounce } from './ui/WaveAnnounce'
import { MainMenu } from './ui/MainMenu'
import { MultiplayerMenu } from './ui/MultiplayerMenu'
import { SettingsMenu } from './ui/SettingsMenu'
import { GameOver } from './ui/GameOver'
import { PauseMenu } from './ui/PauseMenu'
import { DamageOverlay } from './ui/DamageOverlay'
import { BuyMenu } from './ui/BuyMenu'
import { TeamSelect } from './ui/TeamSelect'
import { Scoreboard } from './ui/Scoreboard'
import { TouchControls } from './ui/TouchControls'
import { findItem, canAffordItem } from './weapons/StoreCatalog'
import { applyItem } from './player/applyPurchase'
import { weaponVisual } from './weapons/WeaponDefs'
import { loadSettings, saveSettings, mobileControlsActive, type Settings } from './settings/Settings'
import { resolveCrosshair } from './settings/Crosshair'
import { stepBloom } from './weapons/CrosshairBloom'

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
  const [storeOpen, setStoreOpen] = useState(false)
  const [money, setMoney] = useState(16000)
  const [team, setTeam] = useState<Team>('ct')
  const [owned, setOwned] = useState<string[]>([])
  const [maxHealth, setMaxHealth] = useState(100)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [lobbyPlayers, setLobbyPlayers] = useState<string[]>([])
  const [isHost, setIsHost] = useState(false)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [showScoreboard, setShowScoreboard] = useState(false)
  const [scoreboardPlayers, setScoreboardPlayers] = useState<EntityState[]>([])
  const lastWaveRef = useRef(0)
  const gameStateRef = useRef<GameState>('menu')
  const storeOpenRef = useRef(false)
  const showScoreboardRef = useRef(false)
  const settingsRef = useRef(settings)
  const crosshairRef = useRef<CrosshairRuntime>({
    config: resolveCrosshair(settings.crosshair, 'pistol'),
    bloom: 0,
  })

  const updateGameState = useCallback((state: GameState) => {
    gameStateRef.current = state
    setGameState(state)
  }, [])

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next)
    settingsRef.current = next
    saveSettings(next)
  }, [])

  useEffect(() => { storeOpenRef.current = storeOpen }, [storeOpen])
  useEffect(() => { showScoreboardRef.current = showScoreboard }, [showScoreboard])

  // While the scoreboard is open, refresh its rows from the latest snapshot a few times a second.
  useEffect(() => {
    if (!showScoreboard) return
    const sync = () => setScoreboardPlayers([...gameDataRef.current.lastPlayers])
    sync()
    const id = setInterval(sync, 400)
    return () => clearInterval(id)
  }, [showScoreboard])

  const lookRef = useRef({ yaw: 0, pitch: 0 })

  const gameDataRef = useRef({
    session: new GameSession(),
    controls: null as Controls | null,
    particleSystem: null as ParticleSystem | null,
    viewmodel: null as Viewmodel | null,
    audio: new SoundEffects(new AudioManager()),
    damageIndicator: createDamageIndicatorState(),
    money: 16000, // local stub for the buy store (Phase 3 makes this real)
    role: 'single' as 'single' | 'host' | 'client',
    netHost: null as NetHost | null,
    netClient: null as NetClient | null,
    peerHost: null as PeerHost | null,
    peerClient: null as PeerClient | null,
    remotePlayers: null as RemotePlayerManager | null,
    nextClientNum: 1,
    clientEnemies: new Map<string, THREE.Mesh>(),
    lastPlayers: [] as EntityState[],
    pingTimer: 0,
  })

  const resetNetworking = useCallback(() => {
    const data = gameDataRef.current
    data.peerHost?.stop(); data.peerClient?.stop()
    data.peerHost = null; data.peerClient = null
    data.netHost = null; data.netClient = null
    data.remotePlayers?.clear(); data.remotePlayers = null
    for (const mesh of data.clientEnemies.values()) {
      engineRef.current?.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    data.clientEnemies.clear()
    data.role = 'single'
  }, [])

  const startGame = useCallback(() => {
    const data = gameDataRef.current
    resetNetworking()
    const scene = engineRef.current?.scene
    for (const enemy of data.session.enemies) { scene?.remove(enemy.mesh); enemy.dispose() }
    for (const pickup of data.session.pickups) { scene?.remove(pickup.mesh); pickup.dispose() }

    const fresh = new GameSession()
    fresh.collisionWorld = data.session.collisionWorld
    fresh.waveManager.wavePauseTimer = 2 // 2s grace before wave 1 (matches pre-refactor behavior)
    fresh.waveManager.onEnemySpawned = data.session.waveManager.onEnemySpawned
    fresh.waveManager.onWaveComplete = data.session.waveManager.onWaveComplete
    fresh.getPlayer(fresh.localId)!.name = settingsRef.current.playerName
    data.session = fresh
    lookRef.current = { yaw: 0, pitch: 0 }
    data.money = 16000
    setShowScoreboard(false)

    if (data.particleSystem) data.particleSystem.clear()
    data.damageIndicator = createDamageIndicatorState()

    setScore(0); setWave(0); setHealth(100); setAmmo(60); setWeaponName('Pistol')
    setMoney(16000); setStoreOpen(false)
    setOwned([]); setMaxHealth(100)
    data.session.weaponManager.reset()
    data.session.player.resetLoadout()
    data.viewmodel?.setWeapon('pistol')
    setWaveActive(false); setEnemiesRemaining(0); setEnemyPositions([]); setDamageIndicator(null)

    engineRef.current?.start()
    data.audio.init(); data.audio.loadSounds()
    updateGameState('playing')
  }, [updateGameState, resetNetworking])

  const startNetGame = useCallback((role: 'host' | 'client') => {
    const data = gameDataRef.current
    const engine = engineRef.current
    if (!engine) return
    data.role = role
    const localId = data.netClient?.playerId ?? data.session.localId
    data.remotePlayers = new RemotePlayerManager(engine.scene, localId)
    lookRef.current = { yaw: 0, pitch: 0 }
    setHealth(100)
    setShowScoreboard(false)
    engine.start()
    data.audio.init(); data.audio.loadSounds()
    updateGameState('playing')
  }, [updateGameState])

  const hostGame = useCallback(async () => {
    const data = gameDataRef.current
    data.role = 'host'
    setIsHost(true)
    const peerHost = new PeerHost()
    data.peerHost = peerHost
    const netHost = new NetHost(data.session, 'coop')
    data.netHost = netHost
    data.session.waveManager.auto = false // multiplayer: no auto-bots; host adds waves with G
    data.session.getPlayer(data.session.localId)!.name = settingsRef.current.playerName
    setLobbyPlayers([settingsRef.current.playerName])
    peerHost.onClientConnect((transport) => {
      transport.onMessage((msg) => {
        if (msg.type === 'join') {
          const id = 'player-' + (data.nextClientNum++)
          netHost.addClient(id, msg.name, transport)
          setLobbyPlayers((prev) => [...prev, msg.name])
        }
      })
    })
    const code = await peerHost.start()
    setRoomCode(code)
  }, [])

  const joinGame = useCallback(async (code: string) => {
    const data = gameDataRef.current
    data.role = 'client'
    setIsHost(false)
    const peerClient = new PeerClient()
    data.peerClient = peerClient
    const transport = await peerClient.connect(code)
    const client = new NetClient(transport)
    data.netClient = client
    client.onWelcome(() => startNetGame('client'))
    client.join(settingsRef.current.playerName)
  }, [startNetGame])

  const leaveMultiplayer = useCallback(() => {
    resetNetworking()
    setRoomCode(null); setLobbyPlayers([]); setIsHost(false)
    updateGameState('menu')
  }, [updateGameState, resetNetworking])

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
      gameDataRef.current.viewmodel?.setWeapon(weaponVisual(wm.current.type))
    }
    data.controls.onToggleStore = () => {
      if (gameStateRef.current !== 'playing') return
      setStoreOpen((open) => {
        const next = !open
        if (next) document.exitPointerLock()
        return next
      })
    }
    data.controls.onScoreboard = (show: boolean) => {
      if (gameStateRef.current !== 'playing') { showScoreboardRef.current = false; setShowScoreboard(false); return }
      showScoreboardRef.current = show
      setShowScoreboard(show)
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
      if (data.role === 'client') { updateClient(dt); return }

      const session = data.session
      const controls = data.controls
      const particleSystem = data.particleSystem!
      if (!controls) return

      const m = controls.getMovement()
      const input = {
        ...emptyInput(),
        forward: m.forward, backward: m.backward, left: m.left, right: m.right, jump: m.jump,
        shoot: controls.shoot && !storeOpenRef.current,
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
            if (ev.hit && ev.victimId === session.localId) {
              data.audio.playPlayerHit()
              setHealth(session.player.health)
              data.damageIndicator = triggerDamage(from.clone(), session.player.position.clone(), session.player.rotation.y)
              setDamageIndicator({ ...data.damageIndicator })
            }
            break
          }
          case 'enemyMelee':
            if (ev.victimId === session.localId) {
              data.audio.playPlayerHit()
              setHealth(session.player.health)
              data.damageIndicator = triggerDamage(
                new THREE.Vector3(ev.enemyPos.x, ev.enemyPos.y, ev.enemyPos.z), session.player.position.clone(), session.player.rotation.y)
              setDamageIndicator({ ...data.damageIndicator })
            }
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
      let firedThisFrame = false
      if (controls.shoot && session.weaponManager.current.fireTimer > session.weaponManager.current.def.fireRate - dt) {
        firedThisFrame = true
        data.viewmodel?.fire()
        data.audio.playWeaponShoot(weaponVisual(session.weaponManager.current.type), session.player.position)
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(engine.camera.quaternion)
        particleSystem.muzzleFlash(session.player.position.clone().add(fwd), fwd)
      }

      // Smart crosshair: pick the active weapon's crosshair and grow/shrink its bloom
      // from movement, jumping and firing.
      const weapon = session.weaponManager.current
      const ch = crosshairRef.current
      ch.config = resolveCrosshair(settingsRef.current.crosshair, weapon.type)
      ch.bloom = stepBloom(ch.bloom, dt, {
        moving: Math.hypot(session.player.velocity.x, session.player.velocity.z) > 1.5,
        airborne: !session.player.isGrounded,
        shotsFired: firedThisFrame ? 1 : 0,
        weaponSpread: weapon.def.spread,
      })

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

      // Host: broadcast the locally-simulated snapshot and render remote players.
      if (data.role === 'host' && data.netHost && data.remotePlayers) {
        const snap = session.getSnapshot()
        data.netHost.broadcastSnapshot(snap) // stamps per-player ping onto snap.players
        data.lastPlayers = snap.players
        data.remotePlayers.sync(snap.players)
        data.remotePlayers.update(dt)

        data.pingTimer += dt
        if (data.pingTimer >= 1) { data.pingTimer = 0; data.netHost.pingClients() }
      } else if (data.role === 'single' && showScoreboardRef.current) {
        data.lastPlayers = session.getSnapshot().players
      }
    })

    // Client: forward input, render local view + remote players + enemies from the snapshot.
    function updateClient(dt: number) {
      const controls = data.controls
      const client = data.netClient
      const particleSystem = data.particleSystem
      if (!controls || !client || !particleSystem) return

      const m = controls.getMovement()
      client.sendInput({
        ...emptyInput(),
        forward: m.forward, backward: m.backward, left: m.left, right: m.right, jump: m.jump,
        shoot: controls.shoot && !storeOpenRef.current,
        yaw: lookRef.current.yaw,
        pitch: lookRef.current.pitch,
      })

      // Smart crosshair (client is non-authoritative, so drive it from local input).
      const weapon = data.session.weaponManager.current
      const ch = crosshairRef.current
      ch.config = resolveCrosshair(settingsRef.current.crosshair, weapon.type)
      ch.bloom = stepBloom(ch.bloom, dt, {
        moving: m.forward || m.backward || m.left || m.right,
        airborne: m.jump,
        shotsFired: 0,
        weaponSpread: weapon.def.spread,
      })

      const snap = client.latestSnapshot
      if (!snap) return
      data.lastPlayers = snap.players

      const me = snap.players.find((p) => p.id === client.playerId)
      if (me) {
        engine.camera.position.set(me.position.x, me.position.y, me.position.z)
        engine.camera.rotation.set(me.rotationX ?? 0, me.rotationY, 0, 'YXZ')
        data.audio.updateListenerPosition(me.position.x, me.position.y, me.position.z)
        setHealth(me.health)
      }

      data.remotePlayers?.sync(snap.players)
      renderClientEnemies(snap.enemies)
      data.remotePlayers?.update(dt)
      particleSystem.update(dt)
    }

    function renderClientEnemies(enemies: EntityState[]) {
      const map = data.clientEnemies
      const seen = new Set<string>()
      for (const e of enemies) {
        seen.add(e.id)
        let mesh = map.get(e.id)
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1.8, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xcc3333 }),
          )
          map.set(e.id, mesh)
          engine.scene.add(mesh)
        }
        mesh.position.set(e.position.x, e.position.y + 0.9, e.position.z)
        mesh.rotation.y = e.rotationY
        mesh.visible = !e.isDead
      }
      for (const [id, mesh] of map) {
        if (!seen.has(id)) {
          engine.scene.remove(mesh)
          mesh.geometry.dispose()
          ;(mesh.material as THREE.Material).dispose()
          map.delete(id)
        }
      }
    }

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

      if (e.code === 'KeyG' && gameStateRef.current === 'playing' && data.role === 'host') {
        data.session.waveManager.spawnNextWave()
      }

      const slotKeys: Record<string, 'primary' | 'secondary'> = { Digit1: 'primary', Digit2: 'secondary' }
      if (e.code in slotKeys && gameStateRef.current === 'playing') {
        const wm = data.session.weaponManager
        wm.selectSlot(slotKeys[e.code])
        setWeaponName(wm.current.def.name)
        setAmmo(wm.current.ammo)
        data.viewmodel?.setWeapon(weaponVisual(wm.current.type))
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
      {gameState === 'menu' && (
        <MainMenu
          onSingleplayer={() => updateGameState('teamselect')}
          onMultiplayer={() => updateGameState('mpmenu')}
          onSettings={() => updateGameState('settings')}
        />
      )}

      {gameState === 'settings' && (
        <SettingsMenu
          settings={settings}
          onChange={updateSettings}
          onBack={() => updateGameState('menu')}
        />
      )}

      {gameState === 'teamselect' && (
        <TeamSelect onSelect={(t) => { setTeam(t); startGame() }} />
      )}

      {gameState === 'mpmenu' && (
        <MultiplayerMenu
          roomCode={roomCode}
          players={lobbyPlayers}
          isHost={isHost}
          onHost={hostGame}
          onJoin={joinGame}
          onStart={() => startNetGame('host')}
          onBack={leaveMultiplayer}
        />
      )}

      {gameState === 'playing' && (
        <>
          <HUD
            health={health}
            maxHealth={maxHealth}
            ammo={ammo}
            maxAmmo={gameDataRef.current.session.weaponManager.current.def.maxAmmo}
            weaponName={weaponName}
            score={score}
            wave={wave}
            waveActive={waveActive}
            enemiesRemaining={enemiesRemaining}
          />
          <Crosshair runtime={crosshairRef} />
          <Minimap
            playerPosition={playerPos}
            playerRotation={playerRot}
            enemies={enemyPositions}
            arenaSize={ARENA_SIZE}
          />
          <WaveAnnounce wave={wave} visible={showWaveAnnounce} />
          <DamageOverlay indicator={damageIndicator} />
          {showScoreboard && <Scoreboard players={scoreboardPlayers} roomCode={roomCode} />}
          {mobileControlsActive(settings) && gameDataRef.current.controls && (
            <TouchControls
              controls={gameDataRef.current.controls}
              lookRef={lookRef}
              lookSensitivity={settings.lookSensitivity}
              onReload={() => gameDataRef.current.session.weaponManager.current.reload()}
              onCycleWeapon={() => gameDataRef.current.controls?.onCycleWeapon?.()}
              onToggleStore={() => gameDataRef.current.controls?.onToggleStore?.()}
              onToggleScoreboard={() => setShowScoreboard((s) => !s)}
            />
          )}
        </>
      )}

      {gameState === 'playing' && storeOpen && (
        <BuyMenu
          team={team}
          money={money}
          owned={owned}
          onBuy={(id) => {
            const data = gameDataRef.current
            const item = findItem(id)
            if (item && !owned.includes(id) && canAffordItem(data.money, id)) {
              data.money -= item.price
              setMoney(data.money)
              applyItem(item, data.session.player, data.session.weaponManager)
              setOwned((prev) => [...prev, id])
              setMaxHealth(data.session.player.maxHealth)
              const wm = data.session.weaponManager
              setWeaponName(wm.current.def.name)
              setAmmo(wm.current.ammo)
              data.viewmodel?.setWeapon(weaponVisual(wm.current.type))
            }
          }}
          onClose={() => setStoreOpen(false)}
        />
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
