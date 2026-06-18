import type { Vec3 } from '../types'

export class Bombsite {
  id: 'A' | 'B'
  center: Vec3
  radius: number = 4

  constructor(id: 'A' | 'B', center: Vec3) {
    this.id = id
    this.center = center
  }

  isInside(pos: Vec3): boolean {
    const dx = pos.x - this.center.x
    const dz = pos.z - this.center.z
    return Math.sqrt(dx * dx + dz * dz) <= this.radius
  }
}
