import { Weapon } from './Weapon'
import * as THREE from 'three'

export class Pistol extends Weapon {
  isSemiAuto: boolean = true

  constructor() {
    super('pistol')
  }

  getMuzzleFlashScale(): number {
    return 0.6
  }

  getRecoilAmount(): number {
    return 0.02
  }

  playFireSound(): string {
    return 'pistol_shoot'
  }

  getTracerColor(): THREE.Color {
    return new THREE.Color(0xffdd44)
  }
}
