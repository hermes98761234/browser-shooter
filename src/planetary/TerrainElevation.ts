import * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

/** Map interface — only the methods we need, matching PlanetaryEngine's usage */
interface TerrainMap {
  addSource(id: string, source: Record<string, unknown>): void
  setTerrain(options: { source: string; exaggeration: number }): void
  queryTerrainElevation?(coords: { lng: number; lat: number }): number | null
}

export class TerrainElevation {
  private mesh: THREE.Mesh | null = null
  private lastSamplePos: THREE.Vector3 | null = null
  private fallbackMode = false

  constructor(
    private map: TerrainMap,
    private toLocal: (lng: number, lat: number) => [number, number],
    private toLngLat: (x: number, z: number) => [number, number],
  ) {}

  get terrainMesh(): THREE.Mesh | null { return this.mesh }
  get active(): boolean { return !this.fallbackMode }

  async init(): Promise<void> {
    try {
      this.map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.png?key=get_your_key'],
        tileSize: 256,
        maxzoom: 14,
      })
      this.map.setTerrain({ source: 'terrain-dem', exaggeration: 1 })
    } catch {
      console.warn('TerrainElevation: DEM source unavailable — using flat terrain')
      this.fallbackMode = true
    }
  }

  getHeight(x: number, z: number): number {
    if (this.fallbackMode) return 0
    try {
      const [lng, lat] = this.toLngLat(x, z)
      const elev = this.map.queryTerrainElevation?.({ lng, lat })
      return elev ?? 0
    } catch {
      return 0
    }
  }

  update(playerPos: THREE.Vector3): void {
    if (this.fallbackMode) return

    const REFRESH_DIST = PLANETARY_CONFIG.terrain.refreshDistance
    if (this.lastSamplePos && playerPos.distanceTo(this.lastSamplePos) < REFRESH_DIST) return
    this.lastSamplePos = playerPos.clone()

    const GRID_RES = PLANETARY_CONFIG.terrain.gridResolution
    const GRID_RADIUS = PLANETARY_CONFIG.terrain.gridRadius
    const gridHalf = Math.floor(GRID_RADIUS / GRID_RES)
    const segW = gridHalf * 2
    const segH = gridHalf * 2

    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (let iz = 0; iz <= segH; iz++) {
      for (let ix = 0; ix <= segW; ix++) {
        const x = playerPos.x + (ix - gridHalf) * GRID_RES
        const z = playerPos.z + (iz - gridHalf) * GRID_RES
        const y = this.getHeight(x, z)
        positions.push(x, y, z)
        uvs.push(ix / segW, iz / segH)
      }
    }

    for (let iz = 0; iz < segH; iz++) {
      for (let ix = 0; ix < segW; ix++) {
        const a = iz * (segW + 1) + ix
        const b = a + 1
        const c = a + (segW + 1)
        const d = c + 1
        indices.push(a, b, d)
        indices.push(a, d, c)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()

    if (this.mesh) {
      this.mesh.geometry.dispose()
      ;(this.mesh.material as THREE.Material).dispose()
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a6b38,
      roughness: 0.95,
      metalness: 0,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.receiveShadow = true
    this.mesh.castShadow = true
  }

  addToScene(scene: THREE.Scene): void {
    if (this.mesh) scene.add(this.mesh)
  }

  removeFromScene(scene: THREE.Scene): void {
    if (this.mesh) scene.remove(this.mesh)
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose()
      ;(this.mesh.material as THREE.Material).dispose()
      this.mesh = null
    }
  }
}
