import { describe, it, expect, vi } from 'vitest'
import { LoopbackTransport, createLinkedTransports } from '../Transport'

describe('LoopbackTransport', () => {
  it('delivers sent messages to registered handlers', () => {
    const t = new LoopbackTransport()
    const handler = vi.fn()
    t.onMessage(handler)
    t.send({ type: 'input', playerId: 'p1', input: { forward: true } as any })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].playerId).toBe('p1')
  })

  it('supports multiple handlers', () => {
    const t = new LoopbackTransport()
    const a = vi.fn(); const b = vi.fn()
    t.onMessage(a); t.onMessage(b)
    t.send({ type: 'snapshot', snapshot: { tick: 0, seq: 0, ack: {}, players: [], enemies: [], grenades: [], events: [], scores: { teams: { ct: 0, t: 0 }, players: {}, matchOver: false, winningTeam: null } } })
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })
})

describe('createLinkedTransports', () => {
  it('delivers a.send to b only (no self-echo)', () => {
    const [a, b] = createLinkedTransports()
    const aGot: unknown[] = []
    const bGot: unknown[] = []
    a.onMessage(m => aGot.push(m))
    b.onMessage(m => bGot.push(m))

    a.send({ type: 'join', name: 'Ann' })
    expect(bGot).toEqual([{ type: 'join', name: 'Ann' }])
    expect(aGot).toEqual([])
  })
})

describe('Transport onClose', () => {
  it('LoopbackTransport fires onClose callbacks when close() is called', () => {
    const t = new LoopbackTransport()
    const cb = vi.fn()
    t.onClose(cb)
    t.close()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('linked transports notify their own close listeners when closed', () => {
    const [a, b] = createLinkedTransports()
    const aClosed = vi.fn(); const bClosed = vi.fn()
    a.onClose(aClosed); b.onClose(bClosed)
    a.close!()
    expect(aClosed).toHaveBeenCalledTimes(1)
    expect(bClosed).toHaveBeenCalledTimes(1)
  })
})
