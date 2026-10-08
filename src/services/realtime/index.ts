import type { RealtimeService } from './types'
import { TrysteroRealtimeService } from './trysteroRealtime'

/**
 * Transport factory. The Trystero service runs entirely in the browser:
 * signaling over public Nostr relays, media peer-to-peer via WebRTC — no
 * application server needed.
 */
export function createRealtimeService(): RealtimeService {
  return new TrysteroRealtimeService()
}

export type { RealtimeService, RoomEvent, RoomEventListener, RemoteStreamListener, StatsSample } from './types'