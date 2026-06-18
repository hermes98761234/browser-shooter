import { describe, it, expect, vi } from 'vitest'
import { Matchmaker } from '../Matchmaker'

describe('Matchmaker', () => {
  it('can find a match', async () => {
    const matchmaker = new Matchmaker()
    const mockClient = {
      fetchList: vi.fn().mockResolvedValue([
        { roomCode: 'test', hostName: 'Test', players: 2, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
      ]),
    }
    const result = await matchmaker.findMatch(mockClient as any)
    expect(result).toBeDefined()
    expect(result!.roomCode).toBe('test')
  })

  it('returns null when no servers available', async () => {
    const matchmaker = new Matchmaker()
    const mockClient = {
      fetchList: vi.fn().mockResolvedValue([]),
    }
    const result = await matchmaker.findMatch(mockClient as any)
    expect(result).toBeNull()
  })

  it('skips full servers', async () => {
    const matchmaker = new Matchmaker()
    const mockClient = {
      fetchList: vi.fn().mockResolvedValue([
        { roomCode: 'full', hostName: 'Full', players: 8, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
        { roomCode: 'open', hostName: 'Open', players: 2, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
      ]),
    }
    const result = await matchmaker.findMatch(mockClient as any)
    expect(result).toBeDefined()
    expect(result!.roomCode).toBe('open')
  })

  it('skips in-progress servers', async () => {
    const matchmaker = new Matchmaker()
    const mockClient = {
      fetchList: vi.fn().mockResolvedValue([
        { roomCode: 'playing', hostName: 'Playing', players: 4, maxPlayers: 8, status: 'in-progress', mode: 'competitive' },
        { roomCode: 'lobby', hostName: 'Lobby', players: 2, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
      ]),
    }
    const result = await matchmaker.findMatch(mockClient as any)
    expect(result).toBeDefined()
    expect(result!.roomCode).toBe('lobby')
  })

  it('filters by mode preference', async () => {
    const matchmaker = new Matchmaker()
    const mockClient = {
      fetchList: vi.fn().mockResolvedValue([
        { roomCode: 'coop', hostName: 'Coop', players: 2, maxPlayers: 8, status: 'lobby', mode: 'coop' },
        { roomCode: 'comp', hostName: 'Comp', players: 2, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
      ]),
    }
    const result = await matchmaker.findMatch(mockClient as any, { mode: 'competitive' })
    expect(result).toBeDefined()
    expect(result!.roomCode).toBe('comp')
  })

  it('prefers fuller servers', async () => {
    const matchmaker = new Matchmaker()
    const mockClient = {
      fetchList: vi.fn().mockResolvedValue([
        { roomCode: 'empty', hostName: 'Empty', players: 1, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
        { roomCode: 'fuller', hostName: 'Fuller', players: 6, maxPlayers: 8, status: 'lobby', mode: 'competitive' },
      ]),
    }
    const result = await matchmaker.findMatch(mockClient as any)
    expect(result).toBeDefined()
    expect(result!.roomCode).toBe('fuller')
  })

  it('cancel sets isQueued to false', () => {
    const matchmaker = new Matchmaker()
    matchmaker.cancel()
    expect(matchmaker.isQueued()).toBe(false)
  })
})
