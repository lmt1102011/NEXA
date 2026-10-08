import type { TurnServerConfig } from 'trystero'

/**
 * ICE servers shared by all Trystero transports (room signaling + the public
 * room directory): Google STUN for direct peer-to-peer plus a free TURN relay
 * (openrelay.metered.ca) so peers behind strict/symmetric NAT and CGNAT can
 * still exchange data channels.
 */
export const ICE_SERVERS: TurnServerConfig[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
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