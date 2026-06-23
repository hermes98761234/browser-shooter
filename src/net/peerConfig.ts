import Peer, { type PeerOptions } from 'peerjs'

/**
 * Where PeerJS connects to broker/signal. By default (no env set) we use the
 * public `0.peerjs.com` cloud broker, which is rate-limited and can temporarily
 * IP-ban heavy users (Cloudflare 1015). Set VITE_PEER_* to point at a broker you
 * control (see `npm run peerserver`) and the rate limit goes away.
 *
 * VITE_PEER_ICE controls NAT traversal (STUN/TURN). Without it PeerJS falls back
 * to its bundled defaults, which relay through peerjs.com's public TURN — the same
 * flaky infra. For reliable cross-machine play, point this at your own coturn:
 *   VITE_PEER_ICE='[{"urls":"stun:of-it.pp.ua:3478"},
 *                   {"urls":"turn:of-it.pp.ua:3478","username":"u","credential":"p"}]'
 */
export interface PeerEnv {
  VITE_PEER_HOST?: string
  VITE_PEER_PORT?: string
  VITE_PEER_PATH?: string
  VITE_PEER_SECURE?: string
  VITE_PEER_KEY?: string
  VITE_PEER_ICE?: string
}

/** Parse the VITE_PEER_ICE JSON into an iceServers array; undefined if unset/invalid. */
function parseIceServers(raw?: string): RTCIceServer[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as RTCIceServer[]) : undefined
  } catch {
    console.warn('VITE_PEER_ICE is not valid JSON; falling back to default ICE servers')
    return undefined
  }
}

/**
 * Build PeerJS connection options from env vars. Returns undefined when neither a
 * custom broker host nor custom ICE servers are configured, so callers fall back to
 * PeerJS's defaults.
 */
export function buildPeerOptions(env: PeerEnv): PeerOptions | undefined {
  const iceServers = parseIceServers(env.VITE_PEER_ICE)
  if (!env.VITE_PEER_HOST && !iceServers) return undefined
  const opts: PeerOptions = {}
  if (env.VITE_PEER_HOST) {
    opts.host = env.VITE_PEER_HOST
    opts.secure = env.VITE_PEER_SECURE === 'true'
    if (env.VITE_PEER_PORT) opts.port = Number(env.VITE_PEER_PORT)
    if (env.VITE_PEER_PATH) opts.path = env.VITE_PEER_PATH
    if (env.VITE_PEER_KEY) opts.key = env.VITE_PEER_KEY
  }
  if (iceServers) opts.config = { iceServers }
  return opts
}

/** Options resolved once from the build-time env; undefined => default public broker. */
const PEER_OPTIONS = buildPeerOptions(import.meta.env as unknown as PeerEnv)

/** Construct a Peer wired to the configured broker. Pass an id to claim a fixed id. */
export function createPeer(id?: string): Peer {
  return new Peer(id as string, PEER_OPTIONS)
}
