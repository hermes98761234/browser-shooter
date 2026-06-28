import { describe, it, expect, vi, beforeEach } from 'vitest'

import { GeoControls } from '../GeoControls'

describe('GeoControls', () => {
  let container: HTMLElement
  let controls: GeoControls

  beforeEach(() => {
    container = document.createElement('div')
    controls = new GeoControls(container)
    controls.attach()
  })

  function createMouseMoveEvent(movementX: number, movementY: number): MouseEvent {
    const event = new MouseEvent('mousemove', { bubbles: true })
    Object.defineProperty(event, 'movementX', { value: movementX })
    Object.defineProperty(event, 'movementY', { value: movementY })
    return event
  }

  it('reports forward on KeyW press', () => {
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    expect(controls.getInput().forward).toBe(true)
  })

  it('clamps pitch to max', () => {
    Object.defineProperty(document, 'pointerLockElement', {
      value: container,
      configurable: true,
    })
    container.dispatchEvent(createMouseMoveEvent(0, -10000))
    expect(controls.pitch).toBeLessThanOrEqual(Math.PI / 2)
  })

  it('clamps pitch to min', () => {
    Object.defineProperty(document, 'pointerLockElement', {
      value: container,
      configurable: true,
    })
    container.dispatchEvent(createMouseMoveEvent(0, 10000))
    expect(controls.pitch).toBeGreaterThanOrEqual(-Math.PI / 2)
  })

  it('detach stops responding to keydown', () => {
    controls.detach()
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    expect(controls.getInput().forward).toBe(false)
  })
})
