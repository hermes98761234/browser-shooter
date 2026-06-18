import { describe, it, expect } from 'vitest'
import { GrenadeManager } from '../GrenadeManager'

describe('GrenadeManager', () => {
  it('should start with no grenades', () => {
    const manager = new GrenadeManager()
    expect(manager.has('he')).toBe(false)
    expect(manager.has('flash')).toBe(false)
    expect(manager.has('smoke')).toBe(false)
  })

  it('should add grenade up to carry limit', () => {
    const manager = new GrenadeManager()
    expect(manager.add('he')).toBe(true)
    expect(manager.has('he')).toBe(true)
    expect(manager.getCount('he')).toBe(1)
    expect(manager.add('he')).toBe(false)
  })

  it('should allow 2 flashbangs', () => {
    const manager = new GrenadeManager()
    expect(manager.add('flash')).toBe(true)
    expect(manager.add('flash')).toBe(true)
    expect(manager.getCount('flash')).toBe(2)
    expect(manager.add('flash')).toBe(false)
  })

  it('should remove grenade on use', () => {
    const manager = new GrenadeManager()
    manager.add('he')
    expect(manager.remove('he')).toBe(true)
    expect(manager.has('he')).toBe(false)
  })

  it('should track selected grenade', () => {
    const manager = new GrenadeManager()
    manager.add('he')
    manager.add('flash')
    manager.select('he')
    expect(manager.selected).toBe('he')
  })

  it('should cycle through grenades', () => {
    const manager = new GrenadeManager()
    manager.add('he')
    manager.add('flash')
    manager.add('smoke')
    manager.select('he')
    expect(manager.cycle()).toBe('flash')
    expect(manager.cycle()).toBe('smoke')
    expect(manager.cycle()).toBe('he')
  })
})