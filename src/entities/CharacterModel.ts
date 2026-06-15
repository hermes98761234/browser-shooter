import * as THREE from 'three'

export interface CharacterOptions {
  tint: number
  name?: string
}

/** A zoned humanoid for remote players. Feet at y=0, faces -Z. */
export function buildCharacter(opts: CharacterOptions): THREE.Group {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: opts.tint, roughness: 0.7, metalness: 0.2 })
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2a679, roughness: 0.8 })

  const legGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25)
  const lLeg = new THREE.Mesh(legGeo, bodyMat); lLeg.position.set(-0.18, 0.45, 0)
  const rLeg = new THREE.Mesh(legGeo, bodyMat); rLeg.position.set(0.18, 0.45, 0)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), bodyMat); torso.position.set(0, 1.3, 0)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat); head.position.set(0, 1.85, 0)
  const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18)
  const lArm = new THREE.Mesh(armGeo, bodyMat); lArm.position.set(-0.45, 1.35, 0)
  const rArm = new THREE.Mesh(armGeo, bodyMat); rArm.position.set(0.45, 1.35, 0)

  const zoned: [THREE.Mesh, 'head' | 'body' | 'legs'][] = [
    [lLeg, 'legs'], [rLeg, 'legs'], [torso, 'body'], [head, 'head'], [lArm, 'body'], [rArm, 'body'],
  ]
  for (const [part, zone] of zoned) {
    part.userData.zone = zone
    part.castShadow = true
    group.add(part)
  }

  if (opts.name) group.add(makeNameTag(opts.name))
  return group
}

function makeNameTag(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(name, 128, 44)
  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
  sprite.position.set(0, 2.4, 0)
  sprite.scale.set(1.5, 0.375, 1)
  return sprite
}
