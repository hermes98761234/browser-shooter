import { describe, it, expect } from 'vitest'
import { stepBloom, type BloomInputs } from '../CrosshairBloom'
import { resolveCrosshair, DEFAULT_CROSSHAIR, type CrosshairSettings } from '../../settings/Crosshair'

const idle: BloomInputs = { moving: false, airborne: false, shotsFired: 0, weaponSpread: 0.04 }

describe('stepBloom', () => {
  it('stays at rest when idle and not moving', () => {
    expect(stepBloom(0, 0.016, idle)).toBe(0)
  })

  it('grows toward a target while moving', () => {
    const next = stepBloom(0, 0.016, { ...idle, moving: true })
    expect(next).toBeGreaterThan(0)
  })

  it('grows more in the air than while moving', () => {
    const air = stepBloom(0, 0.016, { ...idle, airborne: true })
    const move = stepBloom(0, 0.016, { ...idle, moving: true })
    expect(air).toBeGreaterThan(move)
  })

  it('kicks up immediately when a shot is fired', () => {
    const next = stepBloom(0, 0.016, { ...idle, shotsFired: 1 })
    expect(next).toBeGreaterThan(0.1)
  })

  it('kicks harder for high-spread weapons', () => {
    const shotgun = stepBloom(0, 0.016, { ...idle, shotsFired: 1, weaponSpread: 0.15 })
    const awp = stepBloom(0, 0.016, { ...idle, shotsFired: 1, weaponSpread: 0.005 })
    expect(shotgun).toBeGreaterThan(awp)
  })

  it('recovers toward rest over time once idle', () => {
    let bloom = stepBloom(0, 0.016, { ...idle, shotsFired: 1 })
    for (let i = 0; i < 60; i++) bloom = stepBloom(bloom, 0.016, idle)
    expect(bloom).toBeLessThan(0.05)
  })

  it('never exceeds the maximum even under sustained fire', () => {
    let bloom = 0
    for (let i = 0; i < 200; i++) {
      bloom = stepBloom(bloom, 0.016, { moving: true, airborne: true, shotsFired: 1, weaponSpread: 0.15 })
    }
    expect(bloom).toBeLessThanOrEqual(2.2)
  })
})

describe('resolveCrosshair', () => {
  it('returns the global config for a weapon without an override', () => {
    const settings: CrosshairSettings = { global: DEFAULT_CROSSHAIR, perWeapon: {} }
    expect(resolveCrosshair(settings, 'ak')).toBe(DEFAULT_CROSSHAIR)
  })

  it('returns the per-weapon override when present', () => {
    const awpCross = { ...DEFAULT_CROSSHAIR, dot: true, style: 'static' as const }
    const settings: CrosshairSettings = { global: DEFAULT_CROSSHAIR, perWeapon: { awp: awpCross } }
    expect(resolveCrosshair(settings, 'awp')).toBe(awpCross)
    expect(resolveCrosshair(settings, 'ak')).toBe(DEFAULT_CROSSHAIR)
  })
})
