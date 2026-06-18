import * as THREE from 'three'
import { Player } from '../player/Player'
import { WeaponManager } from '../weapons/WeaponManager'
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

export const ARENA_SIZE = 30
const LOCAL_ID = 'local'
export const RESPAWN_DELAY = 3 // seconds

function toVec3(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z }
}

export interface PlayerEntity {
  id: string
  name: string
  team: Team
  player: Player
  weapons: WeaponManager
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
  scoreboard: Scoreboard
  respawnQueue = new RespawnQueue()
  roundManager: RoundManager | null = null
  economy: Economy | null = null
  bombsites: Bombsite[] = []
  bomb: BombCarrier = new BombCarrier()

  private shootRaycaster = new THREE.Raycaster()
  private cameraQuat = new THREE.Quaternion()
  private inputs = new Map<string, PlayerInput>()

  constructor(config: MatchConfig = defaultMatchConfig()) {
    this.config = config
    this.scoreboard = new Scoreboard(config.fragLimit)
    this.addPlayer(LOCAL_ID, 'You', 'ct')

    if (config.mode === 'competitive') {
      this.roundManager = new RoundManager()
      this.economy = new Economy(800)
      this.bombsites = [
        new Bombsite('A', { x: 0, y: 0, z: -25 }),
        new Bombsite('B', { x: 0, y: 0, z: 25 }),
      ]
    }
  }

  addPlayer(id: string, name: string, team: Team = 'ct'): PlayerEntity {
    const index = this.playerMap.size // 0 = host/local, kept at origin
    const entity: PlayerEntity = { id, name, team, player: new Player(), weapons: new WeaponManager() }
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
      }
    }
  }

  assignBomb(): void {
    for (const entity of this.playerMap.values()) {
      if (entity.team === 't') {
        this.bomb.assign(entity.id)
        return
      }
    }
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
      respawnIn: this.respawnQueue.isPending(e.id) ? this.respawnQueue.remaining(e.id) : undefined,
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
      tick: this.tick, seq: 0, ack: {}, players, enemies, events: [],
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
      },
    }
  }

  step(dt: number): SessionEvent[] {
    const events: SessionEvent[] = []
    this.tick++

    if (this.roundManager) {
      this.roundManager.update(dt)
      if (this.roundManager.state === RoundState.Over) {
        events.push({ type: 'roundEnd', winner: 'ct', reason: 'time', ctScore: this.roundManager.ctScore, tScore: this.roundManager.tScore })
      }
    }

    // Respawn any players whose timer elapsed.
    for (const id of this.respawnQueue.update(dt)) {
      const entity = this.playerMap.get(id)
      if (!entity) continue
      entity.player.position.copy(pickSpawn(entity.team))
      entity.player.revive()
      events.push({ type: 'playerRespawned', playerId: id })
    }
    // Advance every player: look, movement+collision, weapons, shooting.
    for (const entity of this.playerMap.values()) {
      const input = this.getInput(entity.id)
      const player = entity.player
      player.rotation.y = input.yaw
      player.rotation.x = THREE.MathUtils.clamp(input.pitch, -Math.PI / 2, Math.PI / 2)
      player.update(dt, input, ARENA_SIZE)
      if (this.collisionWorld) this.collisionWorld.resolve(player.position, 0.5)

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
          if (this.config.mode === 'coop') {
            if (target.id === this.localId) return events
          } else {
            this.scoreboard.recordDeath(target.id)
            this.respawnQueue.enqueue(target.id, RESPAWN_DELAY)
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

    // Update bomb state
    if (this.bomb.state === BombState.Planting ||
        this.bomb.state === BombState.Planted ||
        this.bomb.state === BombState.Defusing) {
      const wasPlanting = this.bomb.state === BombState.Planting
      this.bomb.update(dt)
      const afterState = this.bomb.state as BombState

      if (wasPlanting && afterState === BombState.Planted) {
        events.push({ type: 'bombPlanted', site: this.bomb.site! })
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
        this.respawnQueue.enqueue(target.id, RESPAWN_DELAY)
        events.push({ type: 'playerKilledPlayer', attackerId: shooter.id, victimId: target.id, victimTeam: target.team, teamkill: this.config.damagePolicy === 'friendly' && shooter.team === target.team })
        events.push({ type: 'playerDied', playerId: target.id })
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
