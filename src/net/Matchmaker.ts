import type { DirectoryClient } from './DirectoryClient'
import type { DirectoryEntry } from './directoryProtocol'

interface MatchPreferences {
  mode?: string
  maxPing?: number
}

export class Matchmaker {
  private queue: boolean = false

  async findMatch(
    client: DirectoryClient,
    preferences: MatchPreferences = {},
  ): Promise<DirectoryEntry | null> {
    this.queue = true

    try {
      const servers = await client.fetchList()

      const available = servers.filter((s) => {
        if (s.status !== 'lobby') return false
        if (s.players >= s.maxPlayers) return false
        if (preferences.mode && s.mode !== preferences.mode) return false
        return true
      })

      if (available.length === 0) return null

      // Sort by player count (prefer fuller servers for better games)
      available.sort((a, b) => b.players - a.players)

      return available[0]
    } finally {
      this.queue = false
    }
  }

  cancel(): void {
    this.queue = false
  }

  isQueued(): boolean {
    return this.queue
  }
}
