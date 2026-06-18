import { describe, it, expect } from 'vitest'
import { Viewmodel } from '../Viewmodel'
import * as THREE from 'three'

describe('Viewmodel', () => {
  it('creates with a camera', () => {
    const vm = new Viewmodel(new THREE.Camera())
    expect(vm.group).toBeDefined()
    vm.dispose()
  })
})

describe('objective items', () => {
  it('can set bomb viewmodel', () => {
    const vm = new Viewmodel(new THREE.Camera())
    vm.setObjective('bomb')
    expect(vm.currentObjective).toBe('bomb')
    vm.dispose()
  })

  it('can set defuse kit viewmodel', () => {
    const vm = new Viewmodel(new THREE.Camera())
    vm.setObjective('defuse_kit')
    expect(vm.currentObjective).toBe('defuse_kit')
    vm.dispose()
  })

  it('clears objective when switching to weapon', () => {
    const vm = new Viewmodel(new THREE.Camera())
    vm.setObjective('bomb')
    vm.setWeapon('pistol')
    expect(vm.currentObjective).toBeNull()
    vm.dispose()
  })
})
