import * as THREE from 'three'
import { Player } from '../player/Player'
import { WeaponManager } from '../weapons/WeaponManager'
import { BotController } from '../bots/BotController'
import { BOT_NAMES, botDisplayName } from '../bots/botNames'
import { Enemy } from '../enemies/Enemy'
import { WaveManager } from '../enemies/WaveManager'
import { Pickup } from '../systems/Pickup'
import { ScoreSystem } from '../systems/ScoreSystem'
import type { CollisionWorld } from '../engine/CollisionWorld'
import { emptyInput, type PlayerInput, type Snapshot, type SessionEvent, type EntityState } from './protocol'
import type { Vec3, Team } from '../types'
import { zonedDamage, resolveZone } from '../systems/DamageZones'
import { type MatchConfig, defaultMatchConfig, canDamage } from './MatchConfig'
import { RoundManager, RoundState } from './RoundManager'
import { Economy } from './Economy'
import { Scoreboard } from './Scoreboard'
import { RespawnQueue } from './RespawnQueue'
import { pickSpawn } from './Spawns'
import { raycastPlayerCapsule } from './PlayerHit'
import type { HitZone } from '../systems/DamageZones'
import { Bombsite } from './Bombsite'
import { BombCarrier, BombState } from './BombCarrier'
import type { MapDef } from '../maps/MapDef'
import { getMap } from '../maps/registry'
import { Grenade } from '../weapons/Grenade'
import { GRENADE_DEFS, calcHeDamage, calcFlashBlindDuration } from '../weapons/GrenadeDefs'
import { SmokeCloud } from '../effects/SmokeCloud'

export const ARENA_SIZE = 30
const LOCAL_ID = 'local'
export const RESPAWN_DELAY = 3 // seconds
/** Hard ceiling on AI bots per session — each one is iterated every tick. */
export const MAX_BOTS = 20

function toVec3(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z }
}

export interface PlayerEntity {
  id: string
  name: string
  team: Team
  player: Player
  weapons: WeaponManager
  isBot?: boolean
}

export class GameSession {
  readonly localId = LOCAL_ID
  private playerMap = new Map<string, PlayerEntity>()
  enemies: Enemy[] = []
  waveManager = new WaveManager()
  scoreSystem = new ScoreSystem()
  pickups: Pickup[] = []
  collisionWorld: CollisionWorld | null = null
  tick = 0

  config: MatchConfig
  map: MapDef
  scoreboard: Scoreboard
  respawnQueue = new RespawnQueue()
  roundManager: RoundManager | null = null
  economy: Economy | null = null
  bombsites: Bombsite[] = []
  bomb: BombCarrier = new BombCarrier()
  activeGrenades: Grenade[] = []
  smokeClouds: SmokeCloud[] = []

  private shootRaycaster = new THREE.Raycaster()
  private cameraQuat = new THREE.Quaternion()
  private inputs = new Map<string, PlayerInput>()
  private bots = new Map<string, BotController>()
  private nextBotNum = 0
  private usedBotNames = new Set<string>()

  constructor(config: MatchConfig = defaultMatchConfig()) {
    this.config = config
    this.map = getMap(config.mapId)
    this.scoreboard = new Scoreboard(config.fragLimit)
    this.addPlayer(LOCAL_ID, 'You', 'ct')

    if (config.mode === 'competitive') {
      this.roundManager = new RoundManager()
      this.economy = new Economy(800)
      this.bombsites = this.map.bombsites.map(
        (b) => new Bombsite(b.id, { x: b.center[0], y: 0, z: b.center[1] })
      )
    }
  }

  addPlayer(id: string, name: string, team: Team = 'ct', isBot = false): PlayerEntity {
    const index = this.playerMap.size // 0 = host/local, kept at origin
    const entity: PlayerEntity = { id, name, team, player: new Player(), weapons: new WeaponManager(), isBot }
    entity.player.position.copy(this.spawnPosition(index))
    this.playerMap.set(id, entity)
    this.inputs.set(id, emptyInput())
    return entity
  }

  /** Host/local at origin; joining players evenly placed on a ring so models never stack. */
  private spawnPosition(index: number): THREE.Vector3 {
    if (index === 0) return new THREE.Vector3(0, 2, 0)
    const angle = (index - 1) * (Math.PI / 4) // 45 degrees apart
    const r = ARENA_SIZE / 3
    return new THREE.Vector3(Math.cos(angle) * r, 2, Math.sin(angle) * r)
  }

  removePlayer(id: string): void {
    this.playerMap.delete(id)
    this.inputs.delete(id)
  }

  /** Spawn an AI bot on `team` with a rifle and a CS-style name.
   *  Returns null once {@link MAX_BOTS} are already registered. */
  addBot(team: Team): PlayerEntity | null {
    if (this.bots.size >= MAX_BOTS) return null
    const id = `bot-${this.nextBotNum++}`
    const entity = this.addPlayer(id, botDisplayName(this.nextBotName()), team, true)
    this.giveBotLoadout(entity)
    this.bots.set(id, new BotController(id))
    return entity
  }

  /** Bots never visit the buy menu, so hand them a standing rifle loadout.
   *  Used on spawn and after any competitive weapon reset so bots stay armed. */
  private giveBotLoadout(entity: PlayerEntity): void {
    entity.weapons.equip('rifle', 'primary')
  }

  /** Remove a bot (defaults to the most recently added). */
  removeBot(id?: string): void {
    const targetId = id ?? [...this.bots.keys()].pop()
    if (!targetId || !this.bots.has(targetId)) return
    const entity = this.getPlayer(targetId)
    if (entity) this.usedBotNames.delete(entity.name.replace(/^BOT /, ''))
    this.bots.delete(targetId)
    this.removePlayer(targetId)
  }

  private nextBotName(): string {
    for (const n of BOT_NAMES) {
      if (!this.usedBotNames.has(n)) { this.usedBotNames.add(n); return n }
    }
    return `#${this.nextBotNum}`
  }

  getPlayer(id: string): PlayerEntity | undefined {
    return this.playerMap.get(id)
  }

  playerIds(): string[] {
    return [...this.playerMap.keys()]
  }

  /** Backward-compatible accessors for the local player (single-player code paths). */
  get player(): Player {
    return this.playerMap.get(LOCAL_ID)!.player
  }

  get weaponManager(): WeaponManager {
    return this.playerMap.get(LOCAL_ID)!.weapons
  }

  applyInput(playerId: string, input: PlayerInput): void {
    this.inputs.set(playerId, input)
  }

  getInput(playerId: string): PlayerInput {
    return this.inputs.get(playerId) ?? emptyInput()
  }

  handleDeath(playerId: string): void {
    if (this.config.mode === 'competitive') {
      const entity = this.playerMap.get(playerId)
      if (entity) {
        entity.weapons.reset()
        if (entity.isBot) this.giveBotLoadout(entity)
      }
      // If the bomb carrier dies, drop the bomb at their position
      if (this.bomb.carrier === playerId) {
        const pos = entity ? toVec3(entity.player.position) : this.bomb.position
        if (pos) this.bomb.drop(pos)
      }
    }
  }

  /**
   * Common bookkeeping when a player dies to another player (non-coop): score the
   * kill/death, award the attacker's economy in competitive, queue a respawn in
   * respawn modes, and surface match end. Mirrors the bullet-kill path so grenade
   * kills behave consistently. `attacker` is null/self for suicides.
   */
  private registerPlayerKill(
    victim: PlayerEntity, attacker: PlayerEntity | null, weaponType: string, events: SessionEvent[],
  ): void {
    if (this.config.mode === 'coop') return
    const isKillCredit = !!attacker && attacker.id !== victim.id
    if (isKillCredit) {
      this.scoreboard.recordKill(attacker!.id, attacker!.team, victim.id, victim.team, this.config.damagePolicy)
    } else {
      this.scoreboard.recordDeath(victim.id)
    }
    // Competitive: no mid-round respawn — players revive at the next round start.
    if (this.config.mode !== 'competitive') this.respawnQueue.enqueue(victim.id, RESPAWN_DELAY)
    if (isKillCredit && this.config.mode === 'competitive' && this.economy) {
      this.economy.recordKillReward(weaponType)
      events.push({ type: 'moneyUpdate', playerId: attacker!.id, amount: this.economy.money })
    }
    if (this.scoreboard.matchOver) events.push({ type: 'matchOver', winningTeam: this.scoreboard.winningTeam! })
  }

