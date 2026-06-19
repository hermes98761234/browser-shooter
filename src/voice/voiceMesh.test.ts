import { describe, it, expect } from 'vitest'
import { shouldInitiate, reconcileMesh } from './voiceMesh'

describe('voiceMesh', () => {
  it('the lexicographically smaller peer id initiates', () => {
    expect(shouldInitiate('aaa', 'bbb')).toBe(true)
    expect(shouldInitiate('bbb', 'aaa')).toBe(false)
  })

  it('opens only initiator calls that are not yet connected', () => {
    // myPeerId 'm': initiate to 'z' (m<z) but not 'a' (m>a, they call us)
    const diff = reconcileMesh('m', [], ['z', 'a'])
    expect(diff.toOpen).toEqual(['z'])
    expect(diff.toClose).toEqual([])
  })

  it('does not reopen an already-connected teammate', () => {
    const diff = reconcileMesh('m', ['z'], ['z'])
    expect(diff.toOpen).toEqual([])
    expect(diff.toClose).toEqual([])
  })

  it('closes connections to ex-teammates', () => {
    const diff = reconcileMesh('m', ['z', 'old'], ['z'])
    expect(diff.toClose).toEqual(['old'])
  })
})
