import { describe, it, expect, vi } from 'vitest'
import { NetClient } from './NetClient'
import type { Transport } from '../session/Transport'
import type { NetMessage } from '../session/protocol'

function fakeTransport() {
  let handler: ((m: NetMessage) => void) | null = null
  const closeCbs: (() => void)[] = []
  const sent: NetMessage[] = []
  const t: Transport = {
    send: (m: NetMessage) => { sent.push(m) },
    onMessage: (cb: (m: NetMessage) => void) => { handler = cb },
    onClose: (cb: () => void) => { closeCbs.push(cb) },
  } as unknown as Transport
  return { t, sent, deliver: (m: NetMessage) => handler?.(m) }
}

describe('NetClient voice', () => {
  it('routes voiceRoster, voiceStart, voiceStop to callbacks', () => {
    const { t, deliver } = fakeTransport()
    const client = new NetClient(t)
    const roster = vi.fn(); const start = vi.fn(); const stop = vi.fn()
    client.onVoiceRoster(roster); client.onVoiceStart(start); client.onVoiceStop(stop)
    deliver({ type: 'voiceRoster', teammates: [{ playerId: 'p1', peerId: 'peer1', name: 'Ann' }] })
    deliver({ type: 'voiceStart', playerId: 'p1', name: 'Ann' })
    deliver({ type: 'voiceStop', playerId: 'p1' })
    expect(roster).toHaveBeenCalledWith([{ playerId: 'p1', peerId: 'peer1', name: 'Ann' }])
    expect(start).toHaveBeenCalledWith('p1', 'Ann')
    expect(stop).toHaveBeenCalledWith('p1')
  })

  it('sends voiceStart / voiceStop over the transport', () => {
    const { t, sent } = fakeTransport()
    const client = new NetClient(t)
    client.sendVoiceStart('me', 'Me')
    client.sendVoiceStop('me')
    expect(sent).toContainEqual({ type: 'voiceStart', playerId: 'me', name: 'Me' })
    expect(sent).toContainEqual({ type: 'voiceStop', playerId: 'me' })
  })
})
