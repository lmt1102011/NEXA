import type { ActivityTask, ChatMessage, ID, JoinRequest, Participant, Poll, RoomSettings, RoomTimer, TodoItem } from '@/types'
import type { RoomSettingsPatch } from '@/lib/defaults'

export type RoomEvent =
  | { type: 'peer-hello'; participant: Participant }
  | { type: 'peer-ack'; participant: Participant }
  | { type: 'peer-update'; participantId: ID; patch: Partial<Participant>; senderId?: ID }
  | { type: 'peer-leave'; participantId: ID }
  | { type: 'heartbeat'; participantId: ID; participant: Participant }
  | { type: 'chat'; message: ChatMessage; senderId?: ID }
  | { type: 'pin'; message: ChatMessage | null; senderId?: ID }
  | {
      type: 'activity'
      polls: Poll[]
      tasks: ActivityTask[]
      todos: TodoItem[]
      timer: RoomTimer | null
      senderId?: ID
    }
  | { type: 'reaction'; messageId: ID; emoji: string; userId: ID; senderId?: ID }
  | { type: 'hand'; participantId: ID; raised: boolean; senderId?: ID }
  | { type: 'float'; emoji: string; participantId: ID; name: string; senderId?: ID }
  | { type: 'typing'; participantId: ID; name: string; typing: boolean; senderId?: ID }
  | { type: 'request'; request: JoinRequest }
  | {
      type: 'snapshot'
      messages: ChatMessage[]
      pinned: ChatMessage | null
      polls: Poll[]
      tasks: ActivityTask[]
      todos: TodoItem[]
      timer: RoomTimer | null
      settings: RoomSettings
      senderId?: ID
    }
  | { type: 'request-resolved'; requestId: ID; participantId: ID; accepted: boolean; senderId?: ID }
  | { type: 'settings'; patch: RoomSettingsPatch; senderId?: ID }
  | { type: 'kick'; participantId: ID; senderId?: ID }
  | { type: 'name-taken'; participantId: ID; name: string; senderId?: ID }
  | { type: 'host-transfer'; token: string; to: ID; senderId?: ID }
  | { type: 'end'; senderId?: ID }

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
  setVideoMaxBitrate: (kbps: number | null) => void
  setAudioMaxBitrate: (kbps: number | null) => void
  measureStats: () => Promise<StatsSample | null>
  disconnect: () => void
  forcePeerLeave: (participantId: ID) => void
  emit: (event: RoomEvent) => void
  /** Sends an event to a single participant's peer connection (never broadcast). */
  sendTarget: (event: RoomEvent, participantId: ID) => void
  on: (listener: RoomEventListener) => () => void
  onRemoteStream: (listener: RemoteStreamListener) => () => void
  dispose: () => void
}