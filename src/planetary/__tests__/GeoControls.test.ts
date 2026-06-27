import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('maplibre-gl', () => ({}))

import { GeoControls } from '../GeoControls'

function makeMap(center = { lng: 0, lat: 0 }) {
  return {
    getCenter: vi.fn(() => center),
    setCenter: vi.fn((c: [number, number]) => { center.lng = c[0]; center.lat = c[1] }),
    setBearing: vi.fn(),
    setPitch: vi.fn(),
    getBearing: vi.fn(() => 0),
    getPitch: vi.fn(() => 60),
  }
}

describe('GeoControls', () => {
  let map: ReturnType<typeof makeMap>
  let container: HTMLElement
  let controls: GeoControls

  beforeEach(() => {
    map = makeMap()
    container = document.createElement('div')
    controls = new GeoControls(map as any, container)
    controls.attach()
  })

  it('moves north on KeyW press (bearing=0)', () => {
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    controls.update(1)
    expect(map.setCenter).toHaveBeenCalled()
    const [, lat] = map.setCenter.mock.calls[0][0]
    expect(lat).toBeGreaterThan(0)
  })

  it('clamps pitch to 85 max', () => {
    container.dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: -10000, bubbles: true }))
    expect(controls.getPitch()).toBeLessThanOrEqual(85)
  })

  it('clamps pitch to 0 min', () => {
    container.dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: 10000, bubbles: true }))
    expect(controls.getPitch()).toBeGreaterThanOrEqual(0)
  })

  it('detach stops responding to keydown', () => {
    controls.detach()
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    controls.update(1)
    expect(map.setCenter).not.toHaveBeenCalled()
  })
})
