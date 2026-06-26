import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GameEngine } from './engine/GameEngine'
import { createArena, rebuildArena } from './engine/Arena'
import { getZone } from './zones/registry'
import { Controls } from './player/Controls'
import { Viewmodel } from './weapons/Viewmodel'
import { Pickup } from './systems/Pickup'
import type { PickupType } from './systems/Pickup'
import { ParticleSystem } from './effects/ParticleSystem'
import { AudioManager } from './audio/AudioManager'
import { SoundEffects } from './audio/SoundEffects'
import { createDamageIndicatorState, triggerDamage, updateDamageIndicator, type DamageIndicatorState } from './effects/DamageIndicator'
import { createFlashEffect, triggerFlash, updateFlash, type FlashEffectState } from './effects/FlashEffect'
import type { GameState, Team, GrenadeType, Vec3 } from './types'
import { GameSession, ARENA_SIZE } from './session/GameSession'
import { pickSpawn } from './session/Spawns'
import { emptyInput, type EntityState, type GrenadeState } from './session/protocol'
import { createGrenadeModel } from './weapons/GrenadeModel'
import { NetHost } from './net/NetHost'
import { NetClient } from './net/NetClient'
import { PeerHost } from './net/PeerHost'
import { PeerClient } from './net/PeerClient'
import { RemotePlayerManager } from './net/RemotePlayerManager'
import { HostDirectory } from './net/HostDirectory'
import { dialDirectory } from './net/directoryPeer'
import { measurePing } from './net/probePing'
import type { ServerRow } from './ui/ServerList'
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
import { FlashOverlay } from './ui/FlashOverlay'
import { AboutModal } from './ui/AboutModal'
import { HelpModal } from './ui/HelpModal'
import { BuyMenu } from './ui/BuyMenu'
import { TeamSelect } from './ui/TeamSelect'
import { Scoreboard } from './ui/Scoreboard'
import { TouchControls } from './ui/TouchControls'
import { RotateHint } from './ui/RotateHint'
import { findItem, canAffordItem } from './weapons/StoreCatalog'
import { applyItem } from './player/applyPurchase'
import { weaponVisual } from './weapons/WeaponDefs'
import { loadSettings, saveSettings, mobileControlsActive, type Settings } from './settings/Settings'
import { resolveCrosshair } from './settings/Crosshair'
import { stepBloom } from './weapons/CrosshairBloom'
import { MatchSetup } from './ui/MatchSetup'
import { MapEditor } from './ui/MapEditor'
import { KeybindsScreen } from './ui/KeybindsScreen'
import { RoundState } from './session/RoundManager'
import { KillFeed, type KillLine } from './ui/KillFeed'
import type { HitZone } from './systems/DamageZones'
import { RespawnOverlay } from './ui/RespawnOverlay'
import { MatchOver } from './ui/MatchOver'
import { defaultMatchConfig, type MatchConfig } from './session/MatchConfig'
import type { MatchScores } from './session/protocol'
import { BombState } from './session/BombCarrier'
import { findMatch } from './net/Matchmaker'
import { GrenadeManager } from './weapons/GrenadeManager'
import { GRENADE_DEFS } from './weapons/GrenadeDefs'

/** Maps a grenade store item id to its grenade type/inventory key. */
const GRENADE_ITEM_KEY: Record<string, GrenadeType> = {
  he_grenade: 'he',
  flashbang: 'flash',
  smoke_grenade: 'smoke',
}
import type Peer from 'peerjs'
import { VoiceChat } from './voice/VoiceChat'
import { BrowserMicProvider, PeerJsVoicePeer } from './voice/VoiceTransport'
import { AudioSink } from './voice/AudioSink'
import { VoiceIndicator } from './ui/VoiceIndicator'
import type { Speaker } from './voice/SpeakerRegistry'

function moveToTeam(roster: { ct: string[]; t: string[] }, name: string, team: 'ct' | 't') {
  const ct = roster.ct.filter(n => n !== name)
  const t = roster.t.filter(n => n !== name)
  if (team === 'ct') ct.push(name); else t.push(name)
  return { ct, t }
}

/** Living teammates (excluding the local player) as minimap dots. */
function allyDots(players: EntityState[], localId: string): { x: number; z: number }[] {
  const localTeam = players.find((p) => p.id === localId)?.team
  if (!localTeam) return []
  return players
    .filter((p) => p.id !== localId && !p.isDead && p.team === localTeam)
    .map((p) => ({ x: p.position.x, z: p.position.z }))
}

/** Render another player's/bot's gunfire (audio + muzzle flash). No tracer: tracers are
 *  reserved for the local player's own shots so they can read their own fire. */
function renderRemoteShot(particleSystem: ParticleSystem, audio: SoundEffects, ev: { from: Vec3; to: Vec3 }) {
  const from = new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z)
  const to = new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z)
  const dir = to.clone().sub(from).normalize()
  audio.playWeaponShoot('rifle', from)
  particleSystem.muzzleFlash(from.clone().add(dir.clone().multiplyScalar(0.4)), dir)
}

/** Tracer for the local player's own shot — the only gunfire that draws a tracer. */
function renderLocalTracer(particleSystem: ParticleSystem, ev: { from: Vec3; to: Vec3 }) {
  particleSystem.tracer(
    new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z),
    new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z), 0xfff0a0, 0.2)
}

