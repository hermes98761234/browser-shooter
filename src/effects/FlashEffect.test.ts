import { describe, it, expect } from 'vitest'
import { createFlashEffect, triggerFlash, updateFlash } from './FlashEffect'

describe('FlashEffect', () => {
  it('starts inactive', () => {
    const s = createFlashEffect()
    expect(s.active).toBe(false)
    expect(s.opacity).toBe(0)
  })

  it('triggering blinds at full opacity for the given duration', () => {
    const s = triggerFlash(createFlashEffect(), 5)
    expect(s.active).toBe(true)
    expect(s.opacity).toBe(1)
    expect(s.duration).toBe(5)
  })

  it('stays fully blinding before the fade-out begins', () => {
    let s = triggerFlash(createFlashEffect(), 5)
    s = updateFlash(s, 1) // 1s < fadeStart (5 * 0.3 = 1.5s)
    expect(s.active).toBe(true)
    expect(s.opacity).toBe(1)
  })

  it('fades out and clears once the duration elapses', () => {
    let s = triggerFlash(createFlashEffect(), 2)
    s = updateFlash(s, 2)
    expect(s.active).toBe(false)
    expect(s.opacity).toBe(0)
  })

  it('is a no-op when not active', () => {
    const s = updateFlash(createFlashEffect(), 1)
    expect(s.active).toBe(false)
  })
})
