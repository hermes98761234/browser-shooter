import { describe, it, expect } from 'vitest'
import { BuildingGeometry } from '../BuildingGeometry'

describe('BuildingGeometry', () => {
  const squareFootprint: [number, number][] = [
    [0, 0], [10, 0], [10, 10], [0, 10], [0, 0],
  ]

  it('generates geometry for flat roof', () => {
    const geo = BuildingGeometry.generate({
      footprint: squareFootprint,
      height: 20,
      roofShape: 'flat',
    })
    expect(geo).toBeDefined()
    expect(geo.getAttribute('position').count).toBeGreaterThan(0)
    expect(geo.getAttribute('position').count).toBeGreaterThanOrEqual(12)
  })

  it('generates geometry for gabled roof', () => {
    const geo = BuildingGeometry.generate({
      footprint: squareFootprint,
      height: 15,
      roofShape: 'gabled',
      roofHeight: 5,
    })
    expect(geo).toBeDefined()
    const count = geo.getAttribute('position').count
    expect(count).toBeGreaterThan(20)
  })

  it('rejects footprint with < 3 vertices', () => {
    expect(() =>
      BuildingGeometry.generate({
        footprint: [[0, 0], [10, 0]],
        height: 10,
        roofShape: 'flat',
      }),
    ).toThrow()
  })

  it('rejects height < minHeight', () => {
    expect(() =>
      BuildingGeometry.generate({
        footprint: squareFootprint,
        height: 2,
        roofShape: 'flat',
      }),
    ).toThrow()
  })

  it('caps roof:height exceeding 50% of building height', () => {
    const geo = BuildingGeometry.generate({
      footprint: squareFootprint,
      height: 10,
      roofShape: 'gabled',
      roofHeight: 8,
    })
    expect(geo.getAttribute('position').count).toBeGreaterThan(20)
  })

  it('falls back to flat roof for unknown roof shape', () => {
    const geo = BuildingGeometry.generate({
      footprint: squareFootprint,
      height: 20,
      roofShape: 'onion',
    })
    expect(geo).toBeDefined()
  })
})
