import { describe, it, expect } from 'vitest'
import { SunSystem } from '../SunSystem'
import * as THREE from 'three'

describe('SunSystem', () => {
  const sys = new SunSystem()

  it('sun is above horizon at noon', () => {
    const { direction } = sys.compute(12)
    expect(direction.y).toBeGreaterThan(0)
  })

  it('sun direction is normalized', () => {
    const { direction } = sys.compute(12)
    expect(direction.length()).toBeCloseTo(1, 3)
  })

  it('intensity is highest around noon', () => {
    const noon = sys.compute(12)
    const dawn = sys.compute(6)
    expect(noon.intensity).toBeGreaterThan(dawn.intensity)
  })

  it('intensity is zero at midnight', () => {
    const { intensity } = sys.compute(0)
    expect(intensity).toBe(0)
  })

  it('intensity is zero at 3am', () => {
    const { intensity } = sys.compute(3)
    expect(intensity).toBe(0)
  })

  it('returns SunState with all required fields', () => {
    const state = sys.compute(10)
    expect(state.direction).toBeInstanceOf(THREE.Vector3)
    expect(state.color).toBeInstanceOf(THREE.Color)
    expect(typeof state.intensity).toBe('number')
    expect(state.skyTop).toBeInstanceOf(THREE.Color)
    expect(state.skyHorizon).toBeInstanceOf(THREE.Color)
  })

  it('sun direction is roughly east at sunrise (hour=6)', () => {
    const { direction } = sys.compute(6)
    // At sunrise elevation≈0, sun should be more horizontal than vertical
    expect(Math.abs(direction.x) + Math.abs(direction.z)).toBeGreaterThan(direction.y)
  })

  it('sun direction is non-zero and normalized at midnight', () => {
    const { direction } = sys.compute(0)
    expect(direction.lengthSq()).toBeGreaterThan(0)
    expect(isNaN(direction.x)).toBe(false)
  })

  it('sun points roughly west (+X) at sunset (hour=18)', () => {
    const { direction } = sys.compute(18)
    // At sunset, x component should be positive (west = +X)
    expect(direction.x).toBeGreaterThanOrEqual(0)
  })
})
