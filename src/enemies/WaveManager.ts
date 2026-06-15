import * as THREE from 'three'
import { Enemy } from './Enemy'
import { WaveDef } from '../types'

const WAVE_DEFS: WaveDef[] = [
  { number: 1, enemies: [{ type: 'grunt', count: 5 }], spawnDelay: 1 },
  { number: 2, enemies: [{ type: 'grunt', count: 8 }], spawnDelay: 0.8 },
  { number: 3, enemies: [{ type: 'grunt', count: 6 }, { type: 'runner', count: 3 }], spawnDelay: 0.7 },
  { number: 4, enemies: [{ type: 'runner', count: 6 }, { type: 'grunt', count: 4 }], spawnDelay: 0.6 },
  { number: 5, enemies: [{ type: 'tank', count: 2 }, { type: 'grunt', count: 6 }], spawnDelay: 0.5 },
]

export class WaveManager {
  currentWave: number = 0
  enemiesRemaining: number = 0
  spawnTimer: number = 0
  spawnQueue: string[] = []
  waveActive: boolean = false
  wavePauseTimer: number = 0
  onWaveComplete?: () => void
  onEnemySpawned?: (enemy: Enemy) => void

  private getWaveDef(wave: number): WaveDef {
    if (wave <= WAVE_DEFS.length) {
      return WAVE_DEFS[wave - 1]
    }
    const baseEnemies = WAVE_DEFS[WAVE_DEFS.length - 1]
    const scale = 1 + (wave - WAVE_DEFS.length) * 0.2
    return {
      number: wave,
      enemies: baseEnemies.enemies.map(e => ({
        type: e.type,
        count: Math.ceil(e.count * scale),
      })),
      spawnDelay: Math.max(0.2, baseEnemies.spawnDelay - (wave - WAVE_DEFS.length) * 0.05),
    }
  }

  startWave() {
    this.currentWave++
    const waveDef = this.getWaveDef(this.currentWave)
    this.spawnQueue = []
    for (const group of waveDef.enemies) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push(group.type)
      }
    }
    this.enemiesRemaining = this.spawnQueue.length
    this.spawnTimer = 0
    this.waveActive = true
  }

  update(dt: number, arenaSize: number): Enemy | null {
    if (!this.waveActive) {
      this.wavePauseTimer -= dt
      if (this.wavePauseTimer <= 0) {
        this.startWave()
      }
      return null
    }

    if (this.spawnQueue.length === 0) return null

    const waveDef = this.getWaveDef(this.currentWave)
    this.spawnTimer += dt

    if (this.spawnTimer >= waveDef.spawnDelay) {
      this.spawnTimer = 0
      const type = this.spawnQueue.pop()!
      const position = this.getRandomSpawnPosition(arenaSize)
      const enemy = new Enemy(type, position)
      this.onEnemySpawned?.(enemy)
      return enemy
    }

    return null
  }

  onEnemyKilled() {
    this.enemiesRemaining--
    if (this.enemiesRemaining <= 0 && this.spawnQueue.length === 0) {
      this.waveActive = false
      this.wavePauseTimer = 3
      this.onWaveComplete?.()
    }
  }

  private getRandomSpawnPosition(arenaSize: number): THREE.Vector3 {
    const edge = Math.floor(Math.random() * 4)
    const offset = (Math.random() - 0.5) * arenaSize * 1.6
    switch (edge) {
      case 0: return new THREE.Vector3(offset, 0, -arenaSize)
      case 1: return new THREE.Vector3(offset, 0, arenaSize)
      case 2: return new THREE.Vector3(-arenaSize, 0, offset)
      case 3: return new THREE.Vector3(arenaSize, 0, offset)
      default: return new THREE.Vector3(0, 0, 0)
    }
  }
}
