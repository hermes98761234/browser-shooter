import type maplibregl from 'maplibre-gl'
import { offsetLngLat } from './geoUtils'

const MOUSE_SENSITIVITY = 0.3  // degrees per pixel
const MOVE_SPEED = 8           // meters per second
const PITCH_MIN = 0
const PITCH_MAX = 85

export class GeoControls {
  private keys = new Set<string>()
  private bearing: number
  private pitch: number
  private attached = false

  constructor(
    private map: Pick<maplibregl.Map, 'getCenter' | 'setCenter' | 'setBearing' | 'setPitch' | 'getBearing' | 'getPitch'>,
    private container: HTMLElement,
  ) {
    this.bearing = (map.getBearing as () => number)()
    this.pitch = (map.getPitch as () => number)()
  }

  attach() {
    if (this.attached) return
    this.attached = true
    this.container.addEventListener('keydown', this.onKeyDown)
    this.container.addEventListener('keyup', this.onKeyUp)
    this.container.addEventListener('mousemove', this.onMouseMove)
  }

  detach() {
    if (!this.attached) return
    this.attached = false
    this.container.removeEventListener('keydown', this.onKeyDown)
    this.container.removeEventListener('keyup', this.onKeyUp)
    this.container.removeEventListener('mousemove', this.onMouseMove)
    this.keys.clear()
  }

  getBearing(): number { return this.bearing }
  getPitch(): number { return this.pitch }

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code)
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code)

  private onMouseMove = (e: MouseEvent) => {
    const movementX = e.movementX ?? 0
    const movementY = e.movementY ?? 0
    this.bearing = ((this.bearing + movementX * MOUSE_SENSITIVITY) + 360) % 360
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch - movementY * MOUSE_SENSITIVITY))
    this.map.setBearing(this.bearing)
    this.map.setPitch(this.pitch)
  }

  update(dt: number) {
    let dx = 0, dz = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dz -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dz += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1
    if (dx === 0 && dz === 0) return

    const speed = MOVE_SPEED * dt
    const bearingRad = (this.bearing * Math.PI) / 180
    const east = (dx * Math.cos(bearingRad) - dz * Math.sin(bearingRad)) * speed
    const north = (-dz * Math.cos(bearingRad) - dx * Math.sin(bearingRad)) * speed

    const center = this.map.getCenter()
    const [lng, lat] = offsetLngLat(center.lng, center.lat, east, north)
    this.map.setCenter([lng, lat])
  }
}
