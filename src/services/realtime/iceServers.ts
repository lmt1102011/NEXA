import type { TurnServerConfig } from 'trystero'

/**
 * ICE servers shared by all Trystero transports (room signaling + the public
 * room directory).
 *
 * Media and data always travel peer-to-peer over WebRTC: peers on the same
 * LAN/Wi-Fi connect directly through their host (mDNS/private) candidates and
 * never touch a server. STUN only reveals the public address when peers are
 * apart, and the TURN relay below is a strict fallback for peers behind
 * symmetric NAT/CGNAT that cannot connect directly — it is unused whenever a
 * direct path exists, so same-network calls stay fully local.
 */
export const ICE_SERVERS: TurnServerConfig[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun.cloudflare.com:3478'] },
  { urls: ['stun:openrelay.metered.ca:80'] },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]