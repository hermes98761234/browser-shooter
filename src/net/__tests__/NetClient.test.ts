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

    const snap: Snapshot = { tick: 5, seq: 0, ack: {}, players: [], enemies: [], events: [] }
    hostSide.send({ type: 'snapshot', snapshot: snap })
    expect(client.latestSnapshot?.tick).toBe(5)

    client.sendInput({ ...emptyInput(), shoot: true })
    const sentInput = hostGot.find(m => m.type === 'input')
    expect(sentInput).toBeDefined()
    expect((sentInput as any).playerId).toBe('player-2')
    expect((sentInput as any).input.shoot).toBe(true)
  })

  it('replies to a ping with a pong echoing the timestamp', () => {
    const [clientSide, hostSide] = createLinkedTransports()
    const hostGot: NetMessage[] = []
    hostSide.onMessage(m => hostGot.push(m))
    new NetClient(clientSide) // constructing wires up the message handler

    hostSide.send({ type: 'ping', t: 1234 })
    expect(hostGot).toContainEqual({ type: 'pong', t: 1234 })
  })

  it('tracks pending inputs and clears them on ack', () => {
    const [clientSide, hostSide] = createLinkedTransports()
    const client = new NetClient(clientSide)
    client.join('Ann')
    hostSide.send({ type: 'welcome', playerId: 'p2', mode: 'coop' })

    client.sendInput({ ...emptyInput(), forward: true, seq: 1, renderTime: 100 })
    client.sendInput({ ...emptyInput(), forward: true, seq: 2, renderTime: 110 })
    client.sendInput({ ...emptyInput(), forward: true, seq: 3, renderTime: 120 })

    hostSide.send({
      type: 'snapshot',
      snapshot: {
        tick: 1, seq: 1, ack: { p2: 2 }, events: [],
        players: [{ id: 'p2', kind: 'player', type: 'player', position: { x: 0, y: 2, z: -1 }, rotationY: 0, health: 100, isDead: false }],
        enemies: [],
      },
    })

    expect(client.latestSnapshot?.ack['p2']).toBe(2)
    expect(client.pendingInputCount).toBe(1)
  })

  it('calls event callback when snapshot contains events', () => {
    const [clientSide, hostSide] = createLinkedTransports()
    const client = new NetClient(clientSide)
    client.join('Ann')
    hostSide.send({ type: 'welcome', playerId: 'p2', mode: 'coop' })

    const events: any[] = []
    client.onEvent(ev => events.push(ev))

    hostSide.send({
      type: 'snapshot',
      snapshot: {
        tick: 1, seq: 1, ack: {}, events: [{ type: 'pickup', pickupType: 'health', value: 25, playerId: 'p2' }],
        players: [{ id: 'p2', kind: 'player', type: 'player', position: { x: 0, y: 2, z: 0 }, rotationY: 0, health: 100, isDead: false }],
        enemies: [],
      },
    })

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('pickup')
  })

  it('reconciles local player position to authoritative snapshot', () => {
    const [clientSide, hostSide] = createLinkedTransports()
    const client = new NetClient(clientSide)
    client.join('Ann')
    hostSide.send({ type: 'welcome', playerId: 'p2', mode: 'coop' })

    hostSide.send({
      type: 'snapshot',
      snapshot: {
        tick: 1, seq: 1, ack: {}, events: [],
        players: [{ id: 'p2', kind: 'player', type: 'player', position: { x: 5, y: 2, z: -3 }, rotationY: 1.2, health: 80, isDead: false }],
        enemies: [],
      },
    })

    const pos = client.getLocalPosition()
    expect(pos.x).toBe(5)
    expect(pos.z).toBe(-3)
    expect(client.getLocalRotation().y).toBe(1.2)
  })

  it('fills interpolation buffer for remote players', () => {
    const [clientSide, hostSide] = createLinkedTransports()
    const client = new NetClient(clientSide)
    client.join('Ann')
    hostSide.send({ type: 'welcome', playerId: 'p2', mode: 'coop' })

    hostSide.send({
      type: 'snapshot',
      snapshot: {
        tick: 1, seq: 1, ack: {}, events: [],
        players: [
          { id: 'p2', kind: 'player', type: 'player', position: { x: 0, y: 2, z: 0 }, rotationY: 0, health: 100, isDead: false },
          { id: 'p3', kind: 'player', type: 'player', position: { x: 1, y: 2, z: 1 }, rotationY: 0.5, health: 100, isDead: false },
        ],
        enemies: [],
      },
    })

    hostSide.send({
      type: 'snapshot',
      snapshot: {
        tick: 2, seq: 2, ack: {}, events: [],
        players: [
          { id: 'p2', kind: 'player', type: 'player', position: { x: 0, y: 2, z: 0 }, rotationY: 0, health: 100, isDead: false },
          { id: 'p3', kind: 'player', type: 'player', position: { x: 3, y: 2, z: 3 }, rotationY: 1.0, health: 100, isDead: false },
        ],
        enemies: [],
      },
    })

    const now = performance.now()
    const pos = client.getInterpolatedPosition('p3', now)
    expect(pos).not.toBeNull()
    expect(pos!.x).toBeGreaterThanOrEqual(1)
    expect(pos!.x).toBeLessThanOrEqual(3)
  })
})
