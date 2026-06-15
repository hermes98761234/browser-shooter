import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Enemy } from '../Enemy'
import { WaveManager } from '../WaveManager'
import { CollisionWorld } from '../../engine/CollisionWorld'

describe('Enemy', () => {
  it('initializes with correct stats', () => {
    const enemy = new Enemy('grunt', new THREE.Vector3(0, 0, 0))
    expect(enemy.type).toBe('grunt')
    expect(enemy.health).toBe(50)
    expect(enemy.isDead).toBe(false)
  })

  it('takes damage and dies', () => {
    const enemy = new Enemy('grunt', new THREE.Vector3(0, 0, 0))
    const killed = enemy.takeDamage(50)
    expect(killed).toBe(true)
    expect(enemy.isDead).toBe(true)
  })

  it('does not die from partial damage', () => {
    const enemy = new Enemy('tank', new THREE.Vector3(0, 0, 0))
    const killed = enemy.takeDamage(50)
    expect(killed).toBe(false)
    expect(enemy.health).toBe(100)
  })

  it('cannot take damage when dead', () => {
    const enemy = new Enemy('grunt', new THREE.Vector3(0, 0, 0))
    enemy.takeDamage(100)
    enemy.takeDamage(50)
    expect(enemy.health).toBe(0)
  })

  it('chases player when far away', () => {
    const enemy = new Enemy('grunt', new THREE.Vector3(0, 0, 0))
    const playerPos = new THREE.Vector3(10, 0, 0)
    enemy.update(0.1, playerPos)
    expect(enemy.mesh.position.x).toBeGreaterThan(0)
  })

  it('attacks when in range (melee)', () => {
    const enemy = new Enemy('grunt', new THREE.Vector3(1, 0, 0))
    const playerPos = new THREE.Vector3(1.5, 0, 0)
    enemy.attackTimer = 0.9
    const result = enemy.update(0.2, playerPos)
    expect(result).toEqual({ type: 'melee', damage: 10 })
  })

  it('ranged enemy fires when player is in range with clear line of sight', () => {
    const enemy = new Enemy('rifleman', new THREE.Vector3(0, 0, 0))
    const playerPos = new THREE.Vector3(10, 2, 0) // within fireRange 25
    // First call begins aiming; pass dt past telegraphTime so it fires.
    const result = enemy.update(0.6, playerPos)
    expect(result?.type).toBe('shoot')
  })

  it('ranged enemy holds fire when a wall blocks line of sight', () => {
    const enemy = new Enemy('rifleman', new THREE.Vector3(0, 0, 0))
    const playerPos = new THREE.Vector3(10, 2, 0)
    const world = new CollisionWorld()
    world.addBox(new THREE.Vector3(5, 1.5, 0), new THREE.Vector3(2, 3, 4)) // between them
    const result = enemy.update(0.6, playerPos, world)
    expect(result).toBeNull()
    expect(enemy.mesh.position.x).toBeGreaterThan(0) // advanced toward player instead
  })

  it('ranged enemy waits out the telegraph before firing', () => {
    const enemy = new Enemy('rifleman', new THREE.Vector3(0, 0, 0))
    const playerPos = new THREE.Vector3(10, 2, 0)
    const result = enemy.update(0.1, playerPos) // dt < telegraphTime 0.5
    expect(result).toBeNull()
  })
})

describe('WaveManager', () => {
  it('starts at wave 0', () => {
    const manager = new WaveManager()
    expect(manager.currentWave).toBe(0)
    expect(manager.waveActive).toBe(false)
  })

  it('increments wave on start', () => {
    const manager = new WaveManager()
    manager.startWave()
    expect(manager.currentWave).toBe(1)
    expect(manager.waveActive).toBe(true)
  })

  it('tracks enemies remaining', () => {
    const manager = new WaveManager()
    manager.startWave()
    expect(manager.enemiesRemaining).toBe(5)
    manager.onEnemyKilled()
    expect(manager.enemiesRemaining).toBe(4)
  })

  it('completes wave when all enemies killed', () => {
    const manager = new WaveManager()
    let waveCompleted = false
    manager.onWaveComplete = () => { waveCompleted = true }
    manager.startWave()
    manager.spawnQueue = []
    for (let i = 0; i < 5; i++) {
      manager.onEnemyKilled()
    }
    expect(waveCompleted).toBe(true)
    expect(manager.waveActive).toBe(false)
  })
})
