import { describe, it, expect } from 'vitest'
import { DEFAULT_KEYMAP } from '../Settings'

describe('DEFAULT_KEYMAP', () => {
  it('has toggleVideo bound to KeyV', () => {
    expect(DEFAULT_KEYMAP.toggleVideo).toBe('KeyV')
  })
})
