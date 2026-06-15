import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildCharacter } from '../CharacterModel'
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
})
