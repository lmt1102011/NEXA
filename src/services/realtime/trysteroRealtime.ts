import { joinRoom, type DataPayload, type MessageAction, type Room } from 'trystero'
import { ICE_SERVERS } from './iceServers'
import type { ID, Participant } from '@/types'
import type {
  RealtimeService,
  RemoteStreamListener,
  RoomEvent,
  RoomEventListener,
  StatsSample,
} from './types'

const APP_ID = 'nexa-call-v2'

const EVENT_TYPES = [
  'peer-hello',
  'peer-ack',
  'peer-update',
  'peer-leave',
  'chat',
  'reaction',
  'request',
  'request-resolved',
  'settings',
  'kick',
  'name-taken',
  'end',
] as const

type EventType = (typeof EVENT_TYPES)[number]

interface StatsBucket {
  at: number
  rxPackets: number
  rxLost: number
  txBytes: number
}

/**
 * Serverless WebRTC transport built on Trystero. Peers discover each other
 * over public Nostr relays and exchange data + media directly over
 * RTCPeerConnection. Participant presence/chat state flows through trystero
 * actions ("nexa:<event>") while audio/video uses WebRTC media streams.
 */
export class TrysteroRealtimeService implements RealtimeService {
  readonly kind = 'trystero' as const

  private room: Room | null = null
  private roomId: ID | null = null
  private self: Participant | null = null
  private announced = false
  private sentStream: MediaStream | null = null
  private actions = new Map<EventType, MessageAction<DataPayload>>()
  private listeners = new Set<RoomEventListener>()
  private streamListeners = new Set<RemoteStreamListener>()
  private peerByParticipant = new Map<ID, string>()
  private participantByPeer = new Map<string, ID>()
  private statsPrev: StatsBucket | null = null
  private senders: Partial<Record<EventType, (event: RoomEvent) => void>> = {}
  private pendingStream: MediaStream | null = null

  connect(roomId: ID, self: Participant) {
    if (this.room && this.roomId === roomId) {
      this.self = self
      return
    }
    this.disconnect()
    this.roomId = roomId
    this.self = self
    this.announced = false

    const room = joinRoom(
      { appId: APP_ID, trickleIce: true, turnConfig: ICE_SERVERS },
      roomId,
      { onJoinError: () => {} },
    )
    this.room = room

    for (const type of EVENT_TYPES) {
      this.actions.set(type, room.makeAction<DataPayload>(`nexa:${type}`, {
        onMessage: (data, context) => this.handleMessage(data as unknown as RoomEvent, context.peerId),
      }))
    }
    this.senders = Object.fromEntries(
      [...this.actions].map(([type, action]) => [
        type,
        (event: RoomEvent) => void action.send(event as unknown as DataPayload).catch(() => {}),
      ]),
    )

    room.onPeerJoin = (peerId) => {
      if (this.announced && this.self) {
        this.send('peer-hello', { type: 'peer-hello', participant: this.selfSnapshot() })
      }
      if (this.sentStream) {
        for (const promise of room.addStream(this.sentStream, { target: peerId })) {
          promise.catch(() => {})
        }
      }
    }
    room.onPeerLeave = (peerId) => this.handlePeerLeave(peerId)
    room.onPeerStream = (stream, peerId) => this.notifyStream(stream, peerId)

    if (this.pendingStream) this.sendStream(this.pendingStream)
  }

  private selfSnapshot(): Participant {
    return this.self as Participant
  }

  announce() {
    this.announced = true
    if (this.room && this.self) {
      this.send('peer-hello', { type: 'peer-hello', participant: this.self })
    }
  }

  updateSelf(self: Participant) {
    this.self = self
    if (!this.announced || !this.room || !this.roomId) return
    this.send('peer-update', { type: 'peer-update', participantId: self.id, patch: self })
  }

  sendStream(stream: MediaStream | null) {
    if (!this.room) {
      this.pendingStream = stream
      return
    }
    this.pendingStream = null
    if (stream === this.sentStream) return
    if (this.sentStream) this.room.removeStream(this.sentStream)
    this.sentStream = stream
    if (stream) {
      for (const promise of this.room.addStream(stream)) promise.catch(() => {})
    }
  }

