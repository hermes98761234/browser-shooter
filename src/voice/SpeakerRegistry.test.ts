import { describe, it, expect } from 'vitest'
import { SpeakerRegistry } from './SpeakerRegistry'

describe('SpeakerRegistry', () => {
  it('adds a speaker on start and lists it', () => {
    const r = new SpeakerRegistry()
    r.start('p1', 'Ann', 0)
    expect(r.list()).toEqual([{ playerId: 'p1', name: 'Ann' }])
  })

  it('removes a speaker on stop', () => {
    const r = new SpeakerRegistry()
    r.start('p1', 'Ann', 0)
    r.stop('p1')
    expect(r.list()).toEqual([])
  })

  it('refreshes lastSeen without duplicating or reordering', () => {
    const r = new SpeakerRegistry()
    r.start('p1', 'Ann', 0)
    r.start('p2', 'Bob', 0)
    r.start('p1', 'Ann', 5)
    expect(r.list().map(s => s.playerId)).toEqual(['p1', 'p2'])
  })

  it('prune drops entries older than ttl but keeps fresh ones', () => {
    const r = new SpeakerRegistry(1000)
    r.start('old', 'Old', 0)
    r.start('fresh', 'Fresh', 900)
    r.prune(1500)
    expect(r.list().map(s => s.playerId)).toEqual(['fresh'])
  })

  it('remove drops a speaker (disconnect)', () => {
    const r = new SpeakerRegistry()
    r.start('p1', 'Ann', 0)
    r.remove('p1')
    expect(r.size).toBe(0)
  })
})
