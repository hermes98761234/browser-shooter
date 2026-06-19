/** Global, shared directory id on the public PeerJS broker. Bump the suffix to rotate. */
export const DIRECTORY_PEER_ID = 'browser-shooter-directory-v2'
/** A roster entry is dropped if it has not been refreshed within this window. */
export const ENTRY_TTL_MS = 15_000
/** Hosts re-announce themselves on this interval. */
export const HEARTBEAT_MS = 5_000

export type ServerStatus = 'lobby' | 'in-progress'
export type JoinPolicy = 'lobby' | 'free'

export interface DirectoryEntry {
  roomCode: string
  hostName: string
  players: number
  maxPlayers: number
  status: ServerStatus
  mode?: string
  joinPolicy?: JoinPolicy   // 'lobby' (default) | 'free'
  protected?: boolean       // true when a free game has a non-empty password
}

/** Messages carried on the directory channel (distinct from the game NetMessage protocol). */
export type DirMessage =
  | { type: 'register'; entry: DirectoryEntry }
  | { type: 'heartbeat'; roomCode: string; players: number; status: ServerStatus; mode?: string }
  | { type: 'unregister'; roomCode: string }
  | { type: 'listRequest' }
  | { type: 'listResponse'; entries: DirectoryEntry[] }
