import { describe, it, expect } from 'vitest'
import { NetClient } from './NetClient'
import type { NetMessage } from '../session/protocol'
import type { Transport } from '../session/Transport'

function fakeTransport() {
  let handler: ((m: NetMessage) => void) | null = null
  const t: Transport = {
    send: () => {},
    onMessage: (cb: (m: NetMessage) => void) => { handler = cb },
    onClose: () => {},
  } as unknown as Transport
  return { t, deliver: (m: NetMessage) => handler?.(m) }
}

describe('NetClient PvP', () => {
  it('stores match config from welcome', () => {
    const { t, deliver } = fakeTransport()
    const c = new NetClient(t)
    deliver({ type: 'welcome', playerId: 'p1', mode: 'pvp', config: { mode: 'pvp', damagePolicy: 'ffa', fragLimit: 5 }, players: [], started: false })
    expect(c.config).toEqual({ mode: 'pvp', damagePolicy: 'ffa', fragLimit: 5 })
    expect(c.mode).toBe('pvp')
  })

  it('fires onStart when the host starts the match', () => {
    const { t, deliver } = fakeTransport()
    const c = new NetClient(t)
    let started = false
    c.onStart(() => { started = true })
    deliver({ type: 'start' })
    expect(started).toBe(true)
  })

  it('fires onChat when a chat message arrives', () => {
    const { t, deliver } = fakeTransport()
    const c = new NetClient(t)
    const got: NetMessage[] = []
    c.onChat((msg) => got.push(msg))
    deliver({ type: 'chat', playerId: 'p2', name: 'Bob', team: 'ct', scope: 'all', text: 'hello' })
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({ type: 'chat', name: 'Bob', scope: 'all', text: 'hello' })
  })
})
