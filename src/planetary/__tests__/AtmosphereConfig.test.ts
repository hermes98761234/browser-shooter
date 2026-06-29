import { describe, it, expect } from 'vitest'
import { AtmosphereConfig } from '../AtmosphereConfig'

describe('AtmosphereConfig', () => {
  it('returns night state for elevation -0.2', () => {
    const cfg = new AtmosphereConfig()
    const s = cfg.update(-0.2)
    expect(s.sunIntensity).toBe(0)
    expect(s.fogColor.r).toBeLessThan(0.1)
  })

  it('returns bright state for elevation 0.5', () => {
    const cfg = new AtmosphereConfig()
    const s = cfg.update(0.5)
    expect(s.sunIntensity).toBeGreaterThan(1.0)
    expect(s.sunColor.r).toBeGreaterThan(0.9)
  })

  it('sunrise colors are warm (elevation 0.0)', () => {
    const cfg = new AtmosphereConfig()
    const s = cfg.update(0.0)
    expect(s.fogColor.r).toBeGreaterThan(0.5)
    expect(s.sunColor.r).toBeGreaterThan(0.5)
  })
})
