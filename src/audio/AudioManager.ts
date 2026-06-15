export class AudioManager {
  private context: AudioContext | null = null
  private muted: boolean = false
  private sounds: Map<string, AudioBuffer> = new Map()

  init() {
    this.context = new AudioContext()
  }

  toggleMute() {
    this.muted = !this.muted
    return this.muted
  }

  isMuted() {
    return this.muted
  }

  playTone(frequency: number, duration: number, type: OscillatorType = 'square', volume: number = 0.3) {
    if (this.muted || !this.context) return
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, this.context.currentTime)
    gain.gain.setValueAtTime(volume, this.context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration)
    osc.connect(gain)
    gain.connect(this.context.destination)
    osc.start()
    osc.stop(this.context.currentTime + duration)
  }

  playShoot(type: string) {
    switch (type) {
      case 'pistol':
        this.playTone(800, 0.1, 'square', 0.2)
        this.playTone(200, 0.15, 'sawtooth', 0.1)
        break
      case 'shotgun':
        this.playTone(200, 0.2, 'sawtooth', 0.3)
        this.playTone(100, 0.3, 'square', 0.2)
        break
      case 'rifle':
        this.playTone(600, 0.05, 'square', 0.15)
        this.playTone(300, 0.1, 'sawtooth', 0.1)
        break
    }
  }

  playHit() {
    this.playTone(400, 0.1, 'sine', 0.2)
  }

  playEnemyDeath() {
    this.playTone(300, 0.2, 'sawtooth', 0.2)
    this.playTone(100, 0.3, 'square', 0.1)
  }

  playPlayerHit() {
    this.playTone(200, 0.2, 'sine', 0.3)
  }

  playPickup() {
    this.playTone(800, 0.1, 'sine', 0.2)
    this.playTone(1200, 0.1, 'sine', 0.2)
  }

  playWaveStart() {
    this.playTone(400, 0.15, 'sine', 0.2)
    setTimeout(() => this.playTone(600, 0.15, 'sine', 0.2), 150)
    setTimeout(() => this.playTone(800, 0.2, 'sine', 0.2), 300)
  }
}
