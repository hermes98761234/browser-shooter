import * as THREE from 'three'
import { animateCharacter, buildCharacter, getNameTag, buildTalkingSprite } from '../entities/CharacterModel'
import { EYE_HEIGHT } from '../player/Player'
import type { EntityState } from '../session/protocol'
import type { Team, WeaponType } from '../types'
import { ThirdPersonWeapon } from '../weapons/ThirdPersonWeapon'

const INTERP_DELAY = 100
const TEAM_COLOR = { ct: 0x3a6ea5, t: 0xa5703a } as const
const VALID_WEAPON_TYPES: WeaponType[] = ['pistol', 'usp', 'glock', 'deagle', 'm4', 'aug', 'ak', 'galil', 'mp5', 'shotgun', 'awp', 'rifle']

interface InterpEntry {
  position: THREE.Vector3
  rotationY: number
  time: number
}

export class RemotePlayer {
  readonly group: THREE.Group
  private buffer: InterpEntry[] = []
  private team: Team | null = null
  isDead = false
  private thirdPersonWeapon: ThirdPersonWeapon
  hasArmor = false
  hasHelmet = false
  private vestMesh: THREE.Mesh | null = null
  private helmetMesh: THREE.Mesh | null = null
  private nameTag: THREE.Sprite | null
  private talkingSprite: THREE.Sprite
  private readonly prevPos = new THREE.Vector3()
  private hasPrevPos = false

  constructor(readonly id: string, name: string, tint = 0x3399ff) {
    this.group = buildCharacter({ tint, name })
    this.nameTag = getNameTag(this.group)
    this.thirdPersonWeapon = new ThirdPersonWeapon('pistol')
    this.thirdPersonWeapon.group.position.set(0.42, 1.3, -0.35)
    this.group.add(this.thirdPersonWeapon.group)
    this.talkingSprite = buildTalkingSprite()
    this.group.add(this.talkingSprite)
  }

  pushState(s: EntityState, time?: number): void {
    this.isDead = s.isDead
    this.buffer.push({
      position: new THREE.Vector3(s.position.x, s.position.y, s.position.z),
      rotationY: s.rotationY,
      time: time ?? performance.now(),
    })
    while (this.buffer.length > 10) this.buffer.shift()
    if (this.buffer.length === 1) {
      this.setFeet(this.buffer[0].position)
      this.group.rotation.y = this.buffer[0].rotationY
    }

    if (s.team && s.team !== this.team) {
      this.team = s.team
      this.applyTeamColor(TEAM_COLOR[s.team])
    }

    if (s.weaponType && VALID_WEAPON_TYPES.includes(s.weaponType as WeaponType)) {
      this.thirdPersonWeapon.setWeapon(s.weaponType as WeaponType)
    }
  }

  getInterpolatedPosition(renderTime: number): THREE.Vector3 | null {
    const t = renderTime - INTERP_DELAY
    if (this.buffer.length < 2) return this.buffer.length === 1 ? this.buffer[0].position.clone() : null

    let a: InterpEntry | null = null
    let b: InterpEntry | null = null
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].time <= t && this.buffer[i + 1].time >= t) {
        a = this.buffer[i]
        b = this.buffer[i + 1]
        break
      }
    }
    if (!a || !b) return this.buffer[this.buffer.length - 1].position.clone()

    const frac = (t - a.time) / (b.time - a.time)
    return new THREE.Vector3().lerpVectors(a.position, b.position, frac)
  }

  getInterpolatedRotation(renderTime: number): number {
    const t = renderTime - INTERP_DELAY
    if (this.buffer.length < 2) return this.buffer.length === 1 ? this.buffer[0].rotationY : 0

    let a: InterpEntry | null = null
    let b: InterpEntry | null = null
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].time <= t && this.buffer[i + 1].time >= t) {
        a = this.buffer[i]
        b = this.buffer[i + 1]
        break
      }
    }
    if (!a || !b) return this.buffer[this.buffer.length - 1].rotationY

    const frac = (t - a.time) / (b.time - a.time)
    return a.rotationY + (b.rotationY - a.rotationY) * frac
  }

  update(dt: number): void {
    const pos = this.getInterpolatedPosition(performance.now())
    let speed = 0
    if (pos) {
      if (this.hasPrevPos && dt > 0) {
        const dx = pos.x - this.prevPos.x
        const dz = pos.z - this.prevPos.z
        speed = Math.hypot(dx, dz) / dt
      }
      this.prevPos.copy(pos)
      this.hasPrevPos = true
      this.setFeet(pos)
    }
    this.group.rotation.y = this.getInterpolatedRotation(performance.now())
    this.group.visible = !this.isDead
    if (!this.isDead) animateCharacter(this.group, speed, dt)
  }

  setTalking(on: boolean): void { this.talkingSprite.visible = on }
  isTalking(): boolean { return this.talkingSprite.visible }

  private applyTeamColor(color: number): void {
    const seen = new Set<THREE.MeshStandardMaterial>()
    this.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      if (o.userData.zone === 'head' || o.userData.zone === 'weapon') return // preserve skin color
      const mat = o.material
      if (!(mat instanceof THREE.MeshStandardMaterial)) return
      if (!seen.has(mat)) {
        seen.add(mat)
        mat.color.setHex(color)
      }
    })
  }

  /** Place the avatar so its feet (model origin y=0) rest on the ground. The
   *  snapshot position is the player's eye, so drop the group by EYE_HEIGHT. */
  private setFeet(eyePos: THREE.Vector3): void {
    this.group.position.set(eyePos.x, eyePos.y - EYE_HEIGHT, eyePos.z)
  }

  /** Nameplates render through walls (depthTest off), so only show them for teammates —
   *  otherwise enemy positions leak through geometry. */
  setNameVisible(show: boolean): void {
    if (this.nameTag) this.nameTag.visible = show
  }

  setArmor(show: boolean): void {
    this.hasArmor = show
    if (show && !this.vestMesh) {
      this.vestMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x228B22 })
      )
      this.vestMesh.position.set(0, 0, 0)
      this.group.add(this.vestMesh)
    } else if (!show && this.vestMesh) {
      this.group.remove(this.vestMesh)
      this.vestMesh.geometry.dispose()
      this.vestMesh = null
    }
  }

  setHelmet(show: boolean): void {
    this.hasHelmet = show
    if (show && !this.helmetMesh) {
      this.helmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x228B22 })
      )
      this.helmetMesh.position.set(0, 0.9, 0)
      this.group.add(this.helmetMesh)
    } else if (!show && this.helmetMesh) {
      this.group.remove(this.helmetMesh)
      this.helmetMesh.geometry.dispose()
      this.helmetMesh = null
    }
  }

  dispose(): void {
    this.setArmor(false)
    this.setHelmet(false)
    this.thirdPersonWeapon.dispose()
    ;(this.talkingSprite.material as THREE.SpriteMaterial).map?.dispose()
    ;(this.talkingSprite.material as THREE.SpriteMaterial).dispose()
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() }
    })
  }
}
