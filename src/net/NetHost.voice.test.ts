import { describe, it, expect, vi } from 'vitest'
import { NetHost } from './NetHost'
import { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { NetMessage, VoiceRosterEntry } from '../session/protocol'

function fakeTransport() {
  let handler: ((m: NetMessage) => void) | null = null
  const sent: NetMessage[] = []
  const t: Transport = {
    send: (m: NetMessage) => { sent.push(m) },
    onMessage: (cb: (m: NetMessage) => void) => { handler = cb },
  } as unknown as Transport
  return { t, sent, deliver: (m: NetMessage) => handler?.(m) }
}

// Host 'host' on ct (peer 'peerHost'), client p1 on ct (peer 'peer1'), client p2 on t (peer 'peer2').
function threeWay() {
  const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
  const host = new NetHost(session, session.config)
  host.setHostVoice(session.localId, 'peerHost')
  const c1 = fakeTransport()
  const c2 = fakeTransport()
  host.addClient('p1', 'Ann', c1.t, 'ct', 'peer1')
  host.addClient('p2', 'Bob', c2.t, 't', 'peer2')
  return { session, host, c1, c2 }
}

describe('NetHost voice', () => {
  it('sends each client a team-scoped roster', () => {
    const { host, c1, c2 } = threeWay()
    c1.sent.length = 0; c2.sent.length = 0
    host.refreshVoiceRoster()
    const r1 = c1.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    // p1 (ct) sees only the host (ct), not p2 (t)
    expect(r1.teammates.map(e => e.peerId)).toEqual(['peerHost'])
    const r2 = c2.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    expect(r2.teammates).toEqual([]) // p2 (t) has no teammates
  })

  it('gives the host its own team-scoped roster via onHostRoster', () => {
    const { host } = threeWay()
    const rosters: VoiceRosterEntry[][] = []
    host.onHostRoster((r) => rosters.push(r))
    host.refreshVoiceRoster()
    const last = rosters[rosters.length - 1]
    expect(last.map(e => e.peerId)).toEqual(['peer1']) // host (ct) sees p1 (ct)
  })

  it('relays a client voiceStart only to same-team links', () => {
    const { c1, c2 } = threeWay()
    c1.sent.length = 0; c2.sent.length = 0
    // p1 (ct) talks → no other ct *client* exists, so no client receives it
    c1.deliver({ type: 'voiceStart', playerId: 'p1', name: 'Ann' })
    expect(c2.sent.find(m => m.type === 'voiceStart')).toBeUndefined()
  })

  it('invokes onRemoteVoiceStart when a same-team client talks', () => {
    const { host, c1 } = threeWay()
    const start = vi.fn()
    host.onRemoteVoiceStart(start)
    c1.deliver({ type: 'voiceStart', playerId: 'p1', name: 'Ann' }) // p1 ct, host ct
    expect(start).toHaveBeenCalledWith('p1', 'Ann')
  })

  it('relays host localVoiceStart to same-team client links', () => {
    const { host, c1, c2 } = threeWay()
    c1.sent.length = 0; c2.sent.length = 0
    host.localVoiceStart()
    expect(c1.sent.find(m => m.type === 'voiceStart')).toBeDefined() // p1 ct
    expect(c2.sent.find(m => m.type === 'voiceStart')).toBeUndefined() // p2 t
  })
})
