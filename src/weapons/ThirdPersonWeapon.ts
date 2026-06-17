import * as THREE from 'three'
import type { WeaponType } from '../types'

type WeaponClass = 'pistol' | 'rifle' | 'shotgun' | 'sniper'

function weaponClassOf(type: WeaponType): WeaponClass {
  switch (type) {
    case 'shotgun': return 'shotgun'
    case 'awp': return 'sniper'
    case 'm4':
    case 'aug':
    case 'ak':
    case 'galil':
    case 'mp5':
    case 'rifle': return 'rifle'
    case 'pistol':
    case 'usp':
    case 'glock':
    case 'deagle': return 'pistol'
  }
}

export class ThirdPersonWeapon {
  group: THREE.Group
  private currentType: WeaponType | null = null
  private models: Map<WeaponType, THREE.Object3D[]> = new Map()
  private materialCache: Map<number, THREE.MeshStandardMaterial> = new Map()

  constructor(type: WeaponType) {
    this.group = new THREE.Group()
    this.setWeapon(type)
  }

  setWeapon(type: WeaponType) {
    if (this.currentType === type) return
    // hide all, show target
    for (const [t, parts] of this.models) {
      for (const obj of parts) {
        obj.visible = t === type
      }
    }
    if (!this.models.has(type)) {
      const model = this.buildModel(type)
      const parts = model.children.slice()
      for (const obj of parts) {
        this.group.add(obj)
        obj.visible = true
      }
      this.models.set(type, parts)
    }
    this.currentType = type
  }

  dispose() {
    for (const parts of this.models.values()) {
      for (const obj of parts) {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (child.material instanceof THREE.Material) child.material.dispose()
          }
        })
        this.group.remove(obj)
      }
    }
    this.models.clear()
    for (const mat of this.materialCache.values()) {
      mat.dispose()
    }
    this.materialCache.clear()
  }

  private buildModel(type: WeaponType): THREE.Group {
    const cls = weaponClassOf(type)
    switch (cls) {
      case 'pistol': return this.buildPistol(type)
      case 'rifle': return this.buildRifle(type)
      case 'shotgun': return this.buildShotgun()
      case 'sniper': return this.buildSniper()
    }
  }

  private makeMat(color: number): THREE.MeshStandardMaterial {
    let mat = this.materialCache.get(color)
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6 })
      this.materialCache.set(color, mat)
    }
    return mat
  }

  private buildPistol(type: WeaponType): THREE.Group {
    const g = new THREE.Group()
    const mat = this.makeMat(0x303030)

    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.18), mat)
    body.position.set(0, 0, 0)

    // barrel
    const barrelLen = type === 'deagle' ? 0.2 : type === 'usp' ? 0.16 : 0.12
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, barrelLen), mat)
    barrel.position.set(0, 0.02, -0.09 - barrelLen / 2)

    // grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), mat)
    grip.position.set(0, -0.08, 0.04)
    grip.rotation.x = 0.2

    // suppressor for usp
    if (type === 'usp') {
      const supp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), this.makeMat(0x1a1a1a))
      supp.position.set(0, 0.02, -0.25)
      g.add(supp)
    }

    g.add(body, barrel, grip)
    // One-handed pistol: no arm support needed
    return g
  }

  private buildRifle(type: WeaponType): THREE.Group {
    const g = new THREE.Group()
    const mat = this.makeMat(0x2a2a2a)
    const woodMat = this.makeMat(0x5a3a1a)

    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.35), mat)
    body.position.set(0, 0, 0)

    // barrel
    const barrelLen = type === 'aug' ? 0.3 : 0.25
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, barrelLen), mat)
    barrel.position.set(0, 0.01, -0.175 - barrelLen / 2)

    // stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.15), type === 'ak' ? woodMat : mat)
    stock.position.set(0, -0.01, 0.25)

    // magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), mat)
    mag.position.set(0, -0.08, -0.05)
    // ak has curved magazine
    if (type === 'ak') mag.rotation.x = 0.15

    // grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), mat)
    grip.position.set(0, -0.08, 0.1)
    grip.rotation.x = 0.2

    // scope for aug
    if (type === 'aug') {
      const scope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.1), this.makeMat(0x111111))
      scope.position.set(0, 0.07, -0.05)
      g.add(scope)
    }

    g.add(body, barrel, stock, mag, grip)
    return g
  }

  private buildShotgun(): THREE.Group {
    const g = new THREE.Group()
    const mat = this.makeMat(0x2a2a2a)
    const woodMat = this.makeMat(0x5a3a1a)

    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.3), mat)
    body.position.set(0, 0, 0)

    // barrel (wider)
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.25), mat)
    barrel.position.set(0, 0.02, -0.275)

    // pump grip
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.1), woodMat)
    pump.position.set(0, -0.03, -0.1)

    // stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.15), woodMat)
    stock.position.set(0, -0.01, 0.22)

    g.add(body, barrel, pump, stock)
    return g
  }

  private buildSniper(): THREE.Group {
    const g = new THREE.Group()
    const mat = this.makeMat(0x1a2a1a)

    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.4), mat)
    body.position.set(0, 0, 0)

    // long barrel
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.4), mat)
    barrel.position.set(0, 0.01, -0.4)

    // scope (large)
    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.15), this.makeMat(0x111111))
    scope.position.set(0, 0.08, -0.05)

    // stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.18), mat)
    stock.position.set(0, -0.01, 0.29)

    // bipod legs
    const legMat = this.makeMat(0x333333)
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), legMat)
    legL.position.set(-0.04, -0.08, -0.2)
    legL.rotation.x = 0.2
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), legMat)
    legR.position.set(0.04, -0.08, -0.2)
    legR.rotation.x = 0.2

    g.add(body, barrel, scope, stock, legL, legR)
    return g
  }
}
