import { describe, it, expect } from 'vitest'
import { createLinkedTransports } from '../../session/Transport'
import { emptyInput, type NetMessage, type Snapshot } from '../../session/protocol'
import { NetClient } from '../NetClient'

describe('NetClient', () => {
  it('join sends a join message and welcome sets playerId', () => {
    const [clientSide, hostSide] = createLinkedTransports()
    const hostGot: NetMessage[] = []
    hostSide.onMessage(m => hostGot.push(m))

    const client = new NetClient(clientSide)
    client.join('Ann')
    expect(hostGot).toContainEqual({ type: 'join', name: 'Ann' })

    hostSide.send({ type: 'welcome', playerId: 'player-2', mode: 'coop' })
    expect(client.playerId).toBe('player-2')
    expect(client.mode).toBe('coop')
  })

  it('stores the latest snapshot and tags input with playerId', () => {
    const [clientSide, hostSide] = createLinkedTransports()
    const hostGot: NetMessage[] = []
    hostSide.onMessage(m => hostGot.push(m))
    const client = new NetClient(clientSide)
    client.join('Ann')
    hostSide.send({ type: 'welcome', playerId: 'player-2', mode: 'coop' })

    const snap: Snapshot = { tick: 5, players: [], enemies: [] }
    hostSide.send({ type: 'snapshot', snapshot: snap })
    expect(client.latestSnapshot?.tick).toBe(5)

    client.sendInput({ ...emptyInput(), shoot: true })
    expect(hostGot).toContainEqual({ type: 'input', playerId: 'player-2', input: { ...emptyInput(), shoot: true } })
  })

  it('replies to a ping with a pong echoing the timestamp', () => {
    const [clientSide, hostSide] = createLinkedTransports()
    const hostGot: NetMessage[] = []
    hostSide.onMessage(m => hostGot.push(m))
    new NetClient(clientSide) // constructing wires up the message handler

    hostSide.send({ type: 'ping', t: 1234 })
    expect(hostGot).toContainEqual({ type: 'pong', t: 1234 })
  })
})
