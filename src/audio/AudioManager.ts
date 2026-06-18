export type SoundName =
  | 'pistol' | 'shotgun' | 'rifle'
  | 'enemy_hit' | 'enemy_death'
  | 'player_hit' | 'player_death'
  | 'pickup' | 'wave_start'
  | 'weapon_reload' | 'bullet_impact' | 'weapon_fire'

interface SoundEntry {
  buffer: AudioBuffer
  baseVolume: number
}

export class AudioManager {
  private context: AudioContext | null = null
  private sounds: Map<string, SoundEntry> = new Map()
  private muted: boolean = false
  private listenerPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
  private readonly soundFiles: Record<SoundName, string> = {
    pistol: 'sounds/pistol.mp3',
    shotgun: 'sounds/shotgun.mp3',
    rifle: 'sounds/rifle.mp3',
    enemy_hit: 'sounds/enemy_hit.mp3',
    enemy_death: 'sounds/enemy_death.mp3',
    player_hit: 'sounds/player_hit.mp3',
    player_death: 'sounds/player_death.mp3',
    pickup: 'sounds/pickup.mp3',
    wave_start: 'sounds/wave_start.mp3',
    weapon_reload: 'sounds/weapon_reload.mp3',
    bullet_impact: 'sounds/bullet_impact.mp3',
    weapon_fire: 'sounds/weapon_fire.mp3',
  }

