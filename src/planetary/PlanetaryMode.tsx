import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { PlanetaryEngine } from './PlanetaryEngine'
import { GeoControls } from './GeoControls'
import { PlanetaryCollision } from './PlanetaryCollision'
import { PlanetaryScenery } from './PlanetaryScenery'
import { SunSystem } from './SunSystem'
import { MapPicker } from './MapPicker'
import { GameSession } from '../session/GameSession'
import { defaultCompetitiveConfig } from '../session/MatchConfig'
import type { MatchConfig } from '../session/MatchConfig'
import type { NetHost } from '../net/NetHost'
import type { NetClient } from '../net/NetClient'
import { Bombsite } from '../session/Bombsite'
import { findSpawnPoints } from './PlanetarySpawns'
import { RoundState } from '../session/RoundManager'
import { HUD } from '../ui/HUD'
import { BuyMenu } from '../ui/BuyMenu'
import { Scoreboard } from '../ui/Scoreboard'
import { TouchControls } from '../ui/TouchControls'
import { Viewmodel } from '../weapons/Viewmodel'
import { Controls } from '../player/Controls'
import { mobileControlsActive, loadSettings } from '../settings/Settings'
import type { EntityState, GrenadeState, SessionEvent, Snapshot } from '../session/protocol'
import { ParticleSystem } from '../effects/ParticleSystem'
import { renderRemoteShot, renderLocalTracer } from '../effects/shotEffects'
import { SoundEffects } from '../audio/SoundEffects'
import { AudioManager } from '../audio/AudioManager'
import { weaponVisual } from '../weapons/WeaponDefs'
import { stepBloom, BLOOM_PIXELS } from '../weapons/CrosshairBloom'
import { RemotePlayerManager } from '../net/RemotePlayerManager'
import { GrenadeManager } from '../weapons/GrenadeManager'
import { GRENADE_DEFS } from '../weapons/GrenadeDefs'
import { findItem, canAffordItem } from '../weapons/StoreCatalog'
import { applyItem } from '../player/applyPurchase'
import { createDamageIndicatorState, triggerDamage, updateDamageIndicator, type DamageIndicatorState } from '../effects/DamageIndicator'
import { createFlashEffect, triggerFlash, updateFlash, type FlashEffectState } from '../effects/FlashEffect'
import { DamageOverlay } from '../ui/DamageOverlay'
import { FlashOverlay } from '../ui/FlashOverlay'
import { BombState } from '../session/BombCarrier'
import type { GrenadeType } from '../types'

/** Maps a grenade store item id to its grenade type/inventory key (same as App.tsx). */
const GRENADE_ITEM_KEY: Record<string, GrenadeType> = {
  he_grenade: 'he',
  flashbang: 'flash',
  smoke_grenade: 'smoke',
}

export interface PlanetaryNet {
  role: 'host' | 'client'
  config: MatchConfig
  netHost: NetHost | null      // set when role === 'host'
  netClient: NetClient | null  // set when role === 'client'
  session: GameSession | null  // host: the NetHost-attached session from App; client: null
  onRemotePlayers?: (rp: RemotePlayerManager | null) => void
}

interface PlanetaryModeProps {
  onExit: () => void
  net?: PlanetaryNet
}

interface HudState {
  health: number
  maxHealth: number
  ammo: number
  maxAmmo: number
  weaponName: string
  money: number
}

