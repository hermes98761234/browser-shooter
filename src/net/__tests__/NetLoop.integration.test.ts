import { describe, it, expect } from 'vitest'
import { GameSession } from '../../session/GameSession'
import { createLinkedTransports } from '../../session/Transport'
import { emptyInput } from '../../session/protocol'
import { NetHost } from '../NetHost'
import { NetClient } from '../NetClient'

describe('NetHost + NetClient integration', () => {
  it("a client's movement appears in the snapshot it receives", () => {
    const session = new GameSession()
    const host = new NetHost(session, 'coop')
    const [hostSide, clientSide] = createLinkedTransports()

    const client = new NetClient(clientSide)
    client.join('Bob')
    host.addClient('player-2', 'Bob', hostSide) // host assigns id after join (orchestrator does this live)
    expect(client.playerId).toBe('player-2')

    // Client presses forward for several authoritative ticks.
    for (let i = 0; i < 10; i++) {
      client.sendInput({ ...emptyInput(), forward: true })
      host.tick(1 / 30)
    }

    const me = client.latestSnapshot!.players.find(p => p.id === 'player-2')!
    expect(me.position.z).toBeLessThan(0) // moved forward (-Z) on the authoritative host
    expect(me.name).toBe('Bob')
  })
})