  /** Determine round winner when the timer expires (no bomb explosion/defuse). */
  private resolveRoundWinner(): 'ct' | 't' | 'draw' {
    // If bomb was planted but not yet exploded/defused when time runs out, T wins
    if (this.bomb.state === BombState.Planted || this.bomb.state === BombState.Defusing) {
      return 't'
    }
    // Otherwise CT wins on time
    return 'ct'
  }

  /** Settle the round: score it, award economy, then either end the match or set up the next round. */
  private concludeRound(winner: 'ct' | 't' | 'draw', reason: string, events: SessionEvent[]): void {
    const rm = this.roundManager!
    rm.endRound(winner)
    events.push({ type: 'roundEnd', winner, reason, ctScore: rm.ctScore, tScore: rm.tScore })
    if (rm.isHalftime) {
      events.push({ type: 'halftime', ctScore: rm.ctScore, tScore: rm.tScore })
    }
    if (this.economy) {
      if (winner === 'ct') this.economy.recordWin()
      else if (winner === 't') this.economy.recordLoss()
      // draw: no economy change
      if (rm.isHalftime) this.economy.reset(800)
      events.push({ type: 'moneyUpdate', playerId: this.localId, amount: this.economy.money })
    }
    if (rm.matchOver) {
      events.push({ type: 'matchOver', winningTeam: rm.winner as Team })
      return
    }
    // Next round: reset the bomb (reassigned when the round goes active) and respawn everyone
    // with a fresh loadout at their team spawn.
    this.bomb.reset()
    for (const entity of this.playerMap.values()) {
      entity.player.revive()
      entity.player.position.copy(pickSpawn(entity.team, this.map))
      if (this.config.mode === 'competitive') {
        entity.weapons.reset()
        if (entity.isBot) this.giveBotLoadout(entity)
      }
    }
    events.push({ type: 'roundStart', round: rm.round, money: this.economy?.money ?? 800, ctScore: rm.ctScore, tScore: rm.tScore })
    events.push({ type: 'buyPhaseStart', duration: rm.buyPhaseTimer })
  }

  assignBomb(): void {
    for (const entity of this.playerMap.values()) {
      if (entity.team === 't') {
        this.bomb.assign(entity.id)
        return
      }
    }
  }

  /** T carrier requests a plant. Succeeds only if alive, carrying, and inside a bombsite. */
  tryPlant(playerId: string): boolean {
    if (this.config.mode !== 'competitive') return false
    const entity = this.playerMap.get(playerId)
    if (!entity || entity.player.isDead) return false
    if (this.bomb.state !== BombState.Carried || this.bomb.carrier !== playerId) return false
    const pos = toVec3(entity.player.position)
    const site = this.bombsites.find((s) => s.isInside(pos))
    if (!site) return false
    this.bomb.startPlant(site.id)
    return true
  }

  /** CT requests a defuse. Succeeds only if alive, CT, and standing on the planted site. */
  tryDefuse(playerId: string, hasKit: boolean): boolean {
    if (this.config.mode !== 'competitive') return false
    const entity = this.playerMap.get(playerId)
    if (!entity || entity.player.isDead || entity.team !== 'ct') return false
    if (this.bomb.state !== BombState.Planted) return false
    const site = this.bombsites.find((s) => s.id === this.bomb.site)
    if (!site || !site.isInside(toVec3(entity.player.position))) return false
    this.bomb.startDefuse(hasKit, playerId)
    return true
  }

  /** True if `playerId` is alive, on `team`, and still standing on the bomb's site. */
  private canContinueAt(playerId: string | null, team: Team): boolean {
    if (!playerId) return false
    const entity = this.playerMap.get(playerId)
    if (!entity || entity.player.isDead || entity.team !== team) return false
    const site = this.bombsites.find((s) => s.id === this.bomb.site)
    return !!site && site.isInside(toVec3(entity.player.position))
  }

