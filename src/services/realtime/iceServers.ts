import type { TurnServerConfig } from 'trystero'
import { SELF_HOSTED_TURN } from './turnCredentials'

/**
 * ICE servers shared by all Trystero transports (room signaling + the public
 * room directory).
 *
 * Media and data always travel peer-to-peer over WebRTC: peers on the same
 * LAN/Wi-Fi connect directly through their host (mDNS/private) candidates and
 * never touch a server. STUN only reveals the public address when peers are
 * apart, so it is the workhorse for most calls. The TURN relay is used solely
 * when two networks refuse a direct path — see turnCredentials.ts.
 */
export const ICE_SERVERS: TurnServerConfig[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun.cloudflare.com:3478'] },
  { urls: ['stun:stun.nextcloud.com:443'] },
  ...(SELF_HOSTED_TURN ? [SELF_HOSTED_TURN] : []),
]
