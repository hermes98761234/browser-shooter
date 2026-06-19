import { describe, it, expect } from 'vitest'
import { DIRECTORY_PEER_ID, ENTRY_TTL_MS, HEARTBEAT_MS } from '../directoryProtocol'

describe('directoryProtocol constants', () => {
  it('exposes a versioned directory id and TTL longer than the heartbeat', () => {
    expect(DIRECTORY_PEER_ID).toMatch(/^browser-shooter-directory-v\d+$/)
    expect(HEARTBEAT_MS).toBe(5_000)
    expect(ENTRY_TTL_MS).toBeGreaterThan(HEARTBEAT_MS)
  })
})
