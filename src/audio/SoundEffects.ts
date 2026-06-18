import { AudioManager, type SoundName } from './AudioManager'

/**
 * SoundEffects - High-level sound trigger layer.
 * Provides semantic methods for game events so the rest of the codebase
 * doesn't need to know about AudioManager internals or SoundName values.
 */
export class SoundEffects {
  constructor(private audio: AudioManager) {}

  init() {
    return this.audio.init()
  }

  loadSounds() {
    return this.audio.loadSounds()
  }

  updateListenerPosition(x: number, y: number, z: number) {
    this.audio.setListenerPosition(x, y, z)
  }

  updateListenerOrientation(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) {
    this.audio.setListenerOrientation(fx, fy, fz, ux, uy, uz)
  }

  toggleMute(): boolean {
    return this.audio.toggleMute()
  }

  isMuted(): boolean {
    return this.audio.isMuted()
  }

  setMuted(value: boolean) {
    this.audio.setMuted(value)
  }

  // Weapon sounds
  playWeaponShoot(weaponType: string, position?: { x: number; y: number; z: number }) {
    const name = this.mapWeaponSound(weaponType)
    if (name) {
      this.audio.play(name, {
        volume: 0.5,
        pitchVariation: 0.15,
        position,
      })
    }
  }

  private mapWeaponSound(weaponType: string): SoundName | null {
    switch (weaponType) {
      case 'pistol':  return 'pistol'
      case 'usp':     return 'pistol'
      case 'glock':   return 'pistol'
      case 'deagle':  return 'pistol'
      case 'shotgun': return 'shotgun'
      case 'm4':      return 'rifle'
      case 'aug':     return 'rifle'
      case 'ak':      return 'rifle'
      case 'galil':   return 'rifle'
      case 'mp5':     return 'rifle'
      case 'awp':     return 'rifle'
      case 'rifle':   return 'rifle'
      default:        return null
    }
  }

  // Enemy sounds
  playEnemyHit(position?: { x: number; y: number; z: number }) {
    this.audio.play('enemy_hit', {
      volume: 0.4,
      pitchVariation: 0.2,
      position,
    })
  }

  playEnemyDeath(position?: { x: number; y: number; z: number }) {
    this.audio.play('enemy_death', {
      volume: 0.5,
      pitchVariation: 0.15,
      position,
    })
  }

  // Player sounds
  playPlayerHit() {
    this.audio.play('player_hit', { volume: 0.6 })
  }

  playPlayerDeath() {
    this.audio.play('player_death', { volume: 0.7 })
  }

  // Pickup / collection
  playPickup() {
    this.audio.play('pickup', { volume: 0.4 })
  }

  // Wave / round
  playWaveStart() {
    this.audio.play('wave_start', { volume: 0.5 })
  }

  // Grenade sounds
  playGrenadeThrow(position?: { x: number; y: number; z: number }) {
    this.audio.play('weapon_reload', {
      volume: 0.5,
      position,
    })
  }

  playGrenadeBounce(position: { x: number; y: number; z: number }) {
    this.audio.play('bullet_impact', {
      volume: 0.3,
      position,
    })
  }

  playGrenadeDetonate(type: 'he' | 'flash' | 'smoke', position: { x: number; y: number; z: number }) {
    if (type === 'he') {
      this.audio.play('enemy_death', { volume: 1.5, position })
    } else if (type === 'flash') {
      this.audio.play('weapon_fire', { volume: 0.8, position })
    } else {
      this.audio.play('weapon_reload', { volume: 0.5, position })
    }
  }
}
