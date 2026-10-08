import type { ChatMessage, ID, JoinRequest, Participant } from '@/types'
import type { RoomSettingsPatch } from '@/lib/defaults'

export type RoomEvent =
  | { type: 'peer-hello'; participant: Participant }
  | { type: 'peer-ack'; participant: Participant }
  | { type: 'peer-update'; participantId: ID; patch: Partial<Participant> }
  | { type: 'peer-leave'; participantId: ID }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'reaction'; messageId: ID; emoji: string; userId: ID }
  | { type: 'request'; request: JoinRequest }
  | { type: 'request-resolved'; requestId: ID; participantId: ID; accepted: boolean }
  | { type: 'settings'; patch: RoomSettingsPatch }
  | { type: 'kick'; participantId: ID }
  | { type: 'name-taken'; participantId: ID; name: string }
  | { type: 'end' }

export type RoomEventListener = (event: RoomEvent) => void
export type RemoteStreamListener = (stream: MediaStream | null, peerId: string) => void
export type StatsSample = {
  ping: number
  jitter: number
  loss: number
  bitrate: number
}

/**
 * Real-time transport contract. The default implementation is the Trystero
 * WebRTC service (see trysteroRealtime.ts) — serverless signaling over public
 * Nostr relays, peer-to-peer media over RTCPeerConnection.
 */
export interface RealtimeService {
  readonly kind: 'trystero'
  connect: (roomId: ID, self: Participant) => void
  announce: () => void
  updateSelf: (self: Participant) => void
  sendStream: (stream: MediaStream | null) => void
  measureStats: () => Promise<StatsSample | null>
  disconnect: () => void
  emit: (event: RoomEvent) => void
  on: (listener: RoomEventListener) => () => void
  onRemoteStream: (listener: RemoteStreamListener) => () => void
  dispose: () => void
}