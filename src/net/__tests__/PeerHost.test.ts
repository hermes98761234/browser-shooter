import { describe, it, expect, vi } from 'vitest'

const handlers: Record<string, ((arg: unknown) => void)[]> = {}
const fakePeer = {
  id: 'ROOM42',
  on: (event: string, cb: (arg: unknown) => void) => { (handlers[event] ??= []).push(cb) },
  destroy: vi.fn(),
}
vi.mock('peerjs', () => ({ default: vi.fn(() => fakePeer) }))

import { PeerHost } from '../PeerHost'

describe('PeerHost', () => {
  it('resolves a room code when the peer opens', async () => {
    const host = new PeerHost()
    const codePromise = host.start()
    handlers['open']?.forEach(h => h('ROOM42'))
    await expect(codePromise).resolves.toBe('ROOM42')
  })

  it('emits a transport for each incoming connection that opens', () => {
    const host = new PeerHost()
    host.start()
    handlers['open']?.forEach(h => h('ROOM42'))

    const got: unknown[] = []
    host.onClientConnect(t => got.push(t))

    const connHandlers: Record<string, ((a: unknown) => void)[]> = {}
    const fakeConn = { on: (e: string, cb: (a: unknown) => void) => { (connHandlers[e] ??= []).push(cb) }, send: vi.fn() }
    handlers['connection']?.forEach(h => h(fakeConn))
    connHandlers['open']?.forEach(h => h(undefined))

    expect(got).toHaveLength(1)
  })
})
