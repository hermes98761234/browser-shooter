import { describe, it, expect } from 'vitest'
import { RespawnQueue } from './RespawnQueue'

describe('RespawnQueue', () => {
  it('emits an id once its timer elapses', () => {
    const q = new RespawnQueue()
    q.enqueue('p', 1)
    expect(q.update(0.5)).toEqual([])
    expect(q.isPending('p')).toBe(true)
    expect(q.update(0.6)).toEqual(['p'])
    expect(q.isPending('p')).toBe(false)
  })

  it('reports remaining time', () => {
    const q = new RespawnQueue()
    q.enqueue('p', 3)
    q.update(1)
    expect(q.remaining('p')).toBeCloseTo(2)
  })

  it('remove() drops a pending entry', () => {
    const q = new RespawnQueue()
    q.enqueue('p', 3)
    q.remove('p')
    expect(q.isPending('p')).toBe(false)
    expect(q.update(5)).toEqual([])
  })
})
