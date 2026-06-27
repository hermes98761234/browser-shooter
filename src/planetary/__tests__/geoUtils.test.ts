import { describe, it, expect } from 'vitest'
import { offsetLngLat, lngLatDistance, medianLngLat } from '../geoUtils'

describe('offsetLngLat', () => {
  it('moves north by 111320m ≈ 1 degree lat', () => {
    const [lng, lat] = offsetLngLat(0, 0, 0, 111320)
    expect(lat).toBeCloseTo(1, 1)
    expect(lng).toBeCloseTo(0, 3)
  })

  it('moves east at equator by 111320m ≈ 1 degree lng', () => {
    const [lng, lat] = offsetLngLat(0, 0, 111320, 0)
    expect(lng).toBeCloseTo(1, 1)
    expect(lat).toBeCloseTo(0, 3)
  })

  it('east offset shrinks with latitude (cos factor)', () => {
    const [lng60] = offsetLngLat(0, 60, 111320, 0)
    expect(lng60).toBeGreaterThan(1.5)  // cos(60°)=0.5 so 2x the degrees
  })
})

describe('lngLatDistance', () => {
  it('same point = 0', () => {
    expect(lngLatDistance(10, 20, 10, 20)).toBe(0)
  })

  it('1 degree lat ≈ 111320m', () => {
    expect(lngLatDistance(0, 0, 0, 1)).toBeCloseTo(111320, -2)
  })
})

describe('medianLngLat', () => {
  it('median of two points is midpoint', () => {
    const [lng, lat] = medianLngLat([[0, 0], [2, 4]])
    expect(lng).toBeCloseTo(1)
    expect(lat).toBeCloseTo(2)
  })

  it('single point returns itself', () => {
    const [lng, lat] = medianLngLat([[5, 10]])
    expect(lng).toBe(5)
    expect(lat).toBe(10)
  })
})
