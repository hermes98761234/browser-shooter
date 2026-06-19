import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildCharacter, animateCharacter, type CharacterLimbs } from '../CharacterModel'
import { resolveZone } from '../../systems/DamageZones'

describe('buildCharacter', () => {
  it('builds a group with head/body/legs zones', () => {
    const group = buildCharacter({ tint: 0xff0000 })
    const zones = new Set<string>()
    group.traverse((o) => { if (o instanceof THREE.Mesh) zones.add(resolveZone(o)) })
    expect(zones.has('head')).toBe(true)
    expect(zones.has('body')).toBe(true)
    expect(zones.has('legs')).toBe(true)
  })

  it('applies the tint to the torso material', () => {
    const group = buildCharacter({ tint: 0x00ff00 })
    let found = false
    group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.zone === 'body' &&
          o.material instanceof THREE.MeshStandardMaterial &&
          o.material.color.getHex() === 0x00ff00) found = true
    })
    expect(found).toBe(true)
  })

  it('adds at least two eyes that resolve as head hits', () => {
    const group = buildCharacter({ tint: 0xff0000 })
    const eyes: THREE.Mesh[] = []
    group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.feature === 'eye') eyes.push(o)
    })
    expect(eyes.length).toBeGreaterThanOrEqual(2)
    for (const eye of eyes) expect(resolveZone(eye)).toBe('head')
  })

  it('exposes animatable limb pivots on the group', () => {
    const group = buildCharacter({ tint: 0xff0000 })
    const limbs = group.userData.limbs as CharacterLimbs | undefined
    expect(limbs).toBeDefined()
    expect(limbs!.lArm).toBeInstanceOf(THREE.Group)
    expect(limbs!.rArm).toBeInstanceOf(THREE.Group)
    expect(limbs!.lLeg).toBeInstanceOf(THREE.Group)
    expect(limbs!.rLeg).toBeInstanceOf(THREE.Group)
  })
})

describe('animateCharacter', () => {
  it('swings arms and legs in opposite phase while moving', () => {
    const group = buildCharacter({ tint: 0xff0000 })
    // Advance the phase far enough that the swing is clearly non-zero.
    animateCharacter(group, 5, 0.25)
    const limbs = group.userData.limbs as CharacterLimbs
    expect(Math.abs(limbs.lArm.rotation.x)).toBeGreaterThan(0.01)
    // Left arm and left leg swing in opposite directions (diagonal gait).
    expect(Math.sign(limbs.lArm.rotation.x)).toBe(-Math.sign(limbs.lLeg.rotation.x))
    // Left and right arms mirror each other.
    expect(Math.sign(limbs.lArm.rotation.x)).toBe(-Math.sign(limbs.rArm.rotation.x))
  })

  it('produces a larger swing when running than when idle', () => {
    const moving = buildCharacter({ tint: 0xff0000 })
    const idle = buildCharacter({ tint: 0xff0000 })
    // Same phase for both, different speed.
    animateCharacter(moving, 6, 0.25)
    animateCharacter(idle, 0, 0.25)
    const m = (moving.userData.limbs as CharacterLimbs).lArm.rotation.x
    const i = (idle.userData.limbs as CharacterLimbs).lArm.rotation.x
    expect(Math.abs(m)).toBeGreaterThan(Math.abs(i))
    // Idle still has a subtle sway so the character never looks frozen.
    expect(Math.abs(i)).toBeGreaterThan(0)
  })
})
