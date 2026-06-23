import * as THREE from 'three'
import type { GrenadeType } from '../types'

const GRENADE_COLORS: Record<GrenadeType, { body: number; accent: number }> = {
  he: { body: 0x4a5c3a, accent: 0x2d3a22 },
  flash: { body: 0xc0c0c0, accent: 0xff0000 },
  smoke: { body: 0x3a5c3a, accent: 0x2d4a22 },
}

export function createGrenadeModel(type: GrenadeType): THREE.Group {
  const group = new THREE.Group()
  const colors = GRENADE_COLORS[type]

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8),
    new THREE.MeshStandardMaterial({ color: colors.body, metalness: 0.6, roughness: 0.4 })
  )
  body.rotation.x = Math.PI / 2
  group.add(body)

  const accent = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.02, 8),
    new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.7, roughness: 0.3 })
  )
  accent.rotation.x = Math.PI / 2
  accent.position.z = 0.04
  group.add(accent)

  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.03, 4),
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 })
  )
  pin.position.set(0.05, 0.02, 0)
  group.add(pin)

  return group
}