  async init() {
    this.context = new AudioContext()
    // Resume context if suspended (browser autoplay policy)
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }
    // Set listener orientation
    const listener = this.context.listener
    if (listener.positionX) {
      listener.positionX.value = this.listenerPosition.x
      listener.positionY.value = this.listenerPosition.y
      listener.positionZ.value = this.listenerPosition.z
    } else {
      listener.setPosition(this.listenerPosition.x, this.listenerPosition.y, this.listenerPosition.z)
    }
  }

  async loadSounds() {
    if (!this.context) return
    const baseUrl = import.meta.env.BASE_URL || ''
    const loads = (Object.entries(this.soundFiles) as [SoundName, string][]).map(async ([name, file]) => {
      try {
        const response = await fetch(baseUrl + file)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer)
        this.sounds.set(name, { buffer: audioBuffer, baseVolume: 0.5 })
      } catch {
        // Sound file not found — will fall back to synthesized tones
        console.warn(`AudioManager: could not load ${file}, using synthesized fallback`)
      }
    })
    await Promise.all(loads)
  }

  setListenerPosition(x: number, y: number, z: number) {
    this.listenerPosition = { x, y, z }
    if (!this.context) return
    const listener = this.context.listener
    if (listener.positionX) {
      listener.positionX.value = x
      listener.positionY.value = y
      listener.positionZ.value = z
    } else {
      listener.setPosition(x, y, z)
    }
  }

  setListenerOrientation(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) {
    if (!this.context) return
    const listener = this.context.listener
    if (listener.forwardX) {
      listener.forwardX.value = fx
      listener.forwardY.value = fy
      listener.forwardZ.value = fz
      listener.upX.value = ux
      listener.upY.value = uy
      listener.upZ.value = uz
    } else {
      listener.setOrientation(fx, fy, fz, ux, uy, uz)
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    return this.muted
  }

  isMuted(): boolean {
    return this.muted
  }

  setMuted(value: boolean) {
    this.muted = value
  }

  play(name: SoundName, options?: {
    volume?: number
    pitchVariation?: number
    position?: { x: number; y: number; z: number }
    loop?: boolean
  }): AudioBufferSourceNode | null {
    if (this.muted || !this.context) return null

    const entry = this.sounds.get(name)
    if (entry) {
      return this.playBuffer(entry, options)
    }

    // Fall back to synthesized tones for missing files
    this.playSynthesized(name, options)
    return null
  }

  private playBuffer(
    entry: SoundEntry,
    options?: {
      volume?: number
      pitchVariation?: number
      position?: { x: number; y: number; z: number }
      loop?: boolean
    }
  ): AudioBufferSourceNode {
    if (!this.context) throw new Error('AudioContext not initialized')

    const source = this.context.createBufferSource()
    source.buffer = entry.buffer
    source.loop = options?.loop ?? false

    // Pitch variation (±semitones converted to playback rate)
    const pitchVar = options?.pitchVariation ?? 0
    if (pitchVar > 0) {
      source.playbackRate.value = 1 + (Math.random() - 0.5) * pitchVar
    }

    // Volume
    const gainNode = this.context.createGain()
    const volume = (options?.volume ?? 1) * entry.baseVolume
    gainNode.gain.setValueAtTime(volume, this.context.currentTime)

    // Spatial audio
    if (options?.position) {
      const panner = this.context.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 50
      panner.rolloffFactor = 1
      if (options.position instanceof Object) {
        if (panner.positionX) {
          panner.positionX.value = options.position.x
          panner.positionY.value = options.position.y
          panner.positionZ.value = options.position.z
        } else {
          panner.setPosition(options.position.x, options.position.y, options.position.z)
        }
      }
      source.connect(panner)
      panner.connect(gainNode)
    } else {
      source.connect(gainNode)
    }

    gainNode.connect(this.context.destination)
    source.start()
    return source
  }

  private playSynthesized(
    name: SoundName,
    options?: { volume?: number; position?: { x: number; y: number; z: number } }
  ) {
    if (!this.context || this.muted) return

    const volume = options?.volume ?? 0.3
    const ctx = this.context

    switch (name) {
      case 'pistol': {
        this.createTone(ctx, 800, 0.1, 'square', volume, 0, options?.position)
        this.createTone(ctx, 200, 0.15, 'sawtooth', volume * 0.5, 0, options?.position)
        break
      }
      case 'shotgun': {
        this.createTone(ctx, 200, 0.2, 'sawtooth', volume, 0, options?.position)
        this.createTone(ctx, 100, 0.3, 'square', volume * 0.6, 0, options?.position)
        break
      }
      case 'rifle': {
        this.createTone(ctx, 600, 0.05, 'square', volume * 0.75, 0, options?.position)
        this.createTone(ctx, 300, 0.1, 'sawtooth', volume * 0.5, 0, options?.position)
        break
      }
      case 'player_hit': {
        this.createTone(ctx, 200, 0.2, 'sine', volume, 0, options?.position)
        break
      }
      case 'player_death': {
        this.createTone(ctx, 300, 0.3, 'sawtooth', volume, 0, options?.position)
        this.createTone(ctx, 150, 0.5, 'square', volume * 0.6, 100, options?.position)
        break
      }
      case 'enemy_hit':
      case 'enemy_death': {
        this.createTone(ctx, 400, 0.1, 'sine', volume, 0, options?.position)
        break
      }
      case 'pickup': {
        this.createTone(ctx, 800, 0.1, 'sine', volume, 0, options?.position)
        this.createTone(ctx, 1200, 0.1, 'sine', volume, 80, options?.position)
        break
      }
      case 'wave_start': {
        this.createTone(ctx, 400, 0.15, 'sine', volume, 0, options?.position)
        this.createTone(ctx, 600, 0.15, 'sine', volume, 150, options?.position)
        this.createTone(ctx, 800, 0.2, 'sine', volume, 300, options?.position)
        break
      }
    }
  }

  private createTone(
    ctx: AudioContext,
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delayMs: number = 0,
    position?: { x: number; y: number; z: number }
  ) {
    const startTime = ctx.currentTime + delayMs / 1000
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, startTime)
    gain.gain.setValueAtTime(volume, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

    if (position) {
      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 50
      panner.rolloffFactor = 1
      if (panner.positionX) {
        panner.positionX.value = position.x
        panner.positionY.value = position.y
        panner.positionZ.value = position.z
      } else {
        panner.setPosition(position.x, position.y, position.z)
      }
      osc.connect(panner)
      panner.connect(gain)
    } else {
      osc.connect(gain)
    }

    gain.connect(ctx.destination)
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  get loadedCount(): number {
    return this.sounds.size
  }

  get totalCount(): number {
    return Object.keys(this.soundFiles).length
  }
}
