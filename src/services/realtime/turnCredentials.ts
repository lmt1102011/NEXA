import type { TurnServerConfig } from 'trystero'

/**
 * Your self-hosted TURN relay — the last-resort path for peers whose networks
 * refuse a direct connection (symmetric NAT/CGNAT, strict corporate firewalls).
 *
 * Public free TURN servers are effectively gone, and the app is serverless, so
 * a call that cannot go peer-to-peer needs a relay you control. Stand one up
 * with `deploy/coturn/setup-coturn.sh` and paste the block it prints below.
 *
 * While this is null the app still calls over STUN + direct P2P, which covers
 * peers on the same network and behind cone NAT — everything except the two
 * restrictive networks meeting each other.
 */
export const SELF_HOSTED_TURN: TurnServerConfig | null = null
