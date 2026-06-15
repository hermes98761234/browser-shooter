import * as THREE from 'three'
import type { GameState } from '../types'

export class GameEngine {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  clock: THREE.Clock
  state: GameState = 'menu'
  private animationId: number = 0
  private updateCallbacks: ((dt: number) => void)[] = []

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)
    this.scene.fog = new THREE.Fog(0x1a1a2e, 30, 80)

    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(0, 2, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    this.clock = new THREE.Clock()

    window.addEventListener('resize', () => this.onResize(container))
  }

  private onResize(container: HTMLElement) {
    this.camera.aspect = container.clientWidth / container.clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(container.clientWidth, container.clientHeight)
  }

  onUpdate(callback: (dt: number) => void) {
    this.updateCallbacks.push(callback)
  }

  removeUpdate(callback: (dt: number) => void) {
    this.updateCallbacks = this.updateCallbacks.filter(cb => cb !== callback)
  }

  start() {
    this.state = 'playing'
    this.clock.start()
    this.animate()
  }

  pause() {
    this.state = 'paused'
    this.clock.stop()
  }

  resume() {
    this.state = 'playing'
    this.clock.start()
  }

  stop() {
    this.state = 'menu'
    this.clock.stop()
    cancelAnimationFrame(this.animationId)
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate)
    if (this.state !== 'playing') return
    const dt = Math.min(this.clock.getDelta(), 0.1)
    for (const cb of this.updateCallbacks) {
      cb(dt)
    }
    this.renderer.render(this.scene, this.camera)
  }
}
