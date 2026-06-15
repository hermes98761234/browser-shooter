import { describe, it, expect } from 'vitest'
import { emptyInput } from '../protocol'

describe('protocol', () => {
  it('emptyInput has all controls cleared', () => {
    const input = emptyInput()
    expect(input.forward).toBe(false)
    expect(input.shoot).toBe(false)
    expect(input.yaw).toBe(0)
    expect(input.pitch).toBe(0)
  })
})

import { GAME_MODES } from '../protocol'

describe('GameMode', () => {
  it('lists coop and pvp', () => {
    expect(GAME_MODES).toEqual(['coop', 'pvp'])
  })
})
