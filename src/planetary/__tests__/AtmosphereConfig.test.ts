import { describe, it, expect } from 'vitest'
import { AtmosphereConfig } from '../AtmosphereConfig'
import * as THREE from 'three'

describe('AtmosphereConfig', () => {
  const atm = new AtmosphereConfig()

  it('night (elev -0.2): sunIntensity is 0 and fogColor is dark', () => {
    const state = atm.update(-0.2)
    expect(state.sunIntensity).toBe(0)
    expect(state.fogColor.r).toBeLessThan(0.1)
  })

  it('day (elev 0.5): sunIntensity > 1.0 and sunColor is near-white', () => {
    const state = atm.update(0.5)
    expect(state.sunIntensity).toBeGreaterThan(1.0)
    expect(state.sunColor.r).toBeGreaterThan(0.9)
  })

  it('sunrise (elev 0.0): fogColor and sunColor are warm (r > 0.5)', () => {
    const state = atm.update(0.0)
    expect(state.fogColor.r).toBeGreaterThan(0.5)
    expect(state.sunColor.r).toBeGreaterThan(0.5)
  })

  it('state getter returns last computed state', () => {
    const state = atm.update(0.3)
    expect(atm.state).toBe(state)
  })

  it('returns AtmosphereState with all required fields', () => {
    const state = atm.update(0.5)
    expect(typeof state.turbidity).toBe('number')
    expect(typeof state.rayleigh).toBe('number')
    expect(typeof state.mieCoefficient).toBe('number')
    expect(typeof state.mieDirectionalG).toBe('number')
    expect(state.fogColor).toBeInstanceOf(THREE.Color)
    expect(state.sunColor).toBeInstanceOf(THREE.Color)
    expect(typeof state.sunIntensity).toBe('number')
    expect(state.hemiSky).toBeInstanceOf(THREE.Color)
    expect(state.hemiGround).toBeInstanceOf(THREE.Color)
    expect(typeof state.hemiIntensity).toBe('number')
  })
})