  throwGrenade(playerId: string, type: 'he' | 'flash' | 'smoke', mode: 'long' | 'short'): boolean {
    const entity = this.playerMap.get(playerId)
    if (!entity || entity.player.isDead) return false

    const def = GRENADE_DEFS[type]
    const speed = mode === 'long' ? def.longThrowSpeed : def.shortThrowSpeed

    const cameraQuat = new THREE.Quaternion().setFromEuler(entity.player.rotation)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuat)
    const velocity = forward.multiplyScalar(speed)
    if (mode === 'short') velocity.y = 3

    const position = entity.player.position.clone().add(forward.clone().multiplyScalar(0.5))
    const grenade = new Grenade(type, { x: position.x, y: position.y, z: position.z },
      { x: velocity.x, y: velocity.y, z: velocity.z }, undefined, playerId)

    this.activeGrenades.push(grenade)
    return true
  }

  private detonateGrenade(grenade: Grenade, pos: Vec3, events: SessionEvent[]): void {
    const position = new THREE.Vector3(pos.x, pos.y, pos.z)
    const affectedPlayers: string[] = []
    const blindDurations: Record<string, number> = {}

    if (grenade.type === 'he') {
      const thrower = this.playerMap.get(grenade.thrownBy) ?? null
      for (const entity of this.playerMap.values()) {
        if (entity.player.isDead) continue
        // Respect the match's damage policy like bullets do; a thrower always
        // takes damage from their own grenade.
        const isSelf = entity.id === grenade.thrownBy
        if (!isSelf && thrower && !canDamage(thrower.team, entity.team, this.config.damagePolicy)) continue
        const dist = entity.player.position.distanceTo(position)
        if (dist <= grenade.def.effectRadius) {
          const damage = calcHeDamage(dist)
          if (damage <= 0) continue
          entity.player.takeDamage(damage)
          affectedPlayers.push(entity.id)
          if (entity.player.isDead) {
            events.push({ type: 'playerDied', playerId: entity.id })
            const wasCarrier = this.bomb.carrier === entity.id
            this.handleDeath(entity.id)
            if (wasCarrier && this.bomb.state === BombState.Dropped) {
              events.push({ type: 'bombDropped', position: this.bomb.position!, playerId: entity.id })
            }
            this.registerPlayerKill(entity, thrower, grenade.type, events)
          }
        }
      }
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue
        const dist = enemy.mesh.position.distanceTo(position)
        if (dist <= grenade.def.effectRadius) {
          const damage = calcHeDamage(dist)
          enemy.takeDamage(damage)
          if (enemy.isDead) {
            this.scoreSystem.addKill(enemy.def.scoreValue)
            this.waveManager.onEnemyKilled()
            events.push({ type: 'enemyKilled', enemyType: enemy.type, pos: toVec3(enemy.mesh.position), scoreValue: enemy.def.scoreValue })
          }
        }
      }
    } else if (grenade.type === 'flash') {
      for (const entity of this.playerMap.values()) {
        if (entity.player.isDead) continue
        const dist = entity.player.position.distanceTo(position)
        if (dist <= grenade.def.effectRadius) {
          const dirToGrenade = position.clone().sub(entity.player.position).normalize()
          const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(entity.player.rotation)
          const dot = dirToGrenade.dot(lookDir)
          if (dot > 0) {
            const duration = calcFlashBlindDuration(dist)
            if (duration > 0) {
              blindDurations[entity.id] = duration
              affectedPlayers.push(entity.id)
            }
          }
        }
      }
    } else if (grenade.type === 'smoke') {
      const smoke = new SmokeCloud(position)
      this.smokeClouds.push(smoke)
    }

    events.push({
      type: 'grenadeDetonated',
      id: grenade.id,
      position: pos,
      grenadeType: grenade.type,
      affectedPlayers,
      blindDurations: grenade.type === 'flash' ? blindDurations : undefined,
    })
  }

  nearestPlayer(point: THREE.Vector3): PlayerEntity | null {
    let best: PlayerEntity | null = null
    let bestDist = Infinity
    for (const entity of this.playerMap.values()) {
      if (entity.player.isDead) continue
      const d = entity.player.position.distanceToSquared(point)
      if (d < bestDist) { bestDist = d; best = entity }
    }
    return best
  }

  getSnapshot(): Snapshot {
    const players: EntityState[] = [...this.playerMap.values()].map((e) => ({
      id: e.id,
      kind: 'player',
      type: 'player',
      position: toVec3(e.player.position),
      rotationY: e.player.rotation.y,
      rotationX: e.player.rotation.x,
      health: e.player.health,
      isDead: e.player.isDead,
      weaponType: e.weapons.current.type,
      name: e.name,
      team: e.team,
      isBot: e.isBot,
      respawnIn: this.respawnQueue.isPending(e.id) ? this.respawnQueue.remaining(e.id) : undefined,
      hasArmor: e.player.hasArmor ?? false,
      hasHelmet: e.player.hasHelmet ?? false,
    }))
    const enemies: EntityState[] = this.enemies.map((e) => ({
      id: e.id,
      kind: 'enemy',
      type: e.type,
      position: toVec3(e.mesh.position),
      rotationY: e.mesh.rotation.y,
      health: e.health,
      isDead: e.isDead,
    }))
    return {
      tick: this.tick, seq: 0, ack: {}, players, enemies,
      grenades: this.activeGrenades.map(g => ({
        id: g.id,
        type: g.type,
        position: { x: g.position.x, y: g.position.y, z: g.position.z },
        velocity: { x: g.velocity.x, y: g.velocity.y, z: g.velocity.z },
        rotation: { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z },
        bounces: g.bounces,
        fuseTimer: g.fuseTimer,
        thrownBy: g.thrownBy,
      })),
      events: [],
      scores: this.scoreboard.snapshot(),
      round: this.roundManager?.round,
      roundTimer: this.roundManager?.roundTimer,
      buyPhase: this.roundManager?.buyPhase,
      buyPhaseTimer: this.roundManager?.buyPhaseTimer,
      ctScore: this.roundManager?.ctScore,
      tScore: this.roundManager?.tScore,
      bomb: {
        state: this.bomb.state,
        carrier: this.bomb.carrier ?? undefined,
        position: this.bomb.position ?? undefined,
        site: this.bomb.site ?? undefined,
        timer: this.bomb.timer,
        plantProgress: this.bomb.plantProgress,
        defuseProgress: this.bomb.defuseProgress,
        defuseDuration: this.bomb.defuseDuration,
      },
    }
  }

  step(dt: number): SessionEvent[] {
    const events: SessionEvent[] = []
    this.tick++

    if (this.roundManager) {
      const prevState = this.roundManager.state
      // Once the bomb is planted, freeze the round timer — only the bomb's fuse
      // (explosion → T win) or a defuse (→ CT win) can end the round from here.
      const bombActive =
        this.bomb.state === BombState.Planted || this.bomb.state === BombState.Defusing
      this.roundManager.update(dt, bombActive)
      // Hand the bomb to a T player when the round goes live.
      if (prevState === RoundState.Buying && this.roundManager.state === RoundState.Active && this.bomb.state === BombState.None) {
        this.assignBomb()
      }
      // Round timer expired with no plant/defuse result.
      if (this.roundManager.state === RoundState.Over && !this.roundManager.matchOver) {
        const winner = this.resolveRoundWinner()
        this.concludeRound(winner, winner === 't' ? 'bomb' : 'time', events)
      }
      // Bomb exploded mid-round → T wins.
      if (this.bomb.state === BombState.Exploded && this.roundManager.state === RoundState.Active && !this.roundManager.matchOver) {
        this.concludeRound('t', 'bomb', events)
      }
      // Bomb defused → CT wins.
      if (this.bomb.state === BombState.Defused && this.roundManager.state === RoundState.Active && !this.roundManager.matchOver) {
        this.concludeRound('ct', 'defuse', events)
      }
    }

    // Respawn any players whose timer elapsed.
    for (const id of this.respawnQueue.update(dt)) {
      const entity = this.playerMap.get(id)
      if (!entity) continue
      entity.player.position.copy(pickSpawn(entity.team, this.map))
      entity.player.revive()
      events.push({ type: 'playerRespawned', playerId: id })
    }
    // Drive bots: each bot's AI produces this tick's input before players advance.
    if (this.bots.size > 0) {
      const all = [...this.playerMap.values()]
      for (const [id, controller] of this.bots) {
        const self = this.playerMap.get(id)
        if (!self) continue
        this.applyInput(id, controller.computeInput(self, all, this.collisionWorld, dt))
      }
    }

    // Advance every player: look, movement+collision, weapons, shooting.
    for (const entity of this.playerMap.values()) {
      const input = this.getInput(entity.id)
      const player = entity.player
      if (player.isDead) {
        // Dead players cannot rotate, move, or shoot.
        continue
      }
      player.rotation.y = input.yaw
      player.rotation.x = THREE.MathUtils.clamp(input.pitch, -Math.PI / 2, Math.PI / 2)
      player.update(dt, input, ARENA_SIZE, this.collisionWorld ?? undefined)

      entity.weapons.update(dt)
      if (input.shoot && entity.weapons.current.canShoot()) {
        entity.weapons.current.shoot()
        this.fireWeapon(entity, events)
      }
    }

    // Waves + enemies (enemy AI targets the nearest living player).
    this.waveManager.update(dt, ARENA_SIZE)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      const target = this.nearestPlayer(enemy.mesh.position)
      if (!target) break
      const targetPlayer = target.player
      const action = enemy.update(dt, targetPlayer.position, this.collisionWorld ?? undefined)

      if (enemy.isDead) {
        if (enemy.deathTimer <= 0) this.enemies.splice(i, 1) // App removes/disposes the mesh
        continue
      }

      if (enemy.telegraphCue) {
        events.push({
          type: 'enemyTelegraph',
          enemyPos: toVec3(enemy.mesh.position),
          facing: toVec3(new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.mesh.quaternion)),
        })
      }

      if (action) {
        if (action.type === 'shoot') {
          if (action.hit) targetPlayer.takeDamage(action.damage)
          events.push({
            type: 'enemyShoot',
            from: toVec3(action.from),
            to: action.hit ? toVec3(targetPlayer.position) : toVec3(action.to),
            hit: action.hit,
            damage: action.damage,
            victimId: target.id,
          })
        } else {
          targetPlayer.takeDamage(action.damage)
          events.push({ type: 'enemyMelee', damage: action.damage, enemyPos: toVec3(enemy.mesh.position), victimId: target.id })
        }
        if (targetPlayer.isDead) {
          events.push({ type: 'playerDied', playerId: target.id })
          const wasCarrier = this.bomb.carrier === target.id
          this.handleDeath(target.id)
          if (wasCarrier && this.bomb.state === BombState.Dropped) {
            events.push({ type: 'bombDropped', position: this.bomb.position!, playerId: target.id })
          }
          if (this.config.mode === 'coop') {
            if (target.id === this.localId) return events
          } else {
            this.scoreboard.recordDeath(target.id)
            // Competitive: no mid-round respawn — players revive at the next round start.
            if (this.config.mode !== 'competitive') this.respawnQueue.enqueue(target.id, RESPAWN_DELAY)
          }
        }
      }
    }

    // Pickups — update once, then check all players.
    for (const pickup of this.pickups) {
      pickup.update(dt, this.tick * dt)
    }
    for (const entity of this.playerMap.values()) {
      const player = entity.player
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pickup = this.pickups[i]
        if (pickup.checkCollision(player.position)) {
          if (pickup.type === 'health') player.heal(pickup.value)
          else entity.weapons.addAmmo(entity.weapons.current.type, pickup.value)
          events.push({ type: 'pickup', pickupType: pickup.type, value: pickup.value, playerId: entity.id })
          this.pickups.splice(i, 1)
          break
        }
      }
    }

    // Update active grenades
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const grenade = this.activeGrenades[i]
      grenade.update(dt, this.collisionWorld ?? undefined)

      if (grenade.isExpired()) {
        const pos = grenade.detonate()
        this.detonateGrenade(grenade, pos, events)
        this.activeGrenades.splice(i, 1)
        grenade.dispose()
      }
    }

    // Update smoke clouds
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      this.smokeClouds[i].update(dt)
      if (this.smokeClouds[i].isExpired()) {
        this.smokeClouds[i].dispose()
        this.smokeClouds.splice(i, 1)
      }
    }

    // Auto-pickup: a living T player walking over a dropped bomb grabs it.
    if (this.bomb.state === BombState.Dropped && this.bomb.position) {
      const bp = new THREE.Vector3(this.bomb.position.x, this.bomb.position.y, this.bomb.position.z)
      for (const entity of this.playerMap.values()) {
        if (entity.team !== 't' || entity.player.isDead) continue
        if (entity.player.position.distanceToSquared(bp) <= 4) { // within 2 units
          this.bomb.pickup(entity.id)
          events.push({ type: 'bombPickedUp', playerId: entity.id })
          break
        }
      }
    }

    // A plant/defuse only progresses while the actor is alive and still standing on
    // the site. If they die or walk off mid-action, interrupt it (CS-style) instead
    // of letting it auto-complete. Death also drops the bomb (handled above), so by
    // here a dead planter has usually already flipped the bomb to Dropped.
    if (this.bomb.state === BombState.Planting && !this.canContinueAt(this.bomb.carrier, 't')) {
      this.bomb.cancelPlant()
    }
    if (this.bomb.state === BombState.Defusing && !this.canContinueAt(this.bomb.defuser, 'ct')) {
      this.bomb.cancelDefuse()
    }

    // Update bomb state
    if (this.bomb.state === BombState.Planting ||
        this.bomb.state === BombState.Planted ||
        this.bomb.state === BombState.Defusing) {
      const wasPlanting = this.bomb.state === BombState.Planting
      this.bomb.update(dt)
      const afterState = this.bomb.state as BombState

      if (wasPlanting && afterState === BombState.Planted) {
        events.push({ type: 'bombPlanted', site: this.bomb.site!, planterId: this.bomb.carrier ?? 'unknown', timer: this.bomb.timer })
        if (this.config.mode === 'competitive' && this.economy) {
          this.economy.recordBombPlant()
          events.push({ type: 'moneyUpdate', playerId: this.localId, amount: this.economy.money })
        }
      }
      if (afterState === BombState.Exploded) {
        events.push({ type: 'bombExploded', site: this.bomb.site! })
      }
      if (afterState === BombState.Defused) {
        events.push({ type: 'bombDefused', site: this.bomb.site! })
      }
    }

    return events
  }

  private fireWeapon(entity: PlayerEntity, events: SessionEvent[]): void {
    const weapon = entity.weapons.current
    this.cameraQuat.setFromEuler(entity.player.rotation)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraQuat)
    const pellets = weapon.type === 'shotgun' ? 6 : 1
    for (let p = 0; p < pellets; p++) {
      const dir = weapon.getSpreadDirection(forward)
      this.resolveShot(entity, entity.player.position, dir, weapon.def.range, weapon.def.damage, events)
    }
  }

  private resolveShot(shooter: PlayerEntity, origin: THREE.Vector3, direction: THREE.Vector3, range: number, baseDamage: number, events: SessionEvent[]): void {
    this.shootRaycaster.set(origin, direction)
    this.shootRaycaster.far = range

    let nearestEnemy: Enemy | null = null
    let enemyDist = Infinity
    let enemyObj: THREE.Object3D | null = null
    let enemyPoint: THREE.Vector3 | null = null
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue
      enemy.mesh.updateMatrixWorld(true)
      const hits = this.shootRaycaster.intersectObject(enemy.mesh, true)
      if (hits.length > 0 && hits[0].distance < enemyDist) {
        enemyDist = hits[0].distance; nearestEnemy = enemy; enemyObj = hits[0].object; enemyPoint = hits[0].point
      }
    }

    const playerHit = this.config.mode === 'coop' ? null : this.resolvePlayerHit(shooter, origin, direction, range)

    const wallDist = this.collisionWorld
      ? this.collisionWorld.segmentBlocked(origin, origin.clone().addScaledVector(direction, range))
      : null

    const enemyValid = !!(nearestEnemy && enemyPoint && (wallDist === null || enemyDist < wallDist))
    const playerValid = !!(playerHit && (wallDist === null || playerHit.distance < wallDist))

    if (playerValid && (!enemyValid || playerHit!.distance <= enemyDist)) {
      const zone = playerHit!.zone
      const damage = zonedDamage(baseDamage, zone)
      const target = playerHit!.entity
      const killed = target.player.takeDamage(damage)
      events.push({ type: 'playerHitPlayer', victimId: target.id, hit: { targetId: target.id, zone, damage, killed, point: playerHit!.point } })
      if (killed) {
        this.scoreboard.recordKill(shooter.id, shooter.team, target.id, target.team, this.config.damagePolicy)
        // Competitive: no mid-round respawn — players revive at the next round start.
        if (this.config.mode !== 'competitive') this.respawnQueue.enqueue(target.id, RESPAWN_DELAY)
        events.push({ type: 'playerKilledPlayer', attackerId: shooter.id, victimId: target.id, victimTeam: target.team, teamkill: this.config.damagePolicy === 'friendly' && shooter.team === target.team })
        events.push({ type: 'playerDied', playerId: target.id })
        const wasCarrier = this.bomb.carrier === target.id
        this.handleDeath(target.id)
        if (wasCarrier && this.bomb.state === BombState.Dropped) {
          events.push({ type: 'bombDropped', position: this.bomb.position!, playerId: target.id })
        }
        if (this.config.mode === 'competitive' && this.economy) {
          this.economy.recordKillReward(shooter.weapons.current.type)
          events.push({ type: 'moneyUpdate', playerId: shooter.id, amount: this.economy.money })
        }
        if (this.scoreboard.matchOver) events.push({ type: 'matchOver', winningTeam: this.scoreboard.winningTeam! })
      }
      return
    }

    if (enemyValid) {
      const zone = resolveZone(enemyObj)
      const damage = zonedDamage(baseDamage, zone)
      const killed = nearestEnemy!.takeDamage(damage)
      events.push({
        type: 'playerHitEnemy',
        enemyType: nearestEnemy!.type,
        hit: { targetId: nearestEnemy!.type, zone, damage, killed, point: toVec3(enemyPoint!) },
      })
      if (killed) {
        this.scoreSystem.addKill(nearestEnemy!.def.scoreValue)
        this.waveManager.onEnemyKilled()
        events.push({ type: 'enemyKilled', enemyType: nearestEnemy!.type, pos: toVec3(nearestEnemy!.mesh.position), scoreValue: nearestEnemy!.def.scoreValue })
      }
      return
    }

    if (wallDist !== null) {
      events.push({ type: 'wallImpact', point: toVec3(origin.clone().addScaledVector(direction, wallDist)) })
    }
  }

  /** Nearest living, damageable other player along the ray (M2 lag-comp seam). */
  private resolvePlayerHit(
    shooter: PlayerEntity, origin: THREE.Vector3, direction: THREE.Vector3, range: number,
  ): { entity: PlayerEntity; distance: number; point: Vec3; zone: HitZone } | null {
    let best: { entity: PlayerEntity; distance: number; point: Vec3; zone: HitZone } | null = null
    let bestDist = Infinity
    for (const entity of this.playerMap.values()) {
      if (entity.id === shooter.id || entity.player.isDead) continue
      if (!canDamage(shooter.team, entity.team, this.config.damagePolicy)) continue
      const hit = raycastPlayerCapsule(origin, direction, range, entity.player.position)
      if (hit && hit.distance < bestDist) {
        bestDist = hit.distance
        best = { entity, distance: hit.distance, point: hit.point, zone: hit.zone }
      }
    }
    return best
  }
}
