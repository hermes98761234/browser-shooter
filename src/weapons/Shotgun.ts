import { Weapon } from './Weapon'
import * as THREE from 'three'

export class Shotgun extends Weapon {
  pelletsPerShot: number = 6

  constructor() {
    super('shotgun')
  }

  getPelletCount(): number {
    return this.pelletsPerShot
  }

  getMuzzleFlashScale(): number {
    return 1.2
  }

  getRecoilAmount(): number {
    return 0.08
  }

  playFireSound(): string {
    return 'shotgun_shoot'
  }

  getTracerColor(): THREE.Color {
    return new THREE.Color(0xff8844)
  }
}
