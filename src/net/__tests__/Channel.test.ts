import { describe, it, expect, vi } from 'vitest'
import { createLinkedChannels, PeerChannel } from '../Channel'

type Msg = { type: 'hi'; n: number }

describe('createLinkedChannels', () => {
  it('delivers a message sent on one end to the other end only', () => {
    const [a, b] = createLinkedChannels<Msg>()
    const onA = vi.fn(); const onB = vi.fn()
    a.onMessage(onA); b.onMessage(onB)
    a.send({ type: 'hi', n: 1 })
    expect(onB).toHaveBeenCalledWith({ type: 'hi', n: 1 })
    expect(onA).not.toHaveBeenCalled()
  })

  it('fires onClose handlers on both ends when either end closes', () => {
    const [a, b] = createLinkedChannels<Msg>()
    const closeA = vi.fn(); const closeB = vi.fn()
    a.onClose(closeA); b.onClose(closeB)
    a.close()
    expect(closeA).toHaveBeenCalled()
    expect(closeB).toHaveBeenCalled()
  })
})

describe('PeerChannel', () => {
  it('wraps a DataConnection: send forwards, data/close register handlers', () => {
    const conn: Record<string, unknown> = {}
    const on = vi.fn((e: string, cb: (a: unknown) => void) => { conn[e] = cb })
    const fakeConn = { send: vi.fn(), close: vi.fn(), on } as never
    const ch = new PeerChannel<Msg>(fakeConn)
    const onMsg = vi.fn(); ch.onMessage(onMsg)
    ;(conn['data'] as (a: unknown) => void)({ type: 'hi', n: 2 })
    expect(onMsg).toHaveBeenCalledWith({ type: 'hi', n: 2 })
    ch.send({ type: 'hi', n: 3 })
    expect((fakeConn as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledWith({ type: 'hi', n: 3 })
  })
})
