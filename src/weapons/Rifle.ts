import { Weapon } from './Weapon'
import * as THREE from 'three'

export class Rifle extends Weapon {
  isFullAuto: boolean = true

  constructor() {
    super('rifle')
  }

  getMuzzleFlashScale(): number {
    return 0.8
  }

  getRecoilAmount(): number {
    return 0.04
  }

  playFireSound(): string {
    return 'rifle_shoot'
  }

  getTracerColor(): THREE.Color {
    return new THREE.Color(0x44ffdd)
  }

  getRecoilRecoveryRate(): number {
    return 5.0
  }
}
