import * as THREE from 'three'
import { ENEMY_DEFS } from './EnemyDefs'
import { ThirdPersonWeapon } from '../weapons/ThirdPersonWeapon'

/** Builds a humanoid soldier from primitives. Feet sit at y=0; the gun points -Z (forward). */
export function buildSoldier(type: string): THREE.Group {
  const def = ENEMY_DEFS[type]
  const group = new THREE.Group()

  const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, metalness: 0.2 })
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2a679, roughness: 0.8 })

  const legGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25)
  const lLeg = new THREE.Mesh(legGeo, bodyMat); lLeg.position.set(-0.18, 0.45, 0)
  const rLeg = new THREE.Mesh(legGeo, bodyMat); rLeg.position.set(0.18, 0.45, 0)

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), bodyMat)
  torso.position.set(0, 1.3, 0)

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat)
  head.position.set(0, 1.85, 0)

  const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18)
  const lArm = new THREE.Mesh(armGeo, bodyMat); lArm.position.set(-0.45, 1.35, 0)
  const rArm = new THREE.Mesh(armGeo, bodyMat)
  rArm.position.set(0.4, 1.35, 0.12); rArm.rotation.x = -Math.PI / 3

  const zoned: [THREE.Mesh, 'head' | 'body' | 'legs'][] = [
    [lLeg, 'legs'],
    [rLeg, 'legs'],
    [torso, 'body'],
    [head, 'head'],
    [lArm, 'body'],
    [rArm, 'body'],
  ]
  for (const [part, zone] of zoned) {
    part.userData.zone = zone
    part.castShadow = true
    group.add(part)
  }

  if (def.attackType === 'ranged') {
    const weaponType = type === 'sniper' ? 'awp' : 'rifle'
    const weapon = new ThirdPersonWeapon(weaponType)
    weapon.group.position.set(0.42, 1.3, -0.35)
    group.add(weapon.group)
  }

  const scale = type === 'tank' ? 1.3 : type === 'runner' ? 0.85 : 1
  group.scale.setScalar(scale)
  return group
}