/** Dispose geometries/materials under a Group so removed client meshes don't leak GPU memory. */
function disposeGroup(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const mat = child.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}

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
  const [allyPositions, setAllyPositions] = useState<{ x: number; z: number }[]>([])
  const [highScore, setHighScore] = useState(0)
  const [damageIndicator, setDamageIndicator] = useState<DamageIndicatorState | null>(null)
  const [flashEffect, setFlashEffect] = useState<FlashEffectState | null>(null)
  const [showWaveAnnounce, setShowWaveAnnounce] = useState(false)
  const [storeOpen, setStoreOpen] = useState(false)
  const [money, setMoney] = useState(16000)
  const [team, setTeam] = useState<Team>('ct')
  const [owned, setOwned] = useState<string[]>([])
  const [maxHealth, setMaxHealth] = useState(100)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [hostNotice, setHostNotice] = useState<string | null>(null)
  const [lobbyPlayers, setLobbyPlayers] = useState<string[]>([])
  const playerIdToNameRef = useRef<Map<string, string>>(new Map())
  const [isHost, setIsHost] = useState(false)
  const [servers, setServers] = useState<ServerRow[]>([])
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [showScoreboard, setShowScoreboard] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showInGameHelp, setShowInGameHelp] = useState(false)
  const [scoreboardPlayers, setScoreboardPlayers] = useState<EntityState[]>([])
  const [showMatchSetup, setShowMatchSetup] = useState(false)
  const [myTeam, setMyTeam] = useState<Team>('ct')
  const [roster, setRoster] = useState<{ ct: string[]; t: string[] }>({ ct: [], t: [] })
  const [killFeed, setKillFeed] = useState<KillLine[]>([])
  const [respawnIn, setRespawnIn] = useState<number | null>(null)
  const [matchScores, setMatchScores] = useState<MatchScores | null>(null)
  const [bombState, setBombState] = useState<BombState>(BombState.None)
  const [bombTimer, setBombTimer] = useState(40)
  const [bombSite, setBombSite] = useState<'A' | 'B' | null>(null)
  const [plantProgress, setPlantProgress] = useState(0)
  const [defuseProgress, setDefuseProgress] = useState(0)
  const [grenadeInventory, setGrenadeInventory] = useState({ he: 0, flash: 0, smoke: 0 })
  const [selectedGrenade, setSelectedGrenade] = useState<GrenadeType | null>(null)
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)

  const lastWaveRef = useRef(0)
  const ownedRef = useRef<string[]>([])
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
    flashEffect: createFlashEffect(),
    money: 16000, // local stub for the buy store (Phase 3 makes this real)
    role: 'single' as 'single' | 'host' | 'client',
    netHost: null as NetHost | null,
    netClient: null as NetClient | null,
    hostDirectory: null as HostDirectory | null,
    peerHost: null as PeerHost | null,
    peerClient: null as PeerClient | null,
    remotePlayers: null as RemotePlayerManager | null,
    nextClientNum: 1,
    clientEnemies: new Map<string, THREE.Mesh>(),
    clientGrenades: new Map<string, THREE.Group>(),
    lastPlayers: [] as EntityState[],
    pingTimer: 0,
    matchConfig: defaultMatchConfig() as MatchConfig,
    killSeq: 0,
    grenadeManager: null as GrenadeManager | null,
    voiceChat: null as VoiceChat | null,
    audioSink: new AudioSink(),
    micProvider: new BrowserMicProvider(),
  })

  const pushKill = useCallback((attacker: string, victim: string, teamkill: boolean, zone: HitZone) => {
    const id = gameDataRef.current.killSeq++
    setKillFeed((prev) => [...prev.slice(-4), { id, attacker, victim, teamkill, zone }])
    setTimeout(() => setKillFeed((prev) => prev.filter(l => l.id !== id)), 5000)
  }, [])

  const resetNetworking = useCallback(() => {
    const data = gameDataRef.current
    data.hostDirectory?.stop(); data.hostDirectory = null
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
    for (const mesh of data.clientGrenades.values()) { engineRef.current?.scene.remove(mesh); disposeGroup(mesh) }
    data.clientGrenades.clear()
    data.voiceChat?.dispose(); data.voiceChat = null
    data.audioSink.dispose(); data.audioSink = new AudioSink()
    data.micProvider = new BrowserMicProvider()
    setSpeakers([])
    data.role = 'single'
  }, [])

  const startVoice = useCallback((localPlayerId: string, peer: Peer) => {
    const data = gameDataRef.current
    data.voiceChat?.dispose()
    const chat = new VoiceChat({
      peer: new PeerJsVoicePeer(peer),
      mic: data.micProvider,
      localPlayerId,
      localName: settingsRef.current.playerName,
      sendStart: (id, name) => {
        if (data.role === 'host') data.netHost?.localVoiceStart()
        else data.netClient?.sendVoiceStart(id, name)
      },
      sendStop: (id) => {
        if (data.role === 'host') data.netHost?.localVoiceStop()
        else data.netClient?.sendVoiceStop(id)
      },
      onSpeakersChanged: (list) => setSpeakers(list),
      playStream: (peerId, stream) => data.audioSink.play(peerId, stream),
      stopStream: (peerId) => data.audioSink.stop(peerId),
    })
    data.voiceChat = chat
    return chat
  }, [])

  const startGame = useCallback(() => {
    const data = gameDataRef.current
    resetNetworking()
    // Pin random seed so session and scene both generate the same map
    if (data.matchConfig.zoneId === 'random') data.matchConfig = { ...data.matchConfig, randomSeed: Date.now() }
    const scene = engineRef.current?.scene
    for (const enemy of data.session.enemies) { scene?.remove(enemy.mesh); enemy.dispose() }
    for (const pickup of data.session.pickups) { scene?.remove(pickup.mesh); pickup.dispose() }

    const fresh = new GameSession(data.matchConfig)
    fresh.collisionWorld = scene
      ? rebuildArena(scene, getZone(data.matchConfig.zoneId, data.matchConfig.randomSeed, data.matchConfig.customZone))
      : data.session.collisionWorld
    fresh.waveManager.wavePauseTimer = 2 // 2s grace before wave 1 (matches pre-refactor behavior)
    fresh.waveManager.onEnemySpawned = data.session.waveManager.onEnemySpawned
    fresh.waveManager.onWaveComplete = data.session.waveManager.onWaveComplete
    fresh.getPlayer(fresh.localId)!.name = settingsRef.current.playerName
    data.session = fresh
    // Render bots (and any non-local players) in single-player with the player model.
    if (scene) data.remotePlayers = new RemotePlayerManager(scene, fresh.localId)
    data.grenadeManager = new GrenadeManager()
    lookRef.current = { yaw: 0, pitch: 0 }
    data.money = 16000
    setShowScoreboard(false)

    if (data.matchConfig.mode === 'competitive' && fresh.roundManager) {
      fresh.roundManager.state = RoundState.Buying
      fresh.roundManager.buyPhaseTimer = 15
    }

    if (data.particleSystem) data.particleSystem.clear()
    data.damageIndicator = createDamageIndicatorState()
    data.flashEffect = createFlashEffect()

    setScore(0); setWave(0); setHealth(100); setAmmo(60); setWeaponName('Pistol')
    setMoney(16000); setStoreOpen(false)
    setOwned([]); ownedRef.current = []; setMaxHealth(100)
    setGrenadeInventory({ he: 0, flash: 0, smoke: 0 }); setSelectedGrenade(null)
    data.session.weaponManager.reset()
    data.session.player.resetLoadout()
    data.viewmodel?.setWeapon('pistol')
    setWaveActive(false); setEnemiesRemaining(0); setEnemyPositions([]); setDamageIndicator(null); setFlashEffect(null)

    engineRef.current?.start()
    data.audio.init(); data.audio.loadSounds()
    updateGameState('playing')
  }, [updateGameState, resetNetworking])

  const startNetGame = useCallback((role: 'host' | 'client') => {
    const data = gameDataRef.current
    const engine = engineRef.current
    if (!engine) return
    data.role = role
    if (role === 'client') {
      // The client's menu-time session was built with the default map. Rebuild it from the
      // host's config (received in 'welcome') so the session's map, spawns, and bombsites
      // match the real map — not just the rendered arena. Mirrors hostGame()/startGame().
      const fresh = new GameSession(data.matchConfig)
      fresh.collisionWorld = rebuildArena(engine.scene, getZone(data.matchConfig.zoneId, data.matchConfig.randomSeed, data.matchConfig.customZone))
      fresh.waveManager.onEnemySpawned = data.session.waveManager.onEnemySpawned
      fresh.waveManager.onWaveComplete = data.session.waveManager.onWaveComplete
      fresh.getPlayer(fresh.localId)!.name = settingsRef.current.playerName
      data.session = fresh
      // Pass the collision world and arena size to the net client so client-side prediction
      // respects walls and uses the correct map bounds.
      if (data.netClient) {
        data.netClient.collisionWorld = fresh.collisionWorld
        data.netClient.arenaSize = getZone(data.matchConfig.zoneId, data.matchConfig.randomSeed, data.matchConfig.customZone).arenaSize
      }
    } else {
      // Host already rebuilt its session with the chosen map in hostGame(); just ensure the
      // rendered arena and collision world match.
      data.session.collisionWorld = rebuildArena(engine.scene, getZone(data.matchConfig.zoneId, data.matchConfig.randomSeed, data.matchConfig.customZone))
    }
    // Grenade inventory lives client-side; without this it stays null in net games,
    // so buying/selecting/throwing grenades silently no-ops (the buy button never leaves 0/N).
    data.grenadeManager = new GrenadeManager()
    setGrenadeInventory({ he: 0, flash: 0, smoke: 0 }); setSelectedGrenade(null)
    const localId = data.netClient?.playerId ?? data.session.localId
    // Dispose any prior game's remote-player (bot) meshes so they don't linger in the
    // scene when re-hosting/re-joining — RemotePlayerManager replacement alone orphans them.
    data.remotePlayers?.clear()
    data.remotePlayers = new RemotePlayerManager(engine.scene, localId)
    lookRef.current = { yaw: 0, pitch: 0 }
    setHealth(100)
    setShowScoreboard(false)
    engine.start()
    data.audio.init(); data.audio.loadSounds()
    updateGameState('playing')
  }, [updateGameState])

  const hostGame = useCallback(async (config: MatchConfig) => {
    const data = gameDataRef.current
    data.role = 'host'
    // Generate seed once so all clients build the same random map
    if (config.zoneId === 'random') config = { ...config, randomSeed: Date.now() }
    data.matchConfig = config
    setIsHost(true)
    const peerHost = new PeerHost()
    data.peerHost = peerHost
    // Rebuild the session with the chosen rules (replaces the menu-time session).
    const scene = engineRef.current?.scene
    for (const enemy of data.session.enemies) { scene?.remove(enemy.mesh); enemy.dispose() }
    const fresh = new GameSession(config)
    fresh.collisionWorld = scene
      ? rebuildArena(scene, getZone(config.zoneId, config.randomSeed, config.customZone))
      : data.session.collisionWorld
    fresh.waveManager.onEnemySpawned = data.session.waveManager.onEnemySpawned
    fresh.waveManager.onWaveComplete = data.session.waveManager.onWaveComplete
    fresh.getPlayer(fresh.localId)!.name = settingsRef.current.playerName
    fresh.getPlayer(fresh.localId)!.team = myTeam
    data.session = fresh
    const netHost = new NetHost(fresh, config)
    data.netHost = netHost
    netHost.onClientTeamChanged((_id, name, team) => {
      setRoster((prev) => moveToTeam(prev, name, team))
    })
    fresh.waveManager.auto = false
    setLobbyPlayers([settingsRef.current.playerName])
    setRoster({ ct: myTeam === 'ct' ? [settingsRef.current.playerName] : [], t: myTeam === 't' ? [settingsRef.current.playerName] : [] })
    peerHost.onClientConnect((transport) => {
      let assignedId: string | null = null
      transport.onMessage((msg) => {
        if (msg.type === 'join') {
          if (assignedId) return   // already joined on this connection; ignore duplicate
          if (!netHost.passwordOk(msg.password)) {
            transport.send({ type: 'joinRejected', reason: 'badPassword' })
            return
          }
          const id = 'player-' + (data.nextClientNum++)
          assignedId = id
          const joinTeam = msg.team === 't' ? 't' : 'ct'
          netHost.addClient(id, msg.name, transport, joinTeam, transport.remotePeerId)
          setLobbyPlayers((prev) => {
            const next = [...prev, msg.name]
            data.hostDirectory?.setPlayers(next.length)
            return next
          })
          setRoster((prev) => ({ ...prev, [joinTeam]: [...prev[joinTeam], msg.name] }))
        } else if (msg.type === 'probe') {
          transport.send({ type: 'probeAck', t: msg.t })
        }
      })
      transport.onClose(() => {
        if (!assignedId) return
        const name = data.session.getPlayer(assignedId)?.name
        netHost.removeClient(assignedId)
        setLobbyPlayers((prev) => {
          const next = name ? prev.filter((n) => n !== name) : prev.slice(0, -1)
          data.hostDirectory?.setPlayers(Math.max(1, next.length))
          return next
        })
        if (name) setRoster((prev) => ({
          ct: prev.ct.filter((n) => n !== name),
          t: prev.t.filter((n) => n !== name),
        }))
        assignedId = null
      })
    })
    let code: string
    try {
      code = await peerHost.start()
    } catch {
      // The PeerJS broker was unreachable (offline, blocked, or rate-limited). Roll back
      // and tell the user instead of leaving them on a silent, room-code-less screen.
      peerHost.stop()
      data.peerHost = null
      data.role = 'single'
      setIsHost(false)
      setJoinError('Could not reach the multiplayer server. Check your connection, or self-host the broker (see README).')
      return
    }
    setRoomCode(code)
    const hostDirectory = new HostDirectory()
    data.hostDirectory = hostDirectory
    // A directory failure is non-fatal: the host can still share the room code directly.
    await hostDirectory.start({
      roomCode: code, hostName: settingsRef.current.playerName, players: 1, maxPlayers: 8,
      status: 'lobby', mode: config.mode,
      joinPolicy: config.joinPolicy ?? 'lobby',
      protected: !!config.password,
    }).catch(() => {})
  }, [myTeam])

  const joinGame = useCallback(async (code: string, opts?: { team?: Team; password?: string }) => {
    const data = gameDataRef.current
    data.role = 'client'
    setIsHost(false)
    setJoinError(null)
    const peerClient = new PeerClient()
    data.peerClient = peerClient
    const transport = await peerClient.connect(code)
    const client = new NetClient(transport)
    data.netClient = client
    // Test hook: expose the latest snapshot seq so e2e can assert the host
    // keeps broadcasting (e.g. while its tab is backgrounded).
    client.onSnapshot((s) => { (window as unknown as { __snapSeq?: number }).__snapSeq = s.seq })
    client.onEvent((ev) => {
      const particleSystem = data.particleSystem!
      switch (ev.type) {
        case 'playerHitEnemy': {
          const p = ev.hit.point
          const point = new THREE.Vector3(p.x, p.y, p.z)
          if (ev.hit.killed) {
            particleSystem.explosion(point, ev.enemyType)
            data.audio.playEnemyDeath(point)
          } else {
            particleSystem.bloodSplatter(point)
            data.audio.playEnemyHit(point)
          }
          break
        }
        case 'enemyKilled':
          setScore(data.session.scoreSystem.score)
          break
        case 'wallImpact':
          particleSystem.bulletImpact(new THREE.Vector3(ev.point.x, ev.point.y, ev.point.z))
          break
        case 'playerShot':
          if (ev.shooterId === data.netClient?.playerId) renderLocalTracer(particleSystem, ev)
          else renderRemoteShot(particleSystem, data.audio, ev)
          break
        case 'enemyShoot': {
          const from = new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z)
          const to = new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z)
          data.audio.playWeaponShoot('rifle', from)
          const dir = to.clone().sub(from).normalize()
          particleSystem.muzzleFlash(from, dir, 0xffcf6a, 4, 7)
          if (ev.hit && ev.victimId === data.netClient?.playerId) {
            data.audio.playPlayerHit()
            setHealth(data.session.player.health)
          }
          break
        }
        case 'enemyTelegraph':
          // Red "about to fire" warning glow — distinct from the bright yellow shot flash.
          particleSystem.muzzleFlash(
            new THREE.Vector3(ev.enemyPos.x, 1.35, ev.enemyPos.z),
            new THREE.Vector3(ev.facing.x, ev.facing.y, ev.facing.z), 0xff3322, 1.5, 4)
          break
        case 'pickup':
          if (ev.playerId === data.netClient?.playerId) {
            if (ev.pickupType === 'health') setHealth(data.session.player.health)
            data.audio.playPickup()
          }
          break
        case 'playerDied':
          if (data.matchConfig.mode === 'coop' && ev.playerId === data.netClient?.playerId) {
            document.exitPointerLock(); data.audio.playPlayerDeath()
            data.session.scoreSystem.saveHighScore(); setHighScore(data.session.scoreSystem.highScore)
            engineRef.current?.stop(); updateGameState('gameover')
          } else if (ev.playerId === data.netClient?.playerId) {
            data.audio.playPlayerDeath()
          }
          break
        case 'playerHitPlayer': {
          const p = ev.hit.point; const point = new THREE.Vector3(p.x, p.y, p.z)
          if (ev.hit.killed) data.particleSystem!.explosion(point, 'player')
          else data.particleSystem!.bloodSplatter(point)
          if (ev.victimId === data.netClient?.playerId) data.audio.playPlayerHit()
          break
        }
        case 'playerKilledPlayer':
          pushKill(ev.attackerId, ev.victimId, ev.teamkill, ev.zone)
          break
        case 'matchOver':
          break // handled via snapshot.scores in updateClient
        case 'bombPlanted':
          setBombState(BombState.Planted)
          setBombSite(ev.site)
          setBombTimer(40)
          break
        case 'bombExploded':
          break
        case 'bombDefused':
          break
        case 'bombDropped':
          setBombState(BombState.Dropped)
          break
        case 'bombPickedUp':
          setBombState(BombState.Carried)
          break
        case 'grenadeDetonated': {
          const localId = data.netClient?.playerId
          data.audio.playGrenadeDetonate(ev.grenadeType, ev.position)
          if (ev.grenadeType === 'he') {
            data.particleSystem?.explosion(new THREE.Vector3(ev.position.x, ev.position.y + 1, ev.position.z), 'grunt', 2.2)
          }
          if (ev.grenadeType === 'flash') {
            data.particleSystem?.flashBang(new THREE.Vector3(ev.position.x, ev.position.y + 1, ev.position.z))
            if (localId && ev.affectedPlayers.includes(localId)) {
              data.flashEffect = triggerFlash(data.flashEffect, ev.blindDurations?.[localId] ?? 0)
              setFlashEffect({ ...data.flashEffect })
            }
          }
          break
        }
      }
    })
    client.onWelcome((_, mode, players, _started) => {
      const data = gameDataRef.current
      if (data.netClient?.config) { data.matchConfig = data.netClient.config }
      setRoomCode(code)
      setLobbyPlayers(players.map(p => p.name))
      setRoster({
        ct: players.filter(p => p.team === 'ct').map(p => p.name),
        t: players.filter(p => p.team === 't').map(p => p.name),
      })
      const peer = data.peerClient?.peer
      if (peer && client.playerId) {
        const chat = startVoice(client.playerId, peer)
        client.onVoiceRoster((r) => chat.setRoster(r))
        client.onVoiceStart((id, name) => chat.remoteStart(id, name))
        client.onVoiceStop((id) => chat.remoteStop(id))
      }
      void mode; void _started
    })
    client.onStart(() => startNetGame('client'))
    client.onJoinRejected((reason) => {
      setJoinError(reason === 'full' ? 'Game is full' : 'Wrong password')
      data.role = 'single'
      data.peerClient?.stop(); data.peerClient = null; data.netClient = null
    })
    client.onDisconnect(() => {
      if (data.role !== 'client') return

      if (data.matchConfig.mode === 'coop') {
        resetNetworking()
        setHostNotice('Host disconnected')
        setRoomCode(null); setLobbyPlayers([]); setIsHost(false)
        updateGameState('mpmenu')
        return
      }

      resetNetworking()
      setHostNotice('Host disconnected - returning to menu')
      setRoomCode(null); setLobbyPlayers([]); setIsHost(false)
      updateGameState('mpmenu')
    })
    client.onPlayerJoined((_id, name, team) => {
      playerIdToNameRef.current.set(_id, name)
      setLobbyPlayers((prev) => prev.includes(name) ? prev : [...prev, name])
      setRoster((prev) => {
        if (prev.ct.includes(name) || prev.t.includes(name)) return prev
        return { ...prev, [team]: [...prev[team], name] }
      })
    })
    client.onTeamChanged((_id, name, team) => {
      setRoster((prev) => moveToTeam(prev, name, team))
    })
    client.onPlayerLeft((id) => {
      gameDataRef.current.voiceChat?.peerDisconnected(id)
      const name = playerIdToNameRef.current.get(id)
      playerIdToNameRef.current.delete(id)
      setLobbyPlayers((prev) => name ? prev.filter((n) => n !== name) : prev)
      if (name) setRoster((prev) => ({
        ct: prev.ct.filter(n => n !== name),
        t: prev.t.filter(n => n !== name),
      }))
    })
    client.transport.send({
      type: 'join',
      name: settingsRef.current.playerName?.trim() || 'Player',
      team: opts?.team ?? myTeam,
      ...(opts?.password ? { password: opts.password } : {}),
    })
  }, [startNetGame, myTeam, pushKill, resetNetworking, updateGameState])

  const refreshServers = useCallback(async () => {
    const dialed = await dialDirectory()
    if (!dialed) { setServers([]); return }
    const entries = await dialed.client.fetchList()
    dialed.peer.destroy()
    setServers(entries.map((e) => ({ ...e, ping: null })))
    // Measure pings in the background, patching rows as they resolve.
    for (const e of entries) {
      measurePing(e.roomCode).then((ping) => {
        setServers((prev) => prev.map((r) => (r.roomCode === e.roomCode ? { ...r, ping } : r)))
      })
    }
  }, [])

  const handleQuickMatch = useCallback(async () => {
    const dialed = await dialDirectory()
    if (!dialed) return
    const match = await findMatch(dialed.client)
    dialed.peer.destroy()
    if (match) {
      joinGame(match.roomCode)
    } else {
      // No servers available, create new room
      setShowMatchSetup(true)
    }
  }, [joinGame])

  const leaveMultiplayer = useCallback(() => {
    resetNetworking()
    setRoomCode(null); setLobbyPlayers([]); setIsHost(false); setServers([])
    setHostNotice(null); setJoinError(null)
    updateGameState('menu')
  }, [updateGameState, resetNetworking])

  useEffect(() => {
    if (gameState === 'mpmenu' && roomCode === null) void refreshServers()
  }, [gameState, roomCode, refreshServers])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const engine = new GameEngine(container)
    engineRef.current = engine
    const data = gameDataRef.current
    data.session.collisionWorld = createArena(engine.scene, getZone(data.session.config.zoneId, data.session.config.randomSeed, data.session.config.customZone))
    engine.scene.add(engine.camera) // so the camera-parented viewmodel renders
    data.viewmodel = new Viewmodel(engine.camera)
    data.particleSystem = new ParticleSystem(engine.scene)
    data.controls = new Controls(container, () => gameStateRef.current, settingsRef.current.keymap)
    data.controls.onIsStoreOpen = () => storeOpenRef.current
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
    // Authority-only: [ adds a CT bot, ] adds a T bot, \ removes the last bot.
    data.controls.onAddBot = (team) => { if (data.role !== 'client') data.session.addBot(team) }
    data.controls.onRemoveBot = () => { if (data.role !== 'client') data.session.removeBot() }

    data.controls.onSelectGrenade = (type: GrenadeType) => {
      if (gameStateRef.current !== 'playing') return
      const gm = data.grenadeManager
      if (gm?.select(type)) {
        setSelectedGrenade(type)
      }
    }

    data.controls.onCycleGrenade = () => {
      if (gameStateRef.current !== 'playing') return
      const gm = data.grenadeManager
      if (gm) {
        const next = gm.cycle()
        setSelectedGrenade(next)
      }
    }

    data.controls.onTalkStart = () => {
      if (gameStateRef.current !== 'playing') return
      const chat = gameDataRef.current.voiceChat
      if (!chat) return
      chat.startTalking().catch(() => {
        setVoiceNotice('Microphone unavailable — push-to-talk disabled')
        setTimeout(() => setVoiceNotice(null), 4000)
      })
    }
    data.controls.onTalkStop = () => {
      gameDataRef.current.voiceChat?.stopTalking()
    }

    data.controls.onIsGrenadeSelected = () => !!data.grenadeManager?.selected

    data.controls.onThrowGrenade = (mode: 'long' | 'short') => {
      if (gameStateRef.current !== 'playing') return
      const gm = data.grenadeManager
      if (!gm?.selected) return
      const session = data.session
      const thrown = gm.selected
      if (session.throwGrenade(session.localId, thrown, mode)) {
        gm.remove(thrown)
        setGrenadeInventory({
          he: gm.getCount('he'),
          flash: gm.getCount('flash'),
          smoke: gm.getCount('smoke'),
        })
        if (!gm.has(thrown)) {
          setSelectedGrenade(gm.selected)
        }
      }
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

    // Build the local player's input from the current control/look state.
    // Shared by the render-loop host tick and the hidden-tab keep-alive tick.
    const captureLocalInput = () => {
      const c = data.controls!
      const mv = c.getMovement()
      return {
        ...emptyInput(),
        forward: mv.forward, backward: mv.backward, left: mv.left, right: mv.right, jump: mv.jump,
        shoot: c.shoot && !storeOpenRef.current,
        yaw: lookRef.current.yaw,
        pitch: lookRef.current.pitch,
      }
    }

    engine.onUpdate((dt) => {
      gameDataRef.current.voiceChat?.tick(performance.now())
      if (data.role === 'client') { updateClient(dt); return }

      const session = data.session
      const controls = data.controls
      const particleSystem = data.particleSystem!
      if (!controls) return

      const m = controls.getMovement()
      const input = captureLocalInput()
      session.applyInput(session.localId, input)

      const enemiesBefore = new Set(session.enemies)
      const pickupsBefore = new Set(session.pickups)
      const grenadesBefore = new Set(session.activeGrenades)
      const smokeCloudsBefore = new Set(session.smokeClouds)

      const events = session.step(dt)

      engine.camera.position.copy(session.player.position)
      engine.camera.rotation.copy(session.player.rotation)
      data.audio.updateListenerPosition(session.player.position.x, session.player.position.y, session.player.position.z)
      const isMoving = m.forward || m.backward || m.left || m.right
      data.viewmodel?.update(dt, isMoving)

      let matchOverPending = false
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
          case 'playerShot':
            // The local player already draws its own muzzle flash; add its tracer here and
            // render only flash/audio for everyone else (tracers are local-only).
            if (ev.shooterId === session.localId) renderLocalTracer(particleSystem, ev)
            else renderRemoteShot(particleSystem, data.audio, ev)
            break
          case 'enemyShoot': {
            const from = new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z)
            const to = new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z)
            data.audio.playWeaponShoot('rifle', from)
            const dir = to.clone().sub(from).normalize()
            particleSystem.muzzleFlash(from, dir, 0xffcf6a, 4, 7)
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
            // Red "about to fire" warning glow — distinct from the bright yellow shot flash.
            particleSystem.muzzleFlash(
              new THREE.Vector3(ev.enemyPos.x, 1.35, ev.enemyPos.z),
              new THREE.Vector3(ev.facing.x, ev.facing.y, ev.facing.z), 0xff3322, 1.5, 4)
            break
          case 'pickup':
            if (ev.pickupType === 'health') setHealth(session.player.health)
            data.audio.playPickup()
            break
          case 'playerDied':
            if (session.config.mode === 'coop') {
              document.exitPointerLock()
              data.audio.playPlayerDeath()
              session.scoreSystem.saveHighScore()
              setHighScore(session.scoreSystem.highScore)
              engine.stop()
              updateGameState('gameover')
              return
            }
            if (ev.playerId === session.localId) data.audio.playPlayerDeath()
            break
          case 'playerHitPlayer': {
            const pt = ev.hit.point
            const point = new THREE.Vector3(pt.x, pt.y, pt.z)
            if (ev.hit.killed) data.particleSystem!.explosion(point, 'player')
            else data.particleSystem!.bloodSplatter(point)
            if (ev.victimId === session.localId) { data.audio.playPlayerHit(); setHealth(session.player.health) }
            break
          }
          case 'playerKilledPlayer': {
            const a = session.getPlayer(ev.attackerId)?.name ?? ev.attackerId
            const v = session.getPlayer(ev.victimId)?.name ?? ev.victimId
            pushKill(a, v, ev.teamkill, ev.zone)
            break
          }
          case 'matchOver':
            setMatchScores(session.scoreboard.snapshot())
            document.exitPointerLock()
            matchOverPending = true
            break
          case 'buyPhaseStart':
            setStoreOpen(true)
            break
          case 'bombPlanted':
            setBombState(BombState.Planted)
            setBombSite(ev.site)
            setBombTimer(40)
            break
          case 'bombExploded':
            break
          case 'bombDefused':
            break
          case 'bombDropped':
            setBombState(BombState.Dropped)
            break
          case 'bombPickedUp':
            setBombState(BombState.Carried)
            break
          case 'grenadeDetonated': {
            data.audio.playGrenadeDetonate(ev.grenadeType, ev.position)
            if (ev.grenadeType === 'he') {
              // Lift off the ground and scale up: a grenade is a big boom, not a grunt-sized
              // puff at floor level (which is easy to miss, especially at throwing distance).
              particleSystem.explosion(new THREE.Vector3(ev.position.x, ev.position.y + 1, ev.position.z), 'grunt', 2.2)
            }
            if (ev.grenadeType === 'flash') {
              // Always show the world burst so you see it pop even when thrown away from you;
              // the full-screen blind only triggers if you're close enough and facing it.
              particleSystem.flashBang(new THREE.Vector3(ev.position.x, ev.position.y + 1, ev.position.z))
              if (ev.affectedPlayers.includes(session.localId)) {
                data.flashEffect = triggerFlash(data.flashEffect, ev.blindDurations?.[session.localId] ?? 0)
                setFlashEffect({ ...data.flashEffect })
              }
            }
            break
          }
        }
      }

      // Player fire feedback (muzzle flash + recoil + sound): the weapon fired this frame
      // iff step() just reset fireTimer to def.fireRate this tick.
      let firedThisFrame = false
      if (!session.player.isDead && controls.shoot && session.weaponManager.current.fireTimer > session.weaponManager.current.def.fireRate - dt) {
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
      // Add newly-thrown grenade meshes; drop the ones that detonated this step.
      for (const g of session.activeGrenades) {
        if (!g.meshRef.parent) engine.scene.add(g.meshRef)
      }
      for (const g of grenadesBefore) {
        if (!session.activeGrenades.includes(g)) engine.scene.remove(g.meshRef)
      }
      // Same for smoke clouds: add new ones, drop expired ones. Without this the
      // SmokeCloud the session creates is updated but never shown.
      for (const s of session.smokeClouds) {
        if (!s.meshRef.parent) engine.scene.add(s.meshRef)
      }
      for (const s of smokeCloudsBefore) {
        if (!session.smokeClouds.includes(s)) engine.scene.remove(s.meshRef)
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
      setHealth(session.player.health)
      setPlayerPos(session.player.position.clone())
      setPlayerRot(session.player.rotation.y)

      // Sync bomb state from session
      if (session.config.mode === 'competitive') {
        setBombState(session.bomb.state)
        setBombTimer(session.bomb.timer)
        setBombSite(session.bomb.site)
        setPlantProgress(session.bomb.plantProgress / 3)
        setDefuseProgress(session.bomb.defuseProgress / session.bomb.defuseDuration)
      }
      setRespawnIn(session.respawnQueue.isPending(session.localId) ? session.respawnQueue.remaining(session.localId) : null)
      if (session.config.mode !== 'coop') setMatchScores(session.scoreboard.snapshot())

      particleSystem.update(dt)
      data.damageIndicator = updateDamageIndicator(data.damageIndicator, dt)
      if (data.damageIndicator.active) setDamageIndicator({ ...data.damageIndicator })
      else if (damageIndicator !== null) setDamageIndicator(null)

      data.flashEffect = updateFlash(data.flashEffect, dt)
      if (data.flashEffect.active) setFlashEffect({ ...data.flashEffect })
      else if (flashEffect !== null) setFlashEffect(null)

      // Host: broadcast the locally-simulated snapshot and render remote players.
      if (data.role === 'host' && data.netHost && data.remotePlayers) {
        const snap = session.getSnapshot()
        data.netHost.broadcastSnapshot(snap, events)
        data.lastPlayers = snap.players
        setAllyPositions(allyDots(snap.players, session.localId))
        data.remotePlayers.sync(snap.players)
        for (const entity of snap.players) {
          const remote = data.remotePlayers.get(entity.id)
          if (remote) {
            remote.setArmor(entity.hasArmor ?? false)
            remote.setHelmet(entity.hasHelmet ?? false)
          }
        }
        data.remotePlayers.update(dt)

        data.pingTimer += dt
        if (data.pingTimer >= 1) { data.pingTimer = 0; data.netHost.pingClients() }
      } else if (data.role === 'single') {
        const snap = session.getSnapshot()
        if (showScoreboardRef.current) data.lastPlayers = snap.players
        setAllyPositions(allyDots(snap.players, session.localId))
        if (data.remotePlayers) {
          data.remotePlayers.sync(snap.players)
          data.remotePlayers.update(dt)
        }
      }
      if (matchOverPending) { engine.stop(); updateGameState('matchover') }
    })

    // Client: forward input, render local view + remote players + enemies from the snapshot.
    function updateClient(dt: number) {
      const controls = data.controls
      const client = data.netClient
      const particleSystem = data.particleSystem
      if (!controls || !client || !particleSystem) return

      const m = controls.getMovement()
      const latestSnap = client.latestSnapshot
      const meSnap = latestSnap?.players.find(p => p.id === client.playerId)
      const isDead = meSnap?.isDead ?? false
      client.sendInput({
        ...emptyInput(),
        forward: isDead ? false : m.forward,
        backward: isDead ? false : m.backward,
        left: isDead ? false : m.left,
        right: isDead ? false : m.right,
        jump: isDead ? false : m.jump,
        shoot: !isDead && controls.shoot && !storeOpenRef.current,
        yaw: lookRef.current.yaw,
        pitch: lookRef.current.pitch,
      })

      client.predictLocal(dt)

      // Predicted fire feedback. The host is authoritative for hits, but the
      // client owns its own gun feel: tick the local weapon and, when it fires,
      // play the sound, kick the viewmodel and decrement ammo locally so the
      // joiner sees/hears their shots instead of a dead gun.
      const isMoving = m.forward || m.backward || m.left || m.right
      const weaponMgr = data.session.weaponManager
      weaponMgr.update(dt)
      let firedThisFrame = false
      if (!isDead && controls.shoot && !storeOpenRef.current && weaponMgr.current.shoot()) {
        firedThisFrame = true
        data.viewmodel?.fire()
        data.audio.playWeaponShoot(weaponVisual(weaponMgr.current.type), client.getLocalPosition())
      }
      data.viewmodel?.update(dt, isMoving)
      setAmmo(weaponMgr.current.ammo)
      setWeaponName(weaponMgr.current.def.name)

      // Smart crosshair (client is non-authoritative, so drive it from local input).
      const weapon = weaponMgr.current
      const ch = crosshairRef.current
      ch.config = resolveCrosshair(settingsRef.current.crosshair, weapon.type)
      ch.bloom = stepBloom(ch.bloom, dt, {
        moving: isMoving,
        airborne: m.jump,
        shotsFired: firedThisFrame ? 1 : 0,
        weaponSpread: weapon.def.spread,
      })

      const snap = client.latestSnapshot
      if (!snap) return
      data.lastPlayers = snap.players
      if (client.playerId) setAllyPositions(allyDots(snap.players, client.playerId))

      const localPos = client.getLocalPosition()
      const localRot = client.getLocalRotation()
      setPlayerPos(localPos.clone())
      setPlayerRot(localRot.y)
      setEnemyPositions(snap.enemies.filter(e => !e.isDead).map(e => new THREE.Vector3(e.position.x, e.position.y, e.position.z)))
      const error = localPos.clone().sub(engine.camera.position)
      if (error.lengthSq() > 0.001) {
        engine.camera.position.lerp(localPos, Math.min(1, dt / 0.1))
      } else {
        engine.camera.position.copy(localPos)
      }
      engine.camera.rotation.set(localRot.x, localRot.y, 0, 'YXZ')

      // Muzzle flash for the local shot, now that the camera orientation is set.
      if (firedThisFrame) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(engine.camera.quaternion)
        particleSystem.muzzleFlash(engine.camera.position.clone().add(fwd), fwd)
      }

      data.audio.updateListenerPosition(engine.camera.position.x, engine.camera.position.y, engine.camera.position.z)
      setHealth(snap.players.find(p => p.id === client.playerId)?.health ?? 100)
      const meState = snap.players.find(p => p.id === client.playerId)
      setRespawnIn(meState?.respawnIn ?? null)
      setMatchScores(snap.scores)
      if (snap.bomb) {
        setBombState(snap.bomb.state as BombState)
        setBombTimer(snap.bomb.timer ?? 40)
        setBombSite(snap.bomb.site ?? null)
        if (snap.bomb.plantProgress !== undefined) setPlantProgress(snap.bomb.plantProgress / 3)
        if (snap.bomb.defuseProgress !== undefined) setDefuseProgress(snap.bomb.defuseProgress / (snap.bomb.defuseDuration ?? 5))
      }
      if (snap.scores.matchOver && gameStateRef.current === 'playing') {
        document.exitPointerLock()
        updateGameState('matchover')
      }

      data.remotePlayers?.sync(snap.players)
      if (data.remotePlayers) {
        for (const entity of snap.players) {
          const remote = data.remotePlayers.get(entity.id)
          if (remote) {
            remote.setArmor(entity.hasArmor ?? false)
            remote.setHelmet(entity.hasHelmet ?? false)
          }
        }
      }
      renderClientEnemies(snap.enemies)
      renderClientGrenades(snap.grenades)
      data.remotePlayers?.update(dt)
      particleSystem.update(dt)

      data.flashEffect = updateFlash(data.flashEffect, dt)
      if (data.flashEffect.active) setFlashEffect({ ...data.flashEffect })
      else if (flashEffect !== null) setFlashEffect(null)
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

    function renderClientGrenades(grenades: GrenadeState[]) {
      const map = data.clientGrenades
      const seen = new Set<string>()
      for (const g of grenades) {
        seen.add(g.id)
        let mesh = map.get(g.id)
        if (!mesh) {
          mesh = createGrenadeModel(g.type)
          map.set(g.id, mesh)
          engine.scene.add(mesh)
        }
        mesh.position.set(g.position.x, g.position.y, g.position.z)
        mesh.rotation.set(g.rotation.x, g.rotation.y, g.rotation.z)
      }
      for (const [id, mesh] of map) {
        if (!seen.has(id)) {
          engine.scene.remove(mesh)
          disposeGroup(mesh)
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

      if (e.code === 'KeyH' && (gameStateRef.current === 'playing' || gameStateRef.current === 'paused')) {
        setShowInGameHelp((prev) => !prev)
      }

      if (e.code === 'KeyR') {
        data.session.weaponManager.current.reload()
      }

      if (e.code === 'KeyG' && gameStateRef.current === 'playing') {
        if (data.role === 'host') {
          if (data.session.config.mode !== 'pvp') data.session.waveManager.spawnNextWave()
        } else if (data.role === 'client' && data.netClient) {
          data.netClient.transport.send({ type: 'startWave', playerId: data.netClient.playerId! })
        }
      }

      // Bomb objective (competitive): '5' plants, 'E' defuses. The authoritative
      // session lives on the host/single-player; clients ask the host to act.
      if (e.code === 'Digit5' && gameStateRef.current === 'playing') {
        if (data.role === 'client' && data.netClient) {
          data.netClient.transport.send({ type: 'plantBomb', playerId: data.netClient.playerId! })
        } else {
          data.session.tryPlant(data.session.localId)
        }
      }

      if (e.code === 'KeyE' && gameStateRef.current === 'playing') {
        const hasKit = ownedRef.current.includes('defuse_kit')
        if (data.role === 'client' && data.netClient) {
          data.netClient.transport.send({ type: 'defuseBomb', playerId: data.netClient.playerId!, hasKit })
        } else {
          data.session.tryDefuse(data.session.localId, hasKit)
        }
      }

      const slotKeys: Record<string, 'primary' | 'secondary'> = { Digit1: 'primary', Digit2: 'secondary' }
      if (e.code in slotKeys && gameStateRef.current === 'playing') {
        const wm = data.session.weaponManager
        wm.selectSlot(slotKeys[e.code])
        // Switching to a gun puts grenades away so left click fires again.
        if (data.grenadeManager?.selected) {
          data.grenadeManager.selected = null
          setSelectedGrenade(null)
        }
        setWeaponName(wm.current.def.name)
        setAmmo(wm.current.ammo)
        data.viewmodel?.setWeapon(weaponVisual(wm.current.type))
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // Browsers pause requestAnimationFrame for hidden tabs. For a host that
    // would freeze the authoritative simulation for every connected client —
    // they'd see the host (and themselves, once reconciled) unable to move or
    // shoot. A Web Worker's timer is exempt from that throttling, so we drive a
    // fixed-rate authoritative step from one whenever the host's page is hidden.
    // (When visible, the render loop above owns stepping; this no-ops.)
    const HIDDEN_TICK_HZ = 30
    const keepAliveWorker = new Worker(
      URL.createObjectURL(
        new Blob(
          [`let id=null;onmessage=e=>{if(e.data==='start'){if(id==null)id=setInterval(()=>postMessage(0),${Math.round(1000 / HIDDEN_TICK_HZ)})}else{clearInterval(id);id=null}}`],
          { type: 'application/javascript' },
        ),
      ),
    )
    keepAliveWorker.onmessage = () => {
      if (document.visibilityState !== 'hidden') return
      if (gameStateRef.current !== 'playing') return
      if (data.role !== 'host' || !data.netHost) return
      const session = data.session
      session.applyInput(session.localId, captureLocalInput())
      const events = session.step(1 / HIDDEN_TICK_HZ)
      data.netHost.broadcastSnapshot(session.getSnapshot(), events)
    }
    keepAliveWorker.postMessage('start')

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousemove', onMouseMove)
      data.controls?.destroy()
      data.viewmodel?.dispose()
      keepAliveWorker.postMessage('stop')
      keepAliveWorker.terminate()
      engine.dispose()
    }
  }, [updateGameState])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {gameState === 'menu' && (
        <>
          <MainMenu
            onSingleplayer={() => updateGameState('teamselect')}
            onMultiplayer={() => updateGameState('mpmenu')}
            onSettings={() => updateGameState('settings')}
            onAbout={() => setShowAbout(true)}
            onHelp={() => setShowHelp(true)}
          />
          {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
          {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
        </>
      )}

      {gameState === 'settings' && (
        <SettingsMenu
          settings={settings}
          onChange={updateSettings}
          onBack={() => updateGameState('menu')}
          onKeybinds={() => updateGameState('keybinds')}
        />
      )}

      {gameState === 'keybinds' && (
        <KeybindsScreen
          settings={settings}
          onChange={updateSettings}
          onBack={() => updateGameState('settings')}
        />
      )}

      {gameState === 'teamselect' && (
        <TeamSelect onBack={() => updateGameState('menu')} onSelect={(t, zoneId) => {
          setTeam(t)
          gameDataRef.current.matchConfig = { ...gameDataRef.current.matchConfig, zoneId }
          startGame()
        }} />
      )}

      {gameState === 'mpmenu' && (
        <>
          <MultiplayerMenu
            roomCode={roomCode}
            players={lobbyPlayers}
            isHost={isHost}
            servers={servers}
            onHost={() => setShowMatchSetup(true)}
            onJoin={(code, pw) => joinGame(code, pw ? { password: pw } : undefined)}
            onJoinFree={(code, team, password) => joinGame(code, { team, password })}
            joinError={joinError}
            onCancelJoin={() => setJoinError(null)}
            onStart={() => {
              const data = gameDataRef.current
              data.hostDirectory?.setStatus('in-progress')
              data.netHost?.startMatch()
              startNetGame('host')
              const hostPeer = data.peerHost?.peer
              if (data.netHost && hostPeer && roomCode) {
                const chat = startVoice(data.session.localId, hostPeer)
                data.netHost.onHostRoster((r) => chat.setRoster(r))
                data.netHost.onRemoteVoiceStart((id, name) => chat.remoteStart(id, name))
                data.netHost.onRemoteVoiceStop((id) => chat.remoteStop(id))
                data.netHost.setHostVoice(data.session.localId, roomCode)
              }
            }}
            onBack={leaveMultiplayer}
            onRefresh={refreshServers}
            onQuickMatch={handleQuickMatch}
            myTeam={myTeam}
            onSelectTeam={(t) => {
              setMyTeam(t)
              setRoster((prev) => moveToTeam(prev, settingsRef.current.playerName, t))
              const data = gameDataRef.current
              if (data.role === 'host') {
                const me = data.session.getPlayer(data.session.localId)
                if (me) { me.team = t; me.player.position.copy(pickSpawn(t, data.session.map)) }
                data.netHost?.broadcastTeamChange(data.session.localId, settingsRef.current.playerName, t)
              } else if (data.netClient) {
                data.netClient.transport.send({ type: 'setTeam', playerId: data.netClient.playerId!, team: t })
              }
            }}
            roster={roster}
          />
          {hostNotice && (
            <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
              background: '#5f1d1d', color: '#fff', padding: '8px 16px', borderRadius: 6,
              fontFamily: 'monospace', zIndex: 70 }}
              onClick={() => setHostNotice(null)}>
              {hostNotice} — click to dismiss
            </div>
          )}
        </>
      )}
      {gameState === 'mpmenu' && showMatchSetup && (
        <MatchSetup
          onBack={() => setShowMatchSetup(false)}
          onConfirm={(c) => { setShowMatchSetup(false); void hostGame(c).catch(() => setJoinError('Could not start hosting.')) }}
          onCreateMap={() => { setShowMatchSetup(false); updateGameState('mapeditor') }}
        />
      )}
      {gameState === 'mapeditor' && (
        <MapEditor
          onSave={() => { updateGameState('mpmenu'); setShowMatchSetup(true) }}
          onCancel={() => { updateGameState('mpmenu'); setShowMatchSetup(true) }}
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
            round={gameDataRef.current.session.roundManager?.round}
            roundTimer={gameDataRef.current.session.roundManager?.roundTimer}
            buyPhase={gameDataRef.current.session.roundManager?.buyPhase}
            buyPhaseTimer={gameDataRef.current.session.roundManager?.buyPhaseTimer}
            money={gameDataRef.current.session.economy?.money}
            ctScore={gameDataRef.current.session.roundManager?.ctScore}
            tScore={gameDataRef.current.session.roundManager?.tScore}
            bombState={bombState}
            bombTimer={bombTimer}
            bombSite={bombSite ?? undefined}
            plantProgress={plantProgress}
            defuseProgress={defuseProgress}
            grenadeInventory={grenadeInventory}
            selectedGrenade={selectedGrenade}
            mobile={mobileControlsActive(settings)}
          />
          <Crosshair runtime={crosshairRef} />
          <Minimap
            playerPosition={playerPos}
            playerRotation={playerRot}
            enemies={enemyPositions}
            allies={allyPositions}
            arenaSize={ARENA_SIZE}
            bombsites={gameDataRef.current.session.bombsites.map(s => ({ id: s.id, position: s.center }))}
            bombPosition={gameDataRef.current.session.bomb.position ?? undefined}
            structures={gameDataRef.current.session.map.structures}
          />
          <WaveAnnounce wave={wave} visible={showWaveAnnounce} />
          <DamageOverlay indicator={damageIndicator} />
          <FlashOverlay flash={flashEffect} />
          <KillFeed lines={killFeed} />
          <VoiceIndicator speakers={speakers} />
          {voiceNotice && (
            <div style={{ position: 'absolute', left: 16, bottom: 64, zIndex: 60,
              background: 'rgba(95,29,29,0.85)', color: '#fff', padding: '6px 12px',
              borderRadius: 6, fontFamily: 'monospace', fontSize: 13, pointerEvents: 'none' }}>
              {voiceNotice}
            </div>
          )}
          {respawnIn !== null && <RespawnOverlay seconds={respawnIn} />}
          {showScoreboard && <Scoreboard players={scoreboardPlayers} roomCode={roomCode} scores={matchScores ?? undefined} />}
          {mobileControlsActive(settings) && gameDataRef.current.controls && (
            <TouchControls
              controls={gameDataRef.current.controls}
              lookRef={lookRef}
              lookSensitivity={settings.lookSensitivity}
              onReload={() => gameDataRef.current.session.weaponManager.current.reload()}
              onCycleWeapon={() => gameDataRef.current.controls?.onCycleWeapon?.()}
              onToggleStore={() => gameDataRef.current.controls?.onToggleStore?.()}
              onToggleScoreboard={() => setShowScoreboard((s) => !s)}
              onSelectGrenade={(type) => gameDataRef.current.controls?.onSelectGrenade?.(type)}
              activeGrenade={selectedGrenade}
            />
          )}
          <RotateHint enabled={mobileControlsActive(settings)} />
        </>
      )}

      {gameState === 'playing' && showInGameHelp && (
        <HelpModal onClose={() => setShowInGameHelp(false)} inGame />
      )}

      {gameState === 'playing' && storeOpen && (
        <BuyMenu
          team={team}
          money={money}
          owned={owned}
          grenadeInventory={grenadeInventory}
          onBuy={(id) => {
            const data = gameDataRef.current
            const item = findItem(id)
            if (!item || !canAffordItem(data.money, id)) return
            const grenadeKey = GRENADE_ITEM_KEY[id]
            if (grenadeKey) {
              // Grenades are stackable: block at the carry limit, ignore owned.
              if ((data.grenadeManager?.getCount(grenadeKey) ?? 0) >= GRENADE_DEFS[grenadeKey].carryLimit) return
            } else if (owned.includes(id)) {
              return
            }
            data.money -= item.price
            setMoney(data.money)
            if (data.role === 'client' && data.netClient) {
              data.netClient.transport.send({ type: 'buy', playerId: data.netClient.playerId!, item: id })
            } else {
              applyItem(item, data.session.player, data.session.weaponManager)
            }
            if (!grenadeKey) {
              setOwned((prev) => { const next = [...prev, id]; ownedRef.current = next; return next })
            }
            setMaxHealth(data.session.player.maxHealth)
            const wm = data.session.weaponManager
            setWeaponName(wm.current.def.name)
            setAmmo(wm.current.ammo)
            switch (id) {
              case 'bomb':
                data.viewmodel?.setObjective('bomb')
                break
              case 'defuse_kit':
                data.viewmodel?.setObjective('defuse_kit')
                break
              case 'he_grenade':
                data.grenadeManager?.add('he')
                setGrenadeInventory({
                  he: data.grenadeManager?.getCount('he') ?? 0,
                  flash: data.grenadeManager?.getCount('flash') ?? 0,
                  smoke: data.grenadeManager?.getCount('smoke') ?? 0,
                })
                break
              case 'flashbang':
                data.grenadeManager?.add('flash')
                setGrenadeInventory({
                  he: data.grenadeManager?.getCount('he') ?? 0,
                  flash: data.grenadeManager?.getCount('flash') ?? 0,
                  smoke: data.grenadeManager?.getCount('smoke') ?? 0,
                })
                break
              case 'smoke_grenade':
                data.grenadeManager?.add('smoke')
                setGrenadeInventory({
                  he: data.grenadeManager?.getCount('he') ?? 0,
                  flash: data.grenadeManager?.getCount('flash') ?? 0,
                  smoke: data.grenadeManager?.getCount('smoke') ?? 0,
                })
                break
              default:
                data.viewmodel?.setWeapon(weaponVisual(wm.current.type))
                break
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
          onHelp={() => setShowInGameHelp(true)}
          onMainMenu={() => {
            engineRef.current?.stop()
            updateGameState('menu')
          }}
        />
      )}

      {gameState === 'paused' && showInGameHelp && (
        <HelpModal onClose={() => setShowInGameHelp(false)} inGame />
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

      {gameState === 'matchover' && (
        <MatchOver
          winningTeam={matchScores?.winningTeam ?? null}
          scores={matchScores ?? { teams: { ct: 0, t: 0 }, players: {}, matchOver: true, winningTeam: null }}
          onRestart={gameDataRef.current.role === 'single' ? startGame : undefined}
          onBackToLobby={() => {
            engineRef.current?.stop()
            setKillFeed([]); setRespawnIn(null)
            updateGameState('mpmenu')
          }}
        />
      )}
    </div>
  )
}

export default App
