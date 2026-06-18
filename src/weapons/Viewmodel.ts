import * as THREE from 'three'
import type { WeaponVisual } from './WeaponDefs'
import { BombModel } from './BombModel'
import { DefuseKitModel } from './DefuseKitModel'

const BASE = new THREE.Vector3(0.32, -0.32, -0.7)

/** First-person gun model parented to the camera, with bob and recoil. */
export class Viewmodel {
  group: THREE.Group
  currentObjective: 'bomb' | 'defuse_kit' | null = null
  private models: Record<WeaponVisual, THREE.Group>
  private recoil = 0
  private bobTime = 0
  private bombModel: BombModel | null = null
  private defuseKitModel: DefuseKitModel | null = null
  private camera: THREE.Camera

  constructor(camera: THREE.Camera) {
    this.camera = camera
    this.group = new THREE.Group()
    this.models = {
      pistol: this.buildGun(0.35, 0x303030),
      shotgun: this.buildGun(0.6, 0x5a3a1a),
      rifle: this.buildGun(0.8, 0x2a2a2a),
    }
    for (const m of Object.values(this.models)) {
      m.visible = false
      this.group.add(m)
    }
    this.group.position.copy(BASE)
    camera.add(this.group)
    this.setWeapon('pistol')
  }

  private buildGun(barrelLen: number, color: number): THREE.Group {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.3), mat)
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, barrelLen), mat)
    barrel.position.set(0, 0.02, -0.15 - barrelLen / 2)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), mat)
    grip.position.set(0, -0.14, 0.08)
    grip.rotation.x = 0.2
    g.add(body, barrel, grip)
    return g
  }

  setWeapon(type: WeaponVisual) {
    this.clearObjective()
    for (const [k, m] of Object.entries(this.models)) {
      m.visible = k === type
    }
  }

  setObjective(type: 'bomb' | 'defuse_kit') {
    this.clearObjective()
    this.currentObjective = type

    if (type === 'bomb') {
      this.bombModel = new BombModel()
      this.camera.add(this.bombModel.mesh)
    } else {
      this.defuseKitModel = new DefuseKitModel()
      this.camera.add(this.defuseKitModel.mesh)
    }
  }

  clearObjective() {
    if (this.bombModel) {
      this.bombModel.dispose()
      this.bombModel = null
    }
    if (this.defuseKitModel) {
      this.defuseKitModel.dispose()
      this.defuseKitModel = null
    }
    this.currentObjective = null
  }

  fire() {
    this.recoil = 1
  }

  update(dt: number, moving: boolean) {
    this.recoil = THREE.MathUtils.lerp(this.recoil, 0, Math.min(1, dt * 12))
    if (moving) this.bobTime += dt * 10
    const amp = moving ? 1 : 0
    const bobX = Math.cos(this.bobTime * 0.5) * 0.012 * amp
    const bobY = Math.sin(this.bobTime) * 0.012 * amp
    this.group.position.set(
      BASE.x + bobX,
      BASE.y + bobY + this.recoil * 0.03,
      BASE.z + this.recoil * 0.09
    )
    this.group.rotation.x = this.recoil * 0.25
  }

  dispose() {
    this.clearObjective()
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (obj.material instanceof THREE.Material) obj.material.dispose()
      }
    })
    this.group.removeFromParent()
  }
}