export function PlanetaryMode({ onExit, net }: PlanetaryModeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PlanetaryEngine | null>(null)
  const controlsRef = useRef<GeoControls | null>(null)
  const collisionRef = useRef<PlanetaryCollision | null>(null)
  const sessionRef = useRef<GameSession | null>(null)
  const rafRef = useRef<number>(0)
  const touchLookRef = useRef({ yaw: 0, pitch: 0 })
  const desktopControlsRef = useRef<Controls | null>(null)
  const particleSystemRef = useRef<ParticleSystem | null>(null)
  const audioRef = useRef<SoundEffects | null>(null)
  const viewmodelRef = useRef<Viewmodel | null>(null)
  const sceneryRef = useRef<PlanetaryScenery | null>(null)
  const sunSystemRef = useRef(new SunSystem())
  const [sunHour, setSunHour] = useState(10.5)
  const sunHourRef = useRef(10.5)
  const lastSceneryVersionRef = useRef(-1)
  useEffect(() => { sunHourRef.current = sunHour }, [sunHour])

  const [showPicker, setShowPicker] = useState(!net)
  const [startCenter, setStartCenter] = useState<[number, number] | null>(net?.config.planetaryCenter ?? null)
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
  // Client session events arrive via NetClient's onEvent callback (fed from
  // snapshot.events), not from session.step — buffered here for the loop to drain.
  const clientEventsRef = useRef<SessionEvent[]>([])
  const mouseShootRef = useRef(false)
  const [mobileControls] = useState(() => mobileControlsActive(loadSettings()))
  const [csMode, setCsMode] = useState(false)
  const [bloom, setBloom] = useState(0)
  const remotePlayersRef = useRef<RemotePlayerManager | null>(null)
  const grenadeManagerRef = useRef<GrenadeManager | null>(null)
  const damageStateRef = useRef(createDamageIndicatorState())
  const flashStateRef = useRef(createFlashEffect())
  const lastMapCenterRef = useRef({ x: 0, z: 0 })
  const perfRef = useRef({ level: 0 as 0 | 1 | 2, acc: 0, n: 0, warm: false })
  const pingAccumRef = useRef(0)
  const [damageIndicator, setDamageIndicator] = useState<DamageIndicatorState | null>(null)
  const [flashEffect, setFlashEffect] = useState<FlashEffectState | null>(null)
  const [grenadeInventory, setGrenadeInventory] = useState({ he: 0, flash: 0, smoke: 0 })
  const [selectedGrenade, setSelectedGrenade] = useState<GrenadeType | null>(null)
  const [bombHud, setBombHud] = useState<{ state: BombState; timer: number; site: 'A' | 'B' | null; plant: number; defuse: number }>({
    state: BombState.None, timer: 40, site: null, plant: 0, defuse: 0,
  })

  // openScoreboard lives outside the render loop, so it needs a live handle on `net`.
  const netRef = useRef(net)
  netRef.current = net

  // Scoreboard state is event-driven (kills/deaths); snapshot on open so it isn't
  // empty when nothing has happened yet (e.g. freshly added bots).
  const openScoreboard = useCallback(() => {
    const clientSnap = netRef.current?.netClient?.latestSnapshot
    const source = clientSnap ? clientSnap.players : (sessionRef.current ? sessionRef.current.getSnapshot().players : [])
    setScoreboardPlayers(source.map(p => ({ ...p, kind: 'player' as const, type: 'player' })))
    setShowScoreboard(true)
  }, [])

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

      // Building tiles aren't rendered yet at map 'load', so the first scan finds
      // nothing. Re-scan whenever the map settles (tiles done) — the loop's version
      // gate then meshes the buildings. Also fires as the player enters new areas.
      engine.map.on('idle', () => collisionRef.current?.markStale())

      const scenery = new PlanetaryScenery(
        engine.map,
        (lng, lat) => engine.lngLatToLocal(lng, lat),
      )
      sceneryRef.current = scenery
      engine.map.on('idle', () => sceneryRef.current?.markStale())

      const config = net?.config ?? defaultCompetitiveConfig()
      const session = net?.session ?? new GameSession(config)
      session.collisionWorld = collisionRef.current.collisionWorld

      // Place 2 bombsites near the drop location (in meters from origin)
      session.bombsites = [
        new Bombsite('A', { x: 20, y: 0, z: 20 }),
        new Bombsite('B', { x: -20, y: 0, z: -20 }),
      ]

      // session.map is the shared zone singleton (getZone('arid')) — clone it
      // rather than mutating in place, and replace its indoor spawn points
      // (fixed offsets like [-4,-36], meaningless on the real map) with ones
      // found on the actual terrain. Otherwise a mid-round respawn can land
      // the player inside whatever real building happens to sit at that
      // arena-local coordinate — the "stuck, nothing visible" bug.
      const findLocalSpawns = (team: 'ct' | 't') =>
        findSpawnPoints(engine.map, startCenter[0], startCenter[1], team)
          .map(([lng, lat]) => engine.lngLatToLocal(lng, lat)) as [number, number][]
      session.map = {
        ...session.map,
        arenaSize: 5000, // large enough to never clamp in open-world play
        ctSpawns: findLocalSpawns('ct'),
        tSpawns: findLocalSpawns('t'),
      }
      // Building/park tiles aren't rendered yet at map 'load' (same reason
      // collision re-scans on 'idle'), so redo the spawn search once they are.
      engine.map.once('idle', () => {
        session.map = {
          ...session.map,
          ctSpawns: findLocalSpawns('ct'),
          tSpawns: findLocalSpawns('t'),
        }
      })

      // Set up round manager for competitive play
      if (session.roundManager) {
        session.roundManager.state = RoundState.Buying
        session.roundManager.buyPhaseTimer = config.buyPhaseDuration ?? 15
      }

      // Add viewmodel (first-person gun) to the camera
      const viewmodel = new Viewmodel(engine.camera)
      viewmodelRef.current = viewmodel
      engine.scene.add(engine.camera) // ensure camera is in scene graph

      // Create feedback systems for shooting (muzzle flash, audio)
      const particleSystem = new ParticleSystem(engine.scene)
      const audio = new SoundEffects(new AudioManager())
      particleSystemRef.current = particleSystem
      audioRef.current = audio

      // Create a Controls instance for touch input (TouchControls writes to it)
      const gameControls = new Controls(containerRef.current!, () => 'planetary', { ...loadSettings().keymap })
      desktopControlsRef.current = gameControls

      // Bots and other players are session entities but need meshes to be visible.
      // Clients render everyone but themselves — key off the network id, which is
      // assigned before this component mounts (join happens in the lobby).
      remotePlayersRef.current = new RemotePlayerManager(engine.scene, net?.netClient?.playerId ?? session.localId)

      // Grenade inventory/selection (client-side, same split as App.tsx)
      const gm = new GrenadeManager()
      grenadeManagerRef.current = gm
      setGrenadeInventory({ he: 0, flash: 0, smoke: 0 })
      setSelectedGrenade(null)
      gameControls.onSelectGrenade = (type) => {
        if (gm.select(type)) setSelectedGrenade(type)
      }
      gameControls.onCycleGrenade = () => setSelectedGrenade(gm.cycle())
      // Keymap parity with App.tsx: [ adds a CT bot, ] adds a T bot, \ removes one.
      // Host-authoritative — clients can't spawn/remove bots directly.
      gameControls.onAddBot = (team) => { if (net?.role === 'client') return; session.addBot(team) }
      gameControls.onRemoveBot = () => { if (net?.role === 'client') return; session.removeBot() }

      sessionRef.current = session
      // Client session events arrive via NetClient (fed from snapshot.events), not
      // session.step. This replaces the arena handler App registered in joinGame —
      // planetary owns effects while mounted; leaveMultiplayer tears down on exit.
      if (net?.role === 'client' && net.netClient) {
        net.netClient.onEvent((ev) => clientEventsRef.current.push(ev))
      }
      net?.onRemotePlayers?.(remotePlayersRef.current)
      // hostGame() disables auto waves for the arena lobby; planetary has no
      // manual wave button, so co-op/hybrid AI must auto-spawn here.
      if (net?.role === 'host' && (config.mode === 'coop' || config.mode === 'hybrid')) {
        session.waveManager.auto = true
      }

      // Client-only render mirrors: enemies/grenades are session entities on the
      // host, but the client never steps its session — it renders straight from
      // the snapshot instead (mirrors App.tsx's renderClientEnemies/Grenades).
      const clientEnemyMeshes = new Map<string, THREE.Mesh>()
      function renderClientEnemies(enemies: EntityState[]) {
        const seen = new Set<string>()
        for (const e of enemies) {
          seen.add(e.id)
          let mesh = clientEnemyMeshes.get(e.id)
          if (!mesh) {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xcc3333 }))
            clientEnemyMeshes.set(e.id, mesh)
            engine.scene.add(mesh)
          }
          mesh.position.set(e.position.x, e.position.y + 0.9, e.position.z)
          mesh.rotation.y = e.rotationY
          mesh.visible = !e.isDead
        }
        for (const [id, mesh] of clientEnemyMeshes) {
          if (!seen.has(id)) {
            engine.scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose()
            clientEnemyMeshes.delete(id)
          }
        }
      }
      const clientGrenadeMeshes = new Map<string, THREE.Mesh>()
      function renderClientGrenades(grenades: GrenadeState[]) {
        const seen = new Set<string>()
        for (const g of grenades) {
          seen.add(g.id)
          let mesh = clientGrenadeMeshes.get(g.id)
          if (!mesh) {
            mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2a3a2a }))
            clientGrenadeMeshes.set(g.id, mesh)
            engine.scene.add(mesh)
          }
          mesh.position.set(g.position.x, g.position.y, g.position.z)
        }
        for (const [id, mesh] of clientGrenadeMeshes) {
          if (!seen.has(id)) {
            engine.scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose()
            clientGrenadeMeshes.delete(id)
          }
        }
      }

      let last = performance.now()
      function loop(now: number) {
        const rawMs = now - last
        const dt = Math.min(rawMs / 1000, 0.05)
        last = now

        // Auto-degrade visuals when the GPU can't keep up: postprocessing alone
        // is ~2/3 of the frame on weak GPUs (measured — see PlanetaryEngine.setPerfLevel).
        // First 30-frame window is discarded as tile-loading warmup.
        const perf = perfRef.current
        perf.acc += rawMs
        if (++perf.n >= 30) {
          const avg = perf.acc / perf.n
          perf.acc = 0; perf.n = 0
          if (!perf.warm) perf.warm = true
          else if (avg > 70 && perf.level < 2) {
            perf.level = (perf.level + 1) as 0 | 1 | 2
            engine.setPerfLevel(perf.level)
          }
        }

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

        // 3-4. Apply input / step the session. Clients don't step their own
        // session — they predict locally via NetClient and send input to the
        // host, which is authoritative. (Follows App.tsx's updateClient.)
        const isClient = net?.role === 'client' && !!net.netClient
        let events: SessionEvent[]
        let snap: Snapshot
        let firedThisFrame = false
        const grenadesBefore = new Set(session.activeGrenades)
        const smokeCloudsBefore = new Set(session.smokeClouds)
        const enemiesBefore = [...session.enemies]

        if (isClient) {
          const client = net!.netClient!
          const meSnap = client.latestSnapshot?.players.find(pl => pl.id === client.playerId)
          const dead = meSnap?.isDead ?? false
          client.sendInput({
            ...input,
            forward: dead ? false : input.forward,
            backward: dead ? false : input.backward,
            left: dead ? false : input.left,
            right: dead ? false : input.right,
            jump: dead ? false : input.jump,
            shoot: dead ? false : input.shoot,
          })
          client.collisionWorld = collisionRef.current?.collisionWorld ?? null
          client.arenaSize = 5000
          client.predictLocal(dt)
          // Local gun feel: host is authoritative for hits; the client owns sound/kick/ammo.
          const wm = session.weaponManager
          wm.update(dt)
          if (!dead && input.shoot && wm.current.shoot()) {
            firedThisFrame = true
            viewmodel.fire()
            audioRef.current?.playWeaponShoot(weaponVisual(wm.current.type), client.getLocalPosition())
          }
          events = clientEventsRef.current
          clientEventsRef.current = []
          snap = client.latestSnapshot ?? {
            tick: 0, seq: 0, ack: {}, players: [], enemies: [], grenades: [], events: [],
            scores: { teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null },
          }
          setIsDead(dead)
          setRespawnIn(meSnap?.respawnIn ?? null)
        } else {
          session.applyInput(session.localId, input)
          events = session.step(dt)
          snap = session.getSnapshot()
        }

        // 4. Update the Three.js camera from player state (eye pos + look).
        const p = isClient ? net!.netClient!.getLocalPosition() : session.player.position
        const viewYaw = isClient ? gc.yaw : session.player.rotation.y
        const viewPitch = isClient ? gc.pitch : session.player.rotation.x
        engine.setViewFromPlayer(p, viewYaw, viewPitch)

        // 5. Process session events for round flow
        let scoreboardDirty = false
        const localPid = isClient ? net!.netClient!.playerId! : session.localId
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
              const nameOf = (pid: string) => isClient
                ? (net!.netClient!.latestSnapshot?.players.find(pl => pl.id === pid)?.name ?? pid)
                : (session.getPlayer(pid)?.name ?? 'Unknown')
              const a = nameOf(ev.attackerId)
              const v = nameOf(ev.victimId)
              const id = killSeqRef.current++
              setKillFeed(prev => [...prev.slice(-4), { id, attacker: a, victim: v, ts: Date.now() }])
              if (ev.victimId === localPid) {
                setIsDead(true)
              }
              scoreboardDirty = true
              break
            }
            case 'playerDied':
              if (ev.playerId === localPid) {
                setIsDead(true)
                if (!isClient) setRespawnIn(session.respawnQueue.isPending(session.localId) ? session.respawnQueue.remaining(session.localId) : null)
              }
              scoreboardDirty = true
              break
            case 'playerRespawned':
              if (ev.playerId === localPid) {
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
            case 'wallImpact':
              particleSystemRef.current?.bulletImpact(new THREE.Vector3(ev.point.x, ev.point.y, ev.point.z))
              break
            case 'playerShot':
              if (particleSystemRef.current) {
                if (ev.shooterId === localPid) renderLocalTracer(particleSystemRef.current, ev)
                else if (audioRef.current) renderRemoteShot(particleSystemRef.current, audioRef.current, ev)
              }
              break
            case 'playerHitEnemy': {
              const hp = ev.hit.point
              const point = new THREE.Vector3(hp.x, hp.y, hp.z)
              if (ev.hit.killed) particleSystemRef.current?.explosion(point, ev.enemyType)
              else particleSystemRef.current?.bloodSplatter(point)
              break
            }
            case 'playerHitPlayer': {
              const hp = ev.hit.point
              const point = new THREE.Vector3(hp.x, hp.y, hp.z)
              if (ev.hit.killed) particleSystemRef.current?.explosion(point, 'player')
              else particleSystemRef.current?.bloodSplatter(point)
              if (ev.victimId === localPid) audioRef.current?.playPlayerHit()
              break
            }
            case 'enemyShoot': {
              const from = new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z)
              const to = new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z)
              const dir = to.clone().sub(from).normalize()
              audioRef.current?.playWeaponShoot('rifle', from)
              particleSystemRef.current?.muzzleFlash(from, dir, 0xffcf6a, 4, 7)
              if (ev.hit && ev.victimId === localPid) {
                audioRef.current?.playPlayerHit()
                damageStateRef.current = triggerDamage(from.clone(), p.clone(), viewYaw)
                setDamageIndicator({ ...damageStateRef.current })
              }
              break
            }
            case 'grenadeDetonated': {
              audioRef.current?.playGrenadeDetonate(ev.grenadeType, ev.position)
              if (ev.grenadeType === 'he') {
                particleSystemRef.current?.explosion(new THREE.Vector3(ev.position.x, ev.position.y + 1, ev.position.z), 'grunt', 2.2)
              }
              if (ev.grenadeType === 'flash') {
                particleSystemRef.current?.flashBang(new THREE.Vector3(ev.position.x, ev.position.y + 1, ev.position.z))
                if (ev.affectedPlayers.includes(localPid)) {
                  flashStateRef.current = triggerFlash(flashStateRef.current, ev.blindDurations?.[localPid] ?? 0)
                  setFlashEffect({ ...flashStateRef.current })
                }
              }
              break
            }
          }
        }

        // Grenade + smoke meshes: add newly thrown, drop detonated/expired (same as
        // App.tsx). Host/solo only — session.activeGrenades/smokeClouds/enemies
        // aren't stepped on clients; those render straight from the snapshot below.
        if (!isClient) {
          for (const g of session.activeGrenades) {
            if (!g.meshRef.parent) engine.scene.add(g.meshRef)
          }
          for (const g of grenadesBefore) {
            if (!session.activeGrenades.includes(g)) engine.scene.remove(g.meshRef)
          }
          for (const s of session.smokeClouds) {
            if (!s.meshRef.parent) engine.scene.add(s.meshRef)
          }
          for (const s of smokeCloudsBefore) {
            if (!session.smokeClouds.includes(s)) engine.scene.remove(s.meshRef)
          }

          // AI wave enemies (co-op/hybrid): session owns the meshes; mirror into the scene.
          for (const e of session.enemies) {
            if (!e.mesh.parent) engine.scene.add(e.mesh)
          }
          for (const e of enemiesBefore) {
            if (!session.enemies.includes(e)) { engine.scene.remove(e.mesh); e.dispose() }
          }
        }

        // Render bots/other players (they exist in the session but have no mesh otherwise)
        if (remotePlayersRef.current) {
          remotePlayersRef.current.sync(snap.players)
          remotePlayersRef.current.update(dt)
        }
        if (isClient) {
          renderClientGrenades(snap.grenades)
          renderClientEnemies(snap.enemies)
        }

        // Host: broadcast the authoritative snapshot to all clients.
        if (net?.role === 'host' && net.netHost) {
          net.netHost.broadcastSnapshot(snap, events)
          pingAccumRef.current += dt
          if (pingAccumRef.current >= 1) { pingAccumRef.current = 0; net.netHost.pingClients() }
        }

        // Only update timers per-frame; event handlers own state/scores.
        // Host/solo only — the client's session.roundManager never ticks; its
        // roundState is seeded by the roundStart/buyPhaseStart events above.
        if (!isClient && session.roundManager) {
          setRoundState(prev => prev ? {
            ...prev,
            buyTimer: session.roundManager!.buyPhaseTimer,
            roundTimer: session.roundManager!.roundTimer,
          } : null)
        }

        // Scoreboard only updates when a kill/death/respawn event occurs
        if (scoreboardDirty) {
          setScoreboardPlayers(snap.players.map(p => ({
            id: p.id, kind: 'player', type: 'player',
            position: p.position, rotationY: p.rotationY, rotationX: p.rotationX,
            health: p.health, isDead: p.isDead, weaponType: p.weaponType,
            name: p.name, team: p.team, isBot: p.isBot,
            respawnIn: p.respawnIn, hasArmor: p.hasArmor, hasHelmet: p.hasHelmet,
          })))
        }

        // 5. Keep the (hidden) map centered on the player so vector tiles load.
        // Throttled: setCenter every frame keeps MapLibre permanently dirty, so it
        // re-renders its (fully occluded, invisible) vector map every frame — that
        // was the main GPU drain behind the ~2fps collapse. Tiles at zoom 17 cover
        // far more than 30 m, so recentering only after 30 m of movement is safe.
        const [lng, lat] = engine.localToLngLat(p.x, p.z)
        const lc = lastMapCenterRef.current
        if ((p.x - lc.x) * (p.x - lc.x) + (p.z - lc.z) * (p.z - lc.z) > 30 * 30) {
          lastMapCenterRef.current = { x: p.x, z: p.z }
          engine.map.setCenter([lng, lat])
        }

        // 6. Rebuild collision near the player; mirror the boxes into the visible scene.
        if (collisionRef.current) {
          session.collisionWorld = collisionRef.current.update(lng, lat)
        }

        // 6b. Rebuild scenery (roads, trees, green/water areas) when stale
        if (sceneryRef.current) {
          sceneryRef.current.update(lng, lat)
          const sv = sceneryRef.current.rebuildVersion
          if (sv !== lastSceneryVersionRef.current) {
            lastSceneryVersionRef.current = sv
            const { roads, treePositions, greenTriangles, waterTriangles, buildings, labels, lampPositions, benches } = sceneryRef.current.data
            engine.setRoads(roads)
            engine.setTrees(treePositions)
            engine.setGreenAreas(greenTriangles)
            engine.setWaterAreas(waterTriangles)
            engine.setBuildings(buildings)
            engine.setLabels(labels)
            engine.setStreetObjects(lampPositions, benches)
          }
        }

        // 6c. Update sun angle from current time-of-day
        engine.setSunAngle(sunSystemRef.current.compute(sunHourRef.current))

        // 7. Update HUD state
        const myHealth = isClient
          ? (net!.netClient!.latestSnapshot?.players.find(pl => pl.id === net!.netClient!.playerId)?.health ?? 100)
          : session.player.health
        setHudState({
          health: myHealth,
          maxHealth: session.player.maxHealth,
          ammo: session.weaponManager.current.ammo,
          maxAmmo: session.weaponManager.current.def.maxAmmo,
          weaponName: session.weaponManager.current.def.name,
          money: session.economy?.money ?? 0,
        })
        setBombHud({
          state: session.bomb.state,
          timer: session.bomb.timer,
          site: session.bomb.site,
          plant: session.bomb.plantProgress / 3,
          defuse: session.bomb.defuseProgress / session.bomb.defuseDuration,
        })

        // 9. Draw the FPS scene (lazily creates the WebGL canvas on first frame).
        engine.render()

        // 10. Shooting feedback: detect fired-this-frame (same pattern as App.tsx).
        // Client gun feel (fire/sound/ammo) already happened up in the branch above;
        // this only needs to fire the muzzle-flash particle once the camera is set.
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(engine.camera.quaternion)
        const weapon = session.weaponManager.current
        if (!isClient) {
          if (!session.player.isDead && input.shoot && weapon.fireTimer > weapon.def.fireRate - dt) {
            firedThisFrame = true
            viewmodel.fire()
            audioRef.current?.playWeaponShoot(weaponVisual(weapon.type), session.player.position)
            particleSystemRef.current?.muzzleFlash(session.player.position.clone().add(fwd), fwd)
          }
        } else if (firedThisFrame) {
          particleSystemRef.current?.muzzleFlash(p.clone().add(fwd), fwd)
        }

        // 11. Update audio listener position for 3D positional sound.
        if (audioRef.current) {
          audioRef.current.updateListenerPosition(p.x, p.y, p.z)
          audioRef.current.updateListenerOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0)
        }

        // 11b. Animate/expire particles (muzzle flash, tracers, impacts) — without this
        // they spawn once and never move or get removed ("stuck in air").
        particleSystemRef.current?.update(dt)

        // 11c. Fade damage direction indicator / flashbang blind over time
        damageStateRef.current = updateDamageIndicator(damageStateRef.current, dt)
        if (damageStateRef.current.active) setDamageIndicator({ ...damageStateRef.current })
        else setDamageIndicator(prev => (prev ? null : prev))
        flashStateRef.current = updateFlash(flashStateRef.current, dt)
        if (flashStateRef.current.active) setFlashEffect({ ...flashStateRef.current })
        else setFlashEffect(prev => (prev ? null : prev))

        // 12. Crosshair bloom: grow on fire/movement/jump, recover when still.
        // Client is non-authoritative for physics, so bloom is driven from input.
        const moving = isClient
          ? (input.forward || input.backward || input.left || input.right)
          : Math.hypot(session.player.velocity.x, session.player.velocity.z) > 1.5
        const airborne = isClient ? input.jump : !session.player.isGrounded
        setBloom(prev => stepBloom(prev, dt, {
          moving,
          airborne,
          shotsFired: firedThisFrame ? 1 : 0,
          weaponSpread: weapon.def.spread,
        }))

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
      particleSystemRef.current?.clear()
      remotePlayersRef.current?.clear()
      net?.onRemotePlayers?.(null)
      remotePlayersRef.current = null
      grenadeManagerRef.current = null
      viewmodelRef.current = null
      sceneryRef.current = null
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
        openScoreboard()
      } else if (e.code === 'Digit5') {
        if (net?.role === 'client' && net.netClient) {
          net.netClient.transport.send({ type: 'plantBomb', playerId: net.netClient.playerId! })
        } else if (sessionRef.current) {
          sessionRef.current.tryPlant(sessionRef.current.localId)
        }
      } else if (e.code === 'KeyE') {
        if (net?.role === 'client' && net.netClient) {
          net.netClient.transport.send({ type: 'defuseBomb', playerId: net.netClient.playerId!, hasKit: false })
        } else if (sessionRef.current) {
          sessionRef.current.tryDefuse(sessionRef.current.localId, false)
        }
      } else if (e.code === 'KeyQ') {
        if (sessionRef.current) {
          // Switching weapons puts a selected grenade away so left click fires again
          const gm = grenadeManagerRef.current
          if (gm?.selected) { gm.selected = null; setSelectedGrenade(null) }
          const wm = sessionRef.current.weaponManager
          wm.cycleNext()
          viewmodelRef.current?.setWeapon(weaponVisual(wm.current.type))
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        setShowScoreboard(false)
      }
    }
    // Left click throws a selected grenade (long) instead of firing; right click
    // throws short. Mirrors Controls.onMouseDown, which is gated to the 'playing'
    // game state and therefore inert in planetary mode.
    const throwSelectedGrenade = (mode: 'long' | 'short'): boolean => {
      const session = sessionRef.current
      const gm = grenadeManagerRef.current
      if (!session || !gm?.selected || session.player.isDead) return false
      const thrown = gm.selected
      if (net?.role === 'client' && net.netClient) {
        net.netClient.transport.send({ type: 'throwGrenade', playerId: net.netClient.playerId!, grenadeType: thrown, mode })
      } else if (!session.throwGrenade(session.localId, thrown, mode)) return false
      gm.remove(thrown)
      setGrenadeInventory({ he: gm.getCount('he'), flash: gm.getCount('flash'), smoke: gm.getCount('smoke') })
      if (!gm.has(thrown)) setSelectedGrenade(gm.selected)
      return true
    }
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        if (!throwSelectedGrenade('long')) mouseShootRef.current = true
      } else if (e.button === 2) {
        throwSelectedGrenade('short')
      }
    }
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
  }, [showPicker, openScoreboard])

  const handleTeleport = useCallback((lng: number, lat: number) => {
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
    <div
      style={{ position: 'absolute', inset: 0, filter: csMode ? 'saturate(0.7) contrast(1.1)' : 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
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
          money={hudState.money}
          bombState={bombHud.state}
          bombTimer={bombHud.timer}
          bombSite={bombHud.site ?? undefined}
          plantProgress={bombHud.plant}
          defuseProgress={bombHud.defuse}
          grenadeInventory={grenadeInventory}
          selectedGrenade={selectedGrenade}
          mobile={mobileControls}
        />
      )}
      {!showPicker && <DamageOverlay indicator={damageIndicator} />}
      {!showPicker && <FlashOverlay flash={flashEffect} />}

      {!showPicker && showBuyMenu && (
        <BuyMenu
          team="ct"
          money={hudState.money}
          owned={[]}
          grenadeInventory={grenadeInventory}
          onBuy={(itemId) => {
            const session = sessionRef.current
            if (!session || !session.economy) return
            const item = findItem(itemId)
            if (!item || !canAffordItem(session.economy.money, itemId)) return
            if (net?.role === 'client' && net.netClient) {
              net.netClient.transport.send({ type: 'buy', playerId: net.netClient.playerId!, item: itemId })
            }
            const grenadeKey = GRENADE_ITEM_KEY[itemId]
            if (grenadeKey) {
              // Grenades live in the client-side GrenadeManager, not applyItem
              const gm = grenadeManagerRef.current
              if (!gm || gm.getCount(grenadeKey) >= GRENADE_DEFS[grenadeKey].carryLimit) return
              session.economy.spendMoney(item.price)
              gm.add(grenadeKey)
              setGrenadeInventory({ he: gm.getCount('he'), flash: gm.getCount('flash'), smoke: gm.getCount('smoke') })
            } else {
              session.economy.spendMoney(item.price)
              applyItem(item, session.player, session.weaponManager)
              viewmodelRef.current?.setWeapon(weaponVisual(session.weaponManager.current.type))
            }
          }}
          onClose={() => setShowBuyMenu(false)}
        />
      )}

      {!showPicker && showScoreboard && (
        <Scoreboard
          players={scoreboardPlayers}
        />
      )}

      {!showPicker && !showBuyMenu && (() => {
        const gapScale = 1 + (bloom * BLOOM_PIXELS) / 20
        const hOff = 20 * gapScale  // horizontal line distance from center
        const vOff = 10 * gapScale  // vertical line distance from center
        const lineStyle: React.CSSProperties = { background: '#0f0', position: 'absolute' }
        return (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            pointerEvents: 'none', zIndex: 50,
          }}>
            <div style={{ ...lineStyle, width: 2, height: 14, left: -1, top: -vOff - 7 }} />
            <div style={{ ...lineStyle, width: 2, height: 14, left: -1, top: vOff - 7 }} />
            <div style={{ ...lineStyle, width: 14, height: 2, top: -1, left: -hOff - 7 }} />
            <div style={{ ...lineStyle, width: 14, height: 2, top: -1, left: hOff - 7 }} />
          </div>
        )
      })()}

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

      {/* Overlay buttons sit above TouchControls look pad (zIndex: 25).
          onPointerDown.stopPropagation prevents the full-screen look pad from
          eating touch events on mobile — without it, onClick never fires. */}
      {!showPicker && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 16, left: 16, zIndex: 100,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#fff', fontSize: 11, fontFamily: 'monospace' }}>
              ☀ {String(Math.floor(sunHour)).padStart(2, '0')}:{String(Math.round((sunHour % 1) * 60)).padStart(2, '0')}
            </span>
            <input
              type="range" min={0} max={24} step={0.1}
              value={sunHour}
              onChange={e => setSunHour(+e.target.value)}
              style={{ width: 100, accentColor: '#ffcc44' }}
            />
          </div>
          {!(net?.role === 'client') && (
            <div style={{ display: 'flex', gap: 4 }}>
              {(['ct', 't'] as const).map(team => (
                <button
                  key={team}
                  onClick={() => sessionRef.current?.addBot(team)}
                  style={{
                    padding: '4px 8px', background: 'rgba(0,0,0,0.6)', color: 'white',
                    border: '1px solid #555', borderRadius: 4, cursor: 'pointer',
                    fontSize: 11, fontFamily: 'monospace',
                  }}
                >
                  +{team.toUpperCase()} Bot
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!net && (
        <button
          onClick={() => setShowPicker(true)}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: showPicker ? 16 : 52, left: 16, padding: '6px 12px',
            background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
            borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
            zIndex: 100,
          }}
        >
          [M] Map
        </button>
      )}

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
          /* below the HUD money counter (top-right ~10px) so they don't overlap */
          position: 'absolute', top: 44, right: 16, padding: '6px 12px',
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
          onCycleWeapon={() => {
            if (!sessionRef.current) return
            const wm = sessionRef.current.weaponManager
            wm.cycleNext()
            viewmodelRef.current?.setWeapon(weaponVisual(wm.current.type))
          }}
          onToggleStore={() => setShowBuyMenu(prev => !prev)}
          onToggleScoreboard={() => (showScoreboard ? setShowScoreboard(false) : openScoreboard())}
          onSelectGrenade={(type) => {
            const gm = grenadeManagerRef.current
            if (gm?.select(type)) setSelectedGrenade(type)
          }}
          activeGrenade={selectedGrenade}
        />
      )}
    </div>
  )
}