  /**
   * Caps the outbound camera bitrate on every live peer connection. WebRTC's
   * built-in congestion control still applies, but a lower ceiling keeps calls
   * smooth (less buffering/loss) when the network is weak. Passing `null`
   * removes the cap. Camera-only senders are left untouched.
   */
  setVideoMaxBitrate(kbps: number | null) {
    if (!this.room) return
    for (const pc of Object.values(this.room.getPeers())) {
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind !== 'video' || sender.track.muted) continue
        const params = sender.getParameters()
        const encodings = params.encodings?.map((enc) => ({
          ...enc,
          maxBitrate: kbps === null ? 8_000_000 : kbps * 1000,
        }))
        if (!encodings) continue
        const next: RTCRtpSendParameters = {
          ...params,
          encodings,
          degradationPreference: 'maintain-framerate',
        }
        try {
          void sender.setParameters(next).catch(() => undefined)
        } catch {
          // parameters may be mid-negotiation; the next stats tick re-applies
        }
      }
    }
  }

  async measureStats(): Promise<StatsSample | null> {
    if (!this.room) return null
    const peerIds = Object.keys(this.room.getPeers())
    if (peerIds.length === 0) return null

    const rtts: number[] = []
    await Promise.all(
      peerIds.map(async (id) => {
        try {
          rtts.push(await this.room!.ping(id))
        } catch {
          // peer dropped mid-measurement
        }
      }),
    )

    const now = Date.now()
    const bucket: StatsBucket = { at: now, rxPackets: 0, rxLost: 0, txBytes: 0 }
    let jitterMs = 0
    for (const peerId of peerIds) {
      const pc = this.room.getPeers()[peerId]
      if (!pc) continue
      try {
        const report = await pc.getStats()
        report.forEach((entry) => {
          const stats = entry as unknown as {
            type?: string
            kind?: string
            packetsReceived?: number
            packetsLost?: number
            bytesSent?: number
            jitter?: number
            remoteId?: string
          }
          if (stats.type === 'inbound-rtp' && stats.kind === 'video') {
            bucket.rxPackets += stats.packetsReceived ?? 0
            bucket.rxLost += stats.packetsLost ?? 0
            if (typeof stats.jitter === 'number') jitterMs = Math.max(jitterMs, stats.jitter * 1000)
          } else if (stats.type === 'outbound-rtp' && stats.kind === 'video' && !stats.remoteId) {
            bucket.txBytes += stats.bytesSent ?? 0
          }
        })
      } catch {
        // stats collection is best-effort
      }
    }

    let loss = 0
    let bitrate = 0
    const prev = this.statsPrev
    if (prev && now > prev.at) {
      const dPackets = bucket.rxPackets - prev.rxPackets
      const dLost = bucket.rxLost - prev.rxLost
      const denom = dPackets + dLost
      if (denom > 0) loss = (dLost / denom) * 100
      const dt = (now - prev.at) / 1000
      if (dt > 0) bitrate = ((bucket.txBytes - prev.txBytes) * 8) / dt / 1000
    }
    this.statsPrev = bucket

    return {
      ping: rtts.length > 0 ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length) : 0,
      jitter: Math.round(jitterMs),
      loss: Number(loss.toFixed(1)),
      bitrate: Math.round(bitrate),
    }
  }

  disconnect() {
    this.room?.leave().catch(() => {})
    this.room = null
    this.roomId = null
    this.self = null
    this.announced = false
    this.sentStream = null
    this.actions.clear()
    this.senders = {}
    this.peerByParticipant.clear()
    this.participantByPeer.clear()
    this.statsPrev = null
  }

  emit(event: RoomEvent) {
    this.send(event.type, event)
  }

  on(listener: RoomEventListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  onRemoteStream(listener: RemoteStreamListener) {
    this.streamListeners.add(listener)
    return () => {
      this.streamListeners.delete(listener)
    }
  }

  dispose() {
    this.disconnect()
    this.listeners.clear()
    this.streamListeners.clear()
  }

  private send(type: EventType, event: RoomEvent) {
    this.senders[type]?.(event)
  }

  private handleMessage(event: RoomEvent, peerId: string) {
    switch (event.type) {
      case 'peer-hello': {
        const { participant } = event
        const next = { ...participant, isSelf: false, peerId }
        this.rememberPeer(peerId, participant.id)
        this.dispatch({ type: 'peer-hello', participant: next })
        if (this.announced && this.self && participant.id !== this.self.id) {
          this.send('peer-ack', { type: 'peer-ack', participant: this.self })
        }
        break
      }
      case 'peer-ack': {
        const { participant } = event
        const next = { ...participant, isSelf: false, peerId }
        this.rememberPeer(peerId, participant.id)
        this.dispatch({ type: 'peer-ack', participant: next })
        break
      }
      case 'peer-update':
      case 'peer-leave':
      default:
        this.dispatch(event)
    }
  }

  private handlePeerLeave(peerId: string) {
    this.notifyStream(null, peerId)
    const participantId = this.participantByPeer.get(peerId)
    this.forgetPeer(peerId)
    if (participantId && participantId !== this.self?.id) {
      this.dispatch({ type: 'peer-leave', participantId })
    }
  }

  private rememberPeer(peerId: string, participantId: ID) {
    const previousPeer = this.peerByParticipant.get(participantId)
    if (previousPeer && previousPeer !== peerId) this.participantByPeer.delete(previousPeer)
    this.peerByParticipant.set(participantId, peerId)
    this.participantByPeer.set(peerId, participantId)
  }

  private forgetPeer(peerId: string) {
    const participantId = this.participantByPeer.get(peerId)
    if (participantId) this.peerByParticipant.delete(participantId)
    this.participantByPeer.delete(peerId)
  }

  private notifyStream(stream: MediaStream | null, peerId: string) {
    for (const listener of this.streamListeners) listener(stream, peerId)
  }

  private dispatch(event: RoomEvent) {
    for (const listener of this.listeners) listener(event)
  }
}