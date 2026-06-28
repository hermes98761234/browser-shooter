import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'
import type { BoxCollider } from '../engine/CollisionWorld'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const METERS_PER_DEG_LAT = 111320

function lngLatToMercator(lng: number, lat: number): [number, number] {
  const x = lng * METERS_PER_DEG_LAT * Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180)
  const y = lat * METERS_PER_DEG_LAT
  return [x, y]
}

function mercatorToLngLat(x: number, y: number): [number, number] {
  const lat = y / METERS_PER_DEG_LAT
  const lng = x / (METERS_PER_DEG_LAT * Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180))
  return [lng, lat]
}

export class PlanetaryEngine {
  map: maplibregl.Map
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer | null = null
  private buildings = new THREE.Group()
  private buildingMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.9, metalness: 0 })
  private readyCbs: (() => void)[] = []
  private originMercator: [number, number] = [0, 0]

  constructor(private container: HTMLElement, center: [number, number] = [0, 0]) {
    this.originMercator = lngLatToMercator(center[0], center[1])

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x9ec7e8) // daytime sky
    this.scene.fog = new THREE.Fog(0x9ec7e8, 120, 600)

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000)

    // Lights: soft ambient + sun.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(100, 200, 50)
    this.scene.add(sun)

    // Ground plane (large, lies at y=0 like the building bottoms).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: 0x5b6b4a, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    this.scene.add(ground)
    this.scene.add(this.buildings)

    this.map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center,
      zoom: 17,
      pitch: 0,
    })
    this.map.on('load', () => {
      this.readyCbs.forEach(cb => cb())
    })
  }

  onReady(cb: () => void) {
    this.readyCbs.push(cb)
  }

  /** Position/orient the FPS camera. playerPos is the eye position (Player.EYE_HEIGHT baked in). */
  setViewFromPlayer(playerPos: THREE.Vector3, yaw: number, pitch: number) {
    this.camera.position.copy(playerPos)
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ')
  }

  /** Rebuild visible building meshes from the collision boxes (origin-relative meters). */
  setBuildings(boxes: BoxCollider[]) {
    this.disposeBuildings()
    for (const b of boxes) {
      const sx = b.max.x - b.min.x
      const sy = b.max.y - b.min.y
      const sz = b.max.z - b.min.z
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), this.buildingMat)
      mesh.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
      this.buildings.add(mesh)
    }
  }

  private disposeBuildings() {
    for (const m of this.buildings.children) {
      if (m instanceof THREE.Mesh) m.geometry.dispose()
    }
    this.buildings.clear()
  }

  /** Lazily create the WebGL renderer on first frame (kept out of constructor for jsdom tests). */
  render() {
    if (!this.renderer) {
      const r = new THREE.WebGLRenderer({ antialias: true })
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      const canvas = r.domElement
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      this.container.appendChild(canvas)
      this.renderer = r
    }
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    const size = this.renderer.getSize(new THREE.Vector2())
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
    this.renderer.render(this.scene, this.camera)
  }

  localToMercator(localX: number, localZ: number, height = 0): THREE.Vector3 {
    return new THREE.Vector3(this.originMercator[0] + localX, height, this.originMercator[1] - localZ)
  }

  mercatorToLocal(mx: number, my: number): [number, number] {
    return [mx - this.originMercator[0], this.originMercator[1] - my]
  }

  lngLatToLocal(lng: number, lat: number): [number, number] {
    const [mx, my] = lngLatToMercator(lng, lat)
    return this.mercatorToLocal(mx, my)
  }

  localToLngLat(localX: number, localZ: number): [number, number] {
    const mx = this.originMercator[0] + localX
    const my = this.originMercator[1] - localZ
    return mercatorToLngLat(mx, my)
  }

  dispose() {
    this.disposeBuildings()
    this.renderer?.domElement.remove()
    this.renderer?.dispose()
    this.map.remove()
  }
}
