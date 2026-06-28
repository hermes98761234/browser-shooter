import { emptyInput, type PlayerInput } from '../session/protocol'

const MOUSE_SENSITIVITY = 0.002 // radians per pixel (matches multiplayer onMouseMove)
const PITCH_MIN = -Math.PI / 2 + 0.01
const PITCH_MAX = Math.PI / 2 - 0.01

/**
 * FPS-style input for Planetary Mode. WASD for movement, mouse for look.
 * Does NOT modify the MapLibre camera — that is driven by the Three.js camera.
 */
export class GeoControls {
  yaw: number = 0
  pitch: number = 0
  private keys = new Set<string>()
  private attached = false

  constructor(private container: HTMLElement) {}

  attach(): void {
    if (this.attached) return
    this.attached = true
    this.container.addEventListener('keydown', this.onKeyDown)
    this.container.addEventListener('keyup', this.onKeyUp)
    this.container.addEventListener('mousemove', this.onMouseMove)
  }

  detach(): void {
    if (!this.attached) return
    this.attached = false
    this.container.removeEventListener('keydown', this.onKeyDown)
    this.container.removeEventListener('keyup', this.onKeyUp)
    this.container.removeEventListener('mousemove', this.onMouseMove)
    this.keys.clear()
  }

  /** Initialize look direction from current player rotation */
  setLook(yaw: number, pitch: number): void {
    this.yaw = yaw
    this.pitch = pitch
  }

  getInput(): PlayerInput {
    return {
      ...emptyInput(),
      forward: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      backward: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
      jump: this.keys.has('Space'),
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => { this.keys.add(e.code) }
  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.code) }

  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement !== this.container) return
    this.yaw -= e.movementX * MOUSE_SENSITIVITY
    this.pitch -= e.movementY * MOUSE_SENSITIVITY
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch))
  }
}
