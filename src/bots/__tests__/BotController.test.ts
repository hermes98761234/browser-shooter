import { describe, it, expect, vi, afterEach } from 'vitest'
import * as THREE from 'three'
import { BotController } from '../BotController'
import { Player } from '../../player/Player'
import { WeaponManager } from '../../weapons/WeaponManager'
import type { PlayerEntity } from '../../session/GameSession'
import type { CollisionWorld } from '../../engine/CollisionWorld'

function entity(id: string, team: 'ct' | 't', pos: THREE.Vector3): PlayerEntity {
  const player = new Player()
  player.position.copy(pos)
  const weapons = new WeaponManager()
  weapons.equip('rifle', 'primary')
  return { id, name: id, team, player, weapons }
}

// Reconstruct the forward vector the session will derive from yaw/pitch.
function forwardOf(yaw: number, pitch: number): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))
}

describe('BotController', () => {
  afterEach(() => vi.restoreAllMocks())

  it('aims at the nearest enemy-team player and ignores allies', () => {
    const bot = entity('bot-0', 't', new THREE.Vector3(0, 2, 0))
    const ally = entity('ally', 't', new THREE.Vector3(0, 2, -3))
    const farEnemy = entity('far', 'ct', new THREE.Vector3(0, 2, -40))
    const nearEnemy = entity('near', 'ct', new THREE.Vector3(5, 2, 0))
    const ctrl = new BotController('bot-0')
    const input = ctrl.computeInput(bot, [ally, farEnemy, nearEnemy], null, 0.016)
    const dirToNear = new THREE.Vector3(5, 0, 0).normalize()
    expect(forwardOf(input.yaw, input.pitch).dot(dirToNear)).toBeGreaterThan(0.99)
  })

  it('fires only after the reaction delay when target is in range with line of sight', () => {
    const bot = entity('bot-0', 't', new THREE.Vector3(0, 2, 0))
    const enemy = entity('e', 'ct', new THREE.Vector3(0, 2, -10))
    const ctrl = new BotController('bot-0')
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // kill aim jitter
    const first = ctrl.computeInput(bot, [enemy], null, 0.1)
    expect(first.shoot).toBe(false)            // still inside reaction window
    let last = first
    for (let i = 0; i < 5; i++) last = ctrl.computeInput(bot, [enemy], null, 0.1)
    expect(last.shoot).toBe(true)              // reaction delay elapsed
  })

  it('holds fire without line of sight', () => {
    const bot = entity('bot-0', 't', new THREE.Vector3(0, 2, 0))
    const enemy = entity('e', 'ct', new THREE.Vector3(0, 2, -10))
    const blocked = { segmentBlocked: () => 4 } as unknown as CollisionWorld
    const ctrl = new BotController('bot-0')
    let input = ctrl.computeInput(bot, [enemy], blocked, 0.1)
    for (let i = 0; i < 10; i++) input = ctrl.computeInput(bot, [enemy], blocked, 0.1)
    expect(input.shoot).toBe(false)
  })

  it('idles (no shoot, no movement) when there is no enemy', () => {
    const bot = entity('bot-0', 't', new THREE.Vector3(0, 2, 0))
    const ally = entity('ally', 't', new THREE.Vector3(0, 2, -3))
    const ctrl = new BotController('bot-0')
    const input = ctrl.computeInput(bot, [ally], null, 0.1)
    expect(input.shoot).toBe(false)
    expect(input.forward).toBe(false)
    expect(input.backward).toBe(false)
  })
})
