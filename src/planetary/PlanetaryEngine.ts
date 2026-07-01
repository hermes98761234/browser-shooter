import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import type { RoadStrip } from './PlanetaryScenery'
import type { SunState } from './SunSystem'
import { AtmosphereConfig } from './AtmosphereConfig'
import { BuildingGeometry } from './BuildingGeometry'
import type { BuildingSpec } from './BuildingGeometry'
import { PostProcessing } from './PostProcessing'
import type { PostQuality } from './PostProcessing'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

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
  sun: THREE.DirectionalLight
  private sky: Sky
  private renderer: THREE.WebGLRenderer | null = null
  private buildings = new THREE.Group()
  private roads = new THREE.Group()
  private trees: THREE.InstancedMesh | null = null
  private greenAreas: THREE.Mesh | null = null
  private hemi: THREE.HemisphereLight
  private wallMat: THREE.MeshStandardMaterial
  private roofMat: THREE.MeshStandardMaterial
  private roadMat: THREE.MeshStandardMaterial
  private treeMat: THREE.MeshBasicMaterial
  private greenMat: THREE.MeshStandardMaterial
  private laneMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  private atmosphere = new AtmosphereConfig()
  private postProcess: PostProcessing | null = null
  private postPreset: PostQuality = PLANETARY_CONFIG.post.defaultPreset
  private loader = new THREE.TextureLoader()
  private readyCbs: (() => void)[] = []
  private originMercator: [number, number] = [0, 0]
  private billboardDummy = new THREE.Object3D()
  private billboardMat = new THREE.Matrix4()

  constructor(private container: HTMLElement, center: [number, number] = [0, 0]) {
    this.originMercator = lngLatToMercator(center[0], center[1])

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x9ec7e8, 120, PLANETARY_CONFIG.fogFar)

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000)

    // Ambient light (soft fill) — promoted to field so atmosphere can drive it
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
    this.scene.add(this.hemi)

    // Directional sun with shadows
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2)
    this.sun.position.set(100, 100, 50)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 400
    this.sun.shadow.camera.left = -125
    this.sun.shadow.camera.right = 125
    this.sun.shadow.camera.top = 125
    this.sun.shadow.camera.bottom = -125
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    // Sky
    this.sky = new Sky()
    this.sky.scale.setScalar(10000)
    this.scene.add(this.sky)
    this.sky.material.uniforms['turbidity'].value = 10
    this.sky.material.uniforms['rayleigh'].value = 2
    this.sky.material.uniforms['mieCoefficient'].value = 0.005
    this.sky.material.uniforms['mieDirectionalG'].value = 0.8

    // Materials (textures loaded lazily; won't crash in jsdom because TextureLoader defers WebGL)
    const facadeTex = this.loadTex('./assets/building-facade.png')
    if (facadeTex) {
      facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping
    }
    this.wallMat = new THREE.MeshStandardMaterial({
      map: facadeTex ?? undefined,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })
    this.roofMat = new THREE.MeshStandardMaterial({
      color: PLANETARY_CONFIG.building.roofColor,
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide,
    })

    const roadTex = this.loadTex('./assets/road-asphalt.png')
    if (roadTex) {
      roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping
    }
    this.roadMat = new THREE.MeshStandardMaterial({ map: roadTex ?? undefined, roughness: 1, metalness: 0 })

    const treeTex = this.loadTex('./assets/tree-sprite.png')
    this.treeMat = new THREE.MeshBasicMaterial({ map: treeTex ?? undefined, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })

    this.greenMat = new THREE.MeshStandardMaterial({ color: 0x4a6b38, roughness: 1, metalness: 0 })

    // Ground (fallback for areas without OSM green data)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: 0x3a5228, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    this.scene.add(this.buildings)
    this.scene.add(this.roads)

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

  private loadTex(relPath: string): THREE.Texture {
    const fallback = new THREE.DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
    fallback.needsUpdate = true
    try {
      const url = new URL(relPath, import.meta.url).href
      return this.loader.load(url, undefined, undefined, () => { /* silent on missing asset */ })
    } catch {
      return fallback
    }
  }

  onReady(cb: () => void) {
    this.readyCbs.push(cb)
  }

  setSunAngle(state: SunState): void {
    const d = state.direction
    this.sun.position.set(d.x * 200, d.y * 200, d.z * 200)
    this.sun.color.copy(state.color)
    this.sun.intensity = state.intensity
    this.sky.material.uniforms['sunPosition'].value.copy(state.direction)

    const atmo = this.atmosphere.update(state.elevation)

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(atmo.fogColor)
    }
    this.hemi.color.copy(atmo.hemiSky)
    this.hemi.groundColor.copy(atmo.hemiGround)
    this.hemi.intensity = atmo.hemiIntensity
    this.sky.material.uniforms['turbidity'].value = atmo.turbidity
    this.sky.material.uniforms['rayleigh'].value = atmo.rayleigh
    this.sky.material.uniforms['mieCoefficient'].value = atmo.mieCoefficient
    this.sky.material.uniforms['mieDirectionalG'].value = atmo.mieDirectionalG
  }

  setViewFromPlayer(playerPos: THREE.Vector3, yaw: number, pitch: number) {
    this.camera.position.copy(playerPos)
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ')
    // Keep shadow frustum centered on player
    this.sun.target.position.copy(playerPos)
    this.sun.target.updateMatrixWorld()
  }

  private cullFar(): number {
    return this.scene.fog instanceof THREE.Fog ? this.scene.fog.far : Infinity
  }

  private isBeyond(x: number, z: number, far: number): boolean {
    const dx = x - this.camera.position.x
    const dz = z - this.camera.position.z
    return dx * dx + dz * dz > far * far
  }

  private footprintCentroid(footprint: [number, number][]): [number, number] {
    let sx = 0
    let sz = 0
    for (const [x, z] of footprint) { sx += x; sz += z }
    return [sx / footprint.length, sz / footprint.length]
  }

  setBuildings(specs: BuildingSpec[]) {
    this.disposeGroup(this.buildings)
    const far = this.cullFar()
    for (const spec of specs) {
      const [cx, cz] = this.footprintCentroid(spec.footprint)
      if (this.isBeyond(cx, cz, far)) continue
      let geo: THREE.BufferGeometry
      try {
        geo = BuildingGeometry.generate(spec)
      } catch {
        continue
      }
      const mesh = new THREE.Mesh(geo, [this.wallMat, this.roofMat])
      // DO NOT set mesh.position — footprints are absolute local XZ
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.buildings.add(mesh)
    }
  }

  setRoads(roads: RoadStrip[]): void {
    this.disposeGroup(this.roads)
    const far = this.cullFar()
    for (const strip of roads) {
      const [a, b, c, d] = strip.corners
      const mx = (a.x + b.x + c.x + d.x) / 4
      const mz = (a.z + b.z + c.z + d.z) / 4
      if (this.isBeyond(mx, mz, far)) continue
      const geo = new THREE.BufferGeometry()
      // Two triangles: ABD and BCD
      const positions = new Float32Array([
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        d.x, d.y, d.z,
        b.x, b.y, b.z,
        c.x, c.y, c.z,
        d.x, d.y, d.z,
      ])
      // UV: tile along length, road width = 1 UV unit
      const uvLen = strip.uvLength / 4  // tile every 4 m
      const uvs = new Float32Array([
        0, 0,  1, 0,  0, uvLen,
        1, 0,  1, uvLen,  0, uvLen,
      ])
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      geo.computeVertexNormals()
      const mesh = new THREE.Mesh(geo, this.roadMat)
      mesh.receiveShadow = true
      this.roads.add(mesh)

      // Center-line marking: a 0.12 m-wide white quad strip raised +0.02 Y above the road.
      // Corners [a, b, c, d]: a and b share v=0 (one short edge), d and c share v=uvLen (other short edge).
      // Centerline endpoints are midpoints of the two short (cross-strip) edges.
      const yOffset = 0.02
      const mid1x = (a.x + b.x) / 2
      const mid1y = (a.y + b.y) / 2 + yOffset
      const mid1z = (a.z + b.z) / 2
      const mid2x = (d.x + c.x) / 2
      const mid2y = (d.y + c.y) / 2 + yOffset
      const mid2z = (d.z + c.z) / 2

      const cdx = mid2x - mid1x
      const cdz = mid2z - mid1z
      const clen = Math.sqrt(cdx * cdx + cdz * cdz)
      if (clen > 1e-6) {
        // Perpendicular offset of 0.06 m (half of 0.12 m width)
        const px = (-cdz / clen) * 0.06
        const pz = (cdx / clen) * 0.06

        const lanePos = new Float32Array([
          mid1x + px, mid1y, mid1z + pz,
          mid1x - px, mid1y, mid1z - pz,
          mid2x + px, mid2y, mid2z + pz,
          mid1x - px, mid1y, mid1z - pz,
          mid2x - px, mid2y, mid2z - pz,
          mid2x + px, mid2y, mid2z + pz,
        ])
        const laneGeo = new THREE.BufferGeometry()
        laneGeo.setAttribute('position', new THREE.BufferAttribute(lanePos, 3))
        laneGeo.computeVertexNormals()
        const laneMesh = new THREE.Mesh(laneGeo, this.laneMat)
        this.roads.add(laneMesh)
      }
    }
  }

  setTrees(positions: THREE.Vector3[]): void {
    if (this.trees) {
      this.trees.geometry.dispose()
      this.scene.remove(this.trees)
      this.trees = null
    }
    const far = this.cullFar()
    const visible = positions.filter(p => !this.isBeyond(p.x, p.z, far))
    if (visible.length === 0) return
    const geo = new THREE.PlaneGeometry(6, 10)
    const mesh = new THREE.InstancedMesh(geo, this.treeMat, visible.length)
    mesh.castShadow = true
    const dummy = new THREE.Object3D()
    for (let i = 0; i < visible.length; i++) {
      dummy.position.copy(visible[i])
      dummy.position.y = 5  // center of 10 m tall plane
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    this.trees = mesh
    this.scene.add(this.trees)
  }

  setGreenAreas(triangles: Float32Array): void {
    if (this.greenAreas) {
      this.greenAreas.geometry.dispose()
      this.scene.remove(this.greenAreas)
      this.greenAreas = null
    }
    if (triangles.length === 0) return
    const vertCount = triangles.length / 2
    const pos = new Float32Array(vertCount * 3)
    const uvArr = new Float32Array(vertCount * 2)
    for (let i = 0; i < vertCount; i++) {
      const x = triangles[i * 2]
      const z = triangles[i * 2 + 1]
      pos[i * 3] = x
      pos[i * 3 + 1] = 0.01
      pos[i * 3 + 2] = z
      uvArr[i * 2] = x / 4
      uvArr[i * 2 + 1] = z / 4
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2))
    geo.computeVertexNormals()
    this.greenAreas = new THREE.Mesh(geo, this.greenMat)
    this.greenAreas.receiveShadow = true
    this.scene.add(this.greenAreas)
  }

  render() {
    if (!this.renderer) {
      const r = new THREE.WebGLRenderer({ antialias: true })
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      r.shadowMap.enabled = true
      r.shadowMap.type = THREE.PCFSoftShadowMap
      const canvas = r.domElement
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      this.container.appendChild(canvas)
      this.renderer = r
      if (!this.postProcess) {
        this.postProcess = new PostProcessing(this.renderer, this.scene, this.camera)
        if (this.postProcess.active) this.renderer.toneMapping = THREE.NoToneMapping
      }
    }
    // Billboard trees: rotate each instance to face camera each frame
    if (this.trees) {
      const camPos = this.camera.position
      const dummy = this.billboardDummy
      const mat = this.billboardMat
      for (let i = 0; i < this.trees.count; i++) {
        this.trees.getMatrixAt(i, mat)
        dummy.matrix.copy(mat)
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
        dummy.lookAt(camPos.x, dummy.position.y, camPos.z)
        dummy.updateMatrix()
        this.trees.setMatrixAt(i, dummy.matrix)
      }
      this.trees.instanceMatrix.needsUpdate = true
    }
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    const size = this.renderer.getSize(new THREE.Vector2())
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.postProcess?.setSize(w, h)
    }
    if (this.postProcess?.active) this.postProcess.render(1 / 60)
    else this.renderer.render(this.scene, this.camera)
  }

  setPostProcessingPreset(preset: PostQuality): void {
    if (this.postPreset === preset) return
    this.postPreset = preset
    this.postProcess?.setQuality(preset)
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

  private disposeGroup(group: THREE.Group) {
    for (const m of group.children) {
      if (m instanceof THREE.Mesh) m.geometry.dispose()
    }
    group.clear()
  }

  dispose() {
    this.disposeGroup(this.buildings)
    this.disposeGroup(this.roads)
    if (this.trees) { this.trees.geometry.dispose(); this.scene.remove(this.trees) }
    if (this.greenAreas) { this.greenAreas.geometry.dispose(); this.scene.remove(this.greenAreas) }
    this.postProcess?.dispose()
    this.wallMat.dispose()
    this.roofMat.dispose()
    this.laneMat.dispose()
    this.renderer?.domElement.remove()
    this.renderer?.dispose()
    this.map.remove()
  }
}
