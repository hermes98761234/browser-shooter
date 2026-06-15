import { describe, it, expect, vi } from 'vitest'
import { PeerConnection } from '../PeerConnection'
import type { NetMessage } from '../../session/protocol'

function fakeConn() {
  const dataHandlers: ((d: unknown) => void)[] = []
  return {
    send: vi.fn(),
    on: (event: string, cb: (d: unknown) => void) => { if (event === 'data') dataHandlers.push(cb) },
    emitData: (d: unknown) => dataHandlers.forEach(h => h(d)),
  }
}

describe('PeerConnection', () => {
  it('send() forwards to conn.send', () => {
    const conn = fakeConn()
    const t = new PeerConnection(conn as any)
    const msg: NetMessage = { type: 'join', name: 'Ann' }
    t.send(msg)
    expect(conn.send).toHaveBeenCalledWith(msg)
  })

  it('onMessage() receives conn "data" events', () => {
    const conn = fakeConn()
    const t = new PeerConnection(conn as any)
    const got: NetMessage[] = []
    t.onMessage(m => got.push(m))
    conn.emitData({ type: 'welcome', playerId: 'player-2', mode: 'coop' })
    expect(got).toEqual([{ type: 'welcome', playerId: 'player-2', mode: 'coop' }])
  })
})
