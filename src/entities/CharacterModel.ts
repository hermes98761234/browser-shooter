import * as THREE from 'three'

export interface CharacterOptions {
  tint: number
  name?: string
}

/** Pivot groups for the four limbs, rotated each frame by {@link animateCharacter}. */
export interface CharacterLimbs {
  lArm: THREE.Group
  rArm: THREE.Group
  lLeg: THREE.Group
  rLeg: THREE.Group
}

/** A zoned humanoid for remote players. Feet at y=0, faces -Z. */
export function buildCharacter(opts: CharacterOptions): THREE.Group {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: opts.tint, roughness: 0.7, metalness: 0.2 })
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2a679, roughness: 0.8 })

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), bodyMat); torso.position.set(0, 1.3, 0)
  torso.userData.zone = 'body'; torso.castShadow = true
  group.add(torso)

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat); head.position.set(0, 1.85, 0)
  head.userData.zone = 'head'; head.castShadow = true
  addEyes(head)
  group.add(head)

  // Limbs hang from a pivot group placed at the joint (hip / shoulder) so that
  // rotating the pivot swings the whole limb naturally instead of spinning it
  // about its own centre.
  const legGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25)
  const lLeg = makeLimb(legGeo, bodyMat, -0.18, 0.9, 0.45, 'legs')
  const rLeg = makeLimb(legGeo, bodyMat, 0.18, 0.9, 0.45, 'legs')

  const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18)
  const lArm = makeLimb(armGeo, bodyMat, -0.45, 1.7, 0.35, 'body')
  const rArm = makeLimb(armGeo, bodyMat, 0.45, 1.7, 0.35, 'body')

  group.add(lLeg, rLeg, lArm, rArm)

  const limbs: CharacterLimbs = { lArm, rArm, lLeg, rLeg }
  group.userData.limbs = limbs
  group.userData.walkPhase = 0

  if (opts.name) group.add(makeNameTag(opts.name))
  return group
}

/** The character's floating nameplate sprite, if it has one (added when `name` is set). */
export function getNameTag(group: THREE.Group): THREE.Sprite | null {
  return (group.children.find((c) => c instanceof THREE.Sprite) as THREE.Sprite) ?? null
}

/** Green circle sprite shown above a player's head while they are talking. */
export function buildTalkingSprite(): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 32; canvas.height = 32
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.arc(16, 16, 14, 0, Math.PI * 2)
  ctx.fillStyle = '#22ff44'
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(0.25, 0.25, 1)
  sprite.position.set(0, 2.65, 0)
  sprite.visible = false
  return sprite
}

/** Build a limb as a pivot group at `(x, pivotY)` with the mesh hanging below it. */
function makeLimb(
  geo: THREE.BoxGeometry,
  mat: THREE.Material,
  x: number,
  pivotY: number,
  halfLen: number,
  zone: 'body' | 'legs',
): THREE.Group {
  const pivot = new THREE.Group()
  pivot.position.set(x, pivotY, 0)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(0, -halfLen, 0)
  mesh.userData.zone = zone
  mesh.castShadow = true
  pivot.add(mesh)
  return pivot
}

/** Two eyes on the head's forward (-Z) face. Marked as head so hits & team
 *  colouring treat them like the rest of the head. */
function addEyes(head: THREE.Mesh): void {
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.3 })
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), whiteMat)
    eye.position.set(sx * 0.08, 0.04, -0.18)
    eye.userData.zone = 'head'
    eye.userData.feature = 'eye'
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), pupilMat)
    pupil.position.set(0, 0, -0.012)
    pupil.userData.zone = 'head'
    pupil.userData.feature = 'eye'
    eye.add(pupil)
    head.add(eye)
  }
}

/**
 * Swing the limbs to make the character look alive. `speed` is the horizontal
 * speed in m/s; faster movement widens the stride. Idle characters keep a small
 * sway so they never look frozen. Call once per frame with the frame `dt`.
 */
export function animateCharacter(group: THREE.Group, speed: number, dt: number): void {
  const limbs = group.userData.limbs as CharacterLimbs | undefined
  if (!limbs) return

  const moving = Math.min(speed / 4, 1) // 0 = idle, 1 = full run
  // Idle breathes slowly; running steps quickly.
  const cadence = 3 + moving * 8
  const phase = ((group.userData.walkPhase as number) ?? 0) + dt * cadence
  group.userData.walkPhase = phase

  const amplitude = 0.12 + moving * 0.7
  const swing = Math.sin(phase) * amplitude

  // Diagonal gait: each arm mirrors the opposite leg.
  limbs.lArm.rotation.x = swing
  limbs.rArm.rotation.x = -swing
  limbs.lLeg.rotation.x = -swing
  limbs.rLeg.rotation.x = swing
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
