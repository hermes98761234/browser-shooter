import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Controls } from '../Controls'

// jsdom doesn't implement pointer lock APIs — mock them globally
if (!(document as any).exitPointerLock) {
  (document as any).exitPointerLock = vi.fn()
}

function createMockElement(): HTMLElement {
  const el = document.createElement('canvas')
  // jsdom doesn't implement requestPointerLock, add a mock
  ;(el as any).requestPointerLock = vi.fn()
  return el
}

describe('Controls', () => {
  let element: HTMLElement
  let controls: Controls

  beforeEach(() => {
    element = createMockElement()
    controls = new Controls(element, () => 'playing')
  })

  afterEach(() => {
    controls.destroy()
    vi.restoreAllMocks()
  })

  it('initializes with all inputs false', () => {
    expect(controls.forward).toBe(false)
    expect(controls.backward).toBe(false)
    expect(controls.left).toBe(false)
    expect(controls.right).toBe(false)
    expect(controls.jump).toBe(false)
    expect(controls.shoot).toBe(false)
  })

  it('sets forward on KeyW down', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    expect(controls.forward).toBe(true)
  })

  it('clears forward on KeyW up', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
    expect(controls.forward).toBe(false)
  })

  it('sets backward on KeyS', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }))
    expect(controls.backward).toBe(true)
  })

  it('sets left on KeyA', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
    expect(controls.left).toBe(true)
  })

  it('sets right on KeyD', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
    expect(controls.right).toBe(true)
  })

  it('sets jump on Space', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    expect(controls.jump).toBe(true)
  })

  it('clears jump on Space up', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    expect(controls.jump).toBe(false)
  })

  it('sets shoot on left mouse down', () => {
    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    expect(controls.shoot).toBe(true)
  })

  it('clears shoot on left mouse up', () => {
    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    document.dispatchEvent(new MouseEvent('mouseup', { button: 0 }))
    expect(controls.shoot).toBe(false)
  })

  it('does not set shoot on right mouse button', () => {
    document.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
    expect(controls.shoot).toBe(false)
  })

  it('requests pointer lock on mouse click', () => {
    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    expect((element as any).requestPointerLock).toHaveBeenCalled()
  })

  it('does not request pointer lock when gameState is not playing', () => {
    controls.destroy()
    const el2 = createMockElement()
    const paused = new Controls(el2, () => 'paused')
    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    expect((el2 as any).requestPointerLock).not.toHaveBeenCalled()
    paused.destroy()
  })

  it('does not request pointer lock if already locked', () => {
    Object.defineProperty(document, 'pointerLockElement', {
      value: element,
      configurable: true,
    })
    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    expect((element as any).requestPointerLock).not.toHaveBeenCalled()
  })

  it('returns movement state via getMovement()', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))

    const movement = controls.getMovement()
    expect(movement.forward).toBe(true)
    expect(movement.backward).toBe(false)
    expect(movement.left).toBe(false)
    expect(movement.right).toBe(true)
    expect(movement.jump).toBe(true)
  })

  it('handles multiple simultaneous keys', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
    expect(controls.forward).toBe(true)
    expect(controls.left).toBe(true)
  })

  it('ignores unrelated key codes', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }))
    expect(controls.forward).toBe(false)
    expect(controls.backward).toBe(false)
    expect(controls.left).toBe(false)
    expect(controls.right).toBe(false)
    expect(controls.jump).toBe(false)
  })

  it('calls onMouseMove when pointer is locked and mouse moves', () => {
    const handler = vi.fn()
    controls.onMouseMove = handler

    Object.defineProperty(document, 'pointerLockElement', {
      value: element,
      configurable: true,
    })

    const moveEvent = new MouseEvent('mousemove', { movementX: 5, movementY: -3 })
    document.dispatchEvent(moveEvent)
    expect(handler).toHaveBeenCalledWith(moveEvent)
  })

  it('does not call onMouseMove when pointer is not locked', () => {
    const handler = vi.fn()
    controls.onMouseMove = handler

    Object.defineProperty(document, 'pointerLockElement', {
      value: null,
      configurable: true,
    })

    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 5 }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not call onMouseMove when handler is null', () => {
    controls.onMouseMove = null

    Object.defineProperty(document, 'pointerLockElement', {
      value: element,
      configurable: true,
    })

    // Should not throw
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 5 }))
  })

  it('cleans up event listeners on destroy', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    controls.destroy()
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('keyup', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
  })
})
