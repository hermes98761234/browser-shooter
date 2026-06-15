import * as THREE from 'three'
import { Player } from '../player/Player'
import { WeaponManager } from '../weapons/WeaponManager'
import { Enemy } from '../enemies/Enemy'
import { WaveManager } from '../enemies/WaveManager'
import { Pickup } from '../systems/Pickup'
import { ScoreSystem } from '../systems/ScoreSystem'
import type { CollisionWorld } from '../engine/CollisionWorld'
import { emptyInput, type PlayerInput, type Snapshot, type SessionEvent, type EntityState } from './protocol'
import type { Vec3 } from '../types'

export const ARENA_SIZE = 30
const LOCAL_ID = 'local'

function toVec3(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z }
}

export class GameSession {
  readonly localId = LOCAL_ID
  player = new Player()
  weaponManager = new WeaponManager()
  enemies: Enemy[] = []
  waveManager = new WaveManager()
  scoreSystem = new ScoreSystem()
  pickups: Pickup[] = []
  collisionWorld: CollisionWorld | null = null
  tick = 0

  private inputs = new Map<string, PlayerInput>([[LOCAL_ID, emptyInput()]])

  applyInput(playerId: string, input: PlayerInput): void {
    this.inputs.set(playerId, input)
  }

  getInput(playerId: string): PlayerInput {
    return this.inputs.get(playerId) ?? emptyInput()
  }

  getSnapshot(): Snapshot {
    const players: EntityState[] = [{
      id: LOCAL_ID,
      kind: 'player',
      type: 'player',
      position: toVec3(this.player.position),
      rotationY: this.player.rotation.y,
      health: this.player.health,
      isDead: this.player.isDead,
    }]
    const enemies: EntityState[] = this.enemies.map((e, i) => ({
      id: `enemy-${i}`,
      kind: 'enemy',
      type: e.type,
      position: toVec3(e.mesh.position),
      rotationY: e.mesh.rotation.y,
      health: e.health,
      isDead: e.isDead,
    }))
    return { tick: this.tick, players, enemies }
  }

  // step(dt) added in later tasks.
  step(_dt: number): SessionEvent[] {
    return []
  }
}
