import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

const METERS_PER_DEG_LAT = 111320

/**
 * Convert lng/lat to Mercator meters (EPSG:3857).
 * MapLibre's 3D custom layer uses Mercator coordinates internally.
 */
function lngLatToMercator(lng: number, lat: number): [number, number] {
  const x = lng * METERS_PER_DEG_LAT * Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180)
  const y = lat * METERS_PER_DEG_LAT
  return [x, y]
}

/**
 * Convert Mercator meters back to lng/lat.
 */
function mercatorToLngLat(x: number, y: number): [number, number] {
  const lat = y / METERS_PER_DEG_LAT
  const lng = x / (METERS_PER_DEG_LAT * Math.cos((Math.min(Math.abs(lat), 89) * Math.PI) / 180))
  return [lng, lat]
}

export class PlanetaryEngine {
  map: maplibregl.Map
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  private threeRenderer: THREE.WebGLRenderer | null = null
  private readyCbs: (() => void)[] = []

  /** Mercator coordinates of the drop origin (startCenter). */
  private originMercator: [number, number] = [0, 0]

  constructor(container: HTMLElement, center: [number, number] = [0, 0]) {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10000)

    // Store the Mercator coordinates of the drop origin
    this.originMercator = lngLatToMercator(center[0], center[1])

    this.map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center,
      zoom: 17,
      pitch: 60,
    })

    this.map.on('load', () => {
      this.addGameObjectsLayer()
      this.readyCbs.forEach(cb => cb())
    })
  }

  onReady(cb: () => void) {
    this.readyCbs.push(cb)
  }

  /**
   * Position and orient the Three.js camera from the player's position and
   * look direction. The map center is already at the player each frame, so
   * the camera only needs the eye-height Y offset and the look rotation.
   *
   * @param playerPos  Mercator position of the player (map center).
   * @param yaw        Player yaw in radians (0 = north, clockwise +).
   * @param pitch      Player pitch in radians (positive = looking up).
   * @param mapBearing MapLibre bearing in radians (map rotation).
   */
  setViewFromPlayer(playerPos: THREE.Vector3, yaw: number, pitch: number, mapBearing: number) {
    this.camera.position.set(0, playerPos.y, 0)
    this.camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw + mapBearing, 0, 'YXZ'))
    this.camera.updateMatrixWorld(true)
  }

  /**
   * Convert local game-space coordinates (meters from drop point) to
   * Mercator world coordinates for placement in the Three.js scene.
   *
   * Game space: X = east, Z = south (Three.js convention).
   * Mercator: X = east, Y = north (we negate Z to get north).
   */
  localToMercator(localX: number, localZ: number, height = 0): THREE.Vector3 {
    return new THREE.Vector3(
      this.originMercator[0] + localX,
      height,
      this.originMercator[1] - localZ, // negate: game Z=south → Mercator Y=north
    )
  }

  /**
   * Convert Mercator world coordinates back to local game-space.
   */
  mercatorToLocal(mx: number, my: number): [number, number] {
    return [mx - this.originMercator[0], this.originMercator[1] - my]
  }

  /**
   * Convert a lng/lat to local game-space coordinates relative to origin.
   */
  lngLatToLocal(lng: number, lat: number): [number, number] {
    const [mx, my] = lngLatToMercator(lng, lat)
    return this.mercatorToLocal(mx, my)
  }

  /**
   * Convert local game-space coordinates to lng/lat.
   */
  localToLngLat(localX: number, localZ: number): [number, number] {
    const mx = this.originMercator[0] + localX
    const my = this.originMercator[1] - localZ
    return mercatorToLngLat(mx, my)
  }

  private addGameObjectsLayer() {
    this.map.addLayer({
      id: 'game-objects',
      type: 'custom',
      renderingMode: '3d',
      onAdd: (_map: maplibregl.Map, gl: WebGL2RenderingContext) => {
        this.threeRenderer = new THREE.WebGLRenderer({
          canvas: _map.getCanvas(),
          context: gl,
          antialias: true,
        })
        this.threeRenderer.autoClear = false
      },
      render: (_gl: WebGL2RenderingContext, matrix: number[]) => {
        // MapLibre provides the projection matrix (Mercator-to-clip).
        // The view is set externally via setViewFromPlayer().
        this.camera.projectionMatrix.fromArray(matrix)
        this.camera.updateMatrixWorld(true)
        this.threeRenderer?.resetState()
        this.threeRenderer?.render(this.scene, this.camera)
      },
    } as unknown as maplibregl.CustomLayerInterface)
  }

  dispose() {
    this.threeRenderer?.dispose()
    this.map.remove()
  }
}
