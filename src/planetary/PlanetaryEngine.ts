import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export class PlanetaryEngine {
  map: maplibregl.Map
  scene: THREE.Scene
  camera: THREE.Camera
  private threeRenderer: THREE.WebGLRenderer | null = null
  private readyCbs: (() => void)[] = []

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()

    this.map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center: [0, 0],
      zoom: 17,
      pitch: 60,
      antialias: true,
    })

    this.map.on('load', () => {
      this.addGameObjectsLayer()
      this.readyCbs.forEach(cb => cb())
    })
  }

  onReady(cb: () => void) {
    this.readyCbs.push(cb)
  }

  private addGameObjectsLayer() {
    const self = this
    this.map.addLayer({
      id: 'game-objects',
      type: 'custom',
      renderingMode: '3d',
      onAdd(_map: maplibregl.Map, gl: WebGL2RenderingContext) {
        self.threeRenderer = new THREE.WebGLRenderer({
          canvas: _map.getCanvas(),
          context: gl,
          antialias: true,
        })
        self.threeRenderer.autoClear = false
      },
      render(_gl: WebGL2RenderingContext, matrix: number[]) {
        self.camera.projectionMatrix.fromArray(matrix)
        self.threeRenderer?.resetState()
        self.threeRenderer?.render(self.scene, self.camera)
        self.map.triggerRepaint()
      },
    } as maplibregl.CustomLayerInterface)
  }

  dispose() {
    this.threeRenderer?.dispose()
    this.map.remove()
  }
}
