import type {
  ActivityTask,
  AudioQuality,
  ChatMessage,
  ID,
  JoinRequest,
  NoiseFilter,
  Participant,
  ParticipantPermissions,
  Poll,
  RoomTimer,
  ToastInput,
  TodoItem,
  VideoQuality,
} from '@/types'
import type { RoomSettingsPatch } from '@/lib/defaults'
import type { RoomEvent, RealtimeService } from '@/services/realtime'
import { createRealtimeService } from '@/services/realtime'
import { mediaEngine } from '@/services/media/MediaEngine'
import { qualityController } from '@/services/media/QualityController'
import { announceRoomDeletion } from '@/services/directory/PublicRoomsDirectory'
import { buildFileMessage, buildSystemMessage, buildTextMessage } from '@/lib/chat'
import { generateId, createHostToken } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore, buildSelfParticipant } from '@/stores/roomSession'
import { useRoomsStore } from '@/stores/rooms'
import { useSessionStore } from '@/stores/session'
import { toast } from '@/stores/ui'

const STATS_INTERVAL_MS = 3000
const MAX_FILE_SIZE = 2 * 1024 * 1024

/**
 * Participants broadcast a heartbeat every PRESENCE_INTERVAL_MS and everyone
 * drops peers that go silent for STALE_EVICT_MS. This catches the case where
 * someone kills the tab (or their network) without a graceful leave, so no one
 * stays listed in a room they are no longer connected to.
 */
const PRESENCE_INTERVAL_MS = 4000
/**
 * A hidden/background tab has its timers throttled by the browser (as slow as
 * once a minute), so a healthy peer can go quiet for a long stretch. The window
 * is deliberately generous so we don't kick someone who simply switched tabs;
 * genuine tab closes still arrive instantly as a peer-level disconnect.
 */
const STALE_EVICT_MS = 45000
/**
 * How often we probe for a lost connection (all remote peers dropped) before
 * re-announcing and, ultimately, rebuilding the signaling session.
 */
const RECONNECT_INTERVAL_MS = 8000

/**
 * Outbound video bitrate ceiling (kbps) per connection quality. WebRTC keeps
 * its own congestion control; these caps just prevent the encoder from
 * flooding a weak uplink, which keeps calls smooth instead of buffering.
 */
const VIDEO_CAP_KBPS: Record<'poor' | 'fair' | 'good' | 'excellent', number | null> = {
  poor: 280,
  fair: 560,
  good: 1100,
  excellent: null,
}
const LOW_BANDWIDTH_CAP_KBPS = 240

/**
 * Room-level outbound ceilings chosen in room settings. They act as a hard
 * cap on top of the connection-driven cap so a host can pin the call to a
 * resolution/bandwidth budget. `null` means "no room cap".
 */
const VIDEO_QUALITY_CAP_KBPS: Record<VideoQuality, number | null> = {
  auto: null,
  '1080p': 4000,
  '720p': 2000,
  '360p': 700,
  '180p': 250,
}
const AUDIO_QUALITY_CAP_KBPS: Record<AudioQuality, number | null> = {
  auto: null,
  high: null,
  medium: 64,
  low: 32,
}

let videoCap: number | null = null

let realtime: RealtimeService | null = null
let offRealtime: (() => void) | null = null
let offRemoteStream: (() => void) | null = null
let offSpeaking: (() => void) | null = null
let offStream: (() => void) | null = null
let statsTimer: number | null = null
let presenceTimer: number | null = null
let lastSeen = new Map<ID, number>()
let snapshotSentTo = new Set<ID>()
let activeRoomId: ID | null = null
let joinApproved = false
let requestRetryTimer: number | null = null
let reconnectTimer: number | null = null
let expireTimer: number | null = null
let remotePeerSeen = false
let droppedPeersBySilence = false
let reconnectAttempts = 0
let hardReconnects = 0

function notify(input: ToastInput) {
  toast(input)
}

function store() {
  return useRoomSessionStore.getState()
}

/**
 * A device is an "authenticated host" when its own role says host AND it holds
 * the room's host token. The token is minted on the creating device and moved
 * peer-to-peer on host transfer, so a visitor who forges their `userId` to look
 * like the room's host id still gets no host powers — they have no token.
 */
function isAuthenticatedHost(): boolean {
  if (!activeRoomId) return false
  const state = store()
  if (!state.self || state.self.role !== 'host') return false
  return useSessionStore.getState().hostTokens[activeRoomId] !== undefined
}

export function initRoom(roomId: ID): () => void {
  cleanupTransport()
  const status = store().bootstrap(roomId)

  if (status === 'not-found' || status === 'locked') {
    return () => {
      store().reset()
      activeRoomId = null
    }
  }

  activeRoomId = roomId
  joinApproved = status === 'joined'
  realtime = createRealtimeService()
  offRealtime = realtime.on(handleRealtimeEvent)
  offRemoteStream = realtime.onRemoteStream(handleRemoteStream)

  if (status === 'joined') {
    useRoomsStore.getState().updateMeta(roomId, {
      participantCount: store().participants.length,
    })
    connectAsSelf()
    realtime.announce()
    wireSelfMedia()
    startStatsMonitor()
    startPresenceMonitor()
    scheduleAutoExpire()
    void prepareMedia(
      store().room?.settings.participants.defaultMic ?? true,
      store().room?.settings.participants.defaultCamera ?? true,
      true,
    )
  }

  navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange)
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)
  window.addEventListener('online', handleOnline)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  startReconnectMonitor()

  return () => {
    navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange)
    window.removeEventListener('pagehide', handlePageHide)
    window.removeEventListener('pageshow', handlePageShow)
    window.removeEventListener('online', handleOnline)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    fullTeardown()
  }
}

function connectAsSelf() {
  const self = store().self
  if (!realtime || !self) return
  realtime.connect(activeRoomId ?? '', self)
  store().setConnected(true)
}

function handlePageHide(event: PageTransitionEvent) {
  // A bfcache freeze isn't a real departure — keep our seat and just drop the
  // transport, then rebuild it on pageshow. Counting us out here would leave a
  // phantom decrement in the persisted room meta.
  if (event.persisted) {
    realtime?.disconnect()
    return
  }
  const self = store().self
  if (self) realtime?.emit({ type: 'peer-leave', participantId: self.id })
  if (activeRoomId) decParticipantCount(activeRoomId)
  realtime?.disconnect()
}

/** Broadcasts proof-of-life for ourselves right now. */
function sendHeartbeat() {
  const self = store().self
  if (!self || !realtime) return
  lastSeen.set(self.id, Date.now())
  realtime.emit({ type: 'heartbeat', participantId: self.id, participant: self })
}

/** Treats every peer as freshly seen — used after a pause so no one is evicted. */
function touchAllPeers() {
  const now = Date.now()
  for (const participant of store().participants) {
    if (!participant.isSelf) lastSeen.set(participant.id, now)
  }
}

function handlePageShow(event: PageTransitionEvent) {
  if (!event.persisted) return
  reconnectRealtime()
  sendHeartbeat()
}

function handleOnline() {
  if (!activeRoomId) return
  hardReconnects = 0
  remotePeerSeen = remotePeerSeen || store().participants.some((participant) => !participant.isSelf)
  sendHeartbeat()
  touchAllPeers()
  realtime?.announce()
}

function handleVisibilityChange() {
  // Coming back to a throttled tab: tell peers we're alive and don't hold their
  // old (throttled) silence against them.
  if (document.hidden) return
  if (!store().self || !realtime) return
  sendHeartbeat()
  touchAllPeers()
  realtime?.announce()
}

/**
 * Best-effort local bookkeeping: assumes this device no longer counts toward
 * a room's participant count. Closing the tab without leaving the room kills
 * the live session instantly, so no peer can update the persisted room meta
 * for us — without this the room would keep showing our account forever.
 */
function decParticipantCount(roomId: ID) {
  const rooms = useRoomsStore.getState()
  const room = rooms.rooms.find((existing) => existing.id === roomId)
  if (!room) return
  rooms.updateMeta(roomId, { participantCount: Math.max(0, room.participantCount - 1) })
}

function cleanupTransport() {
  offRealtime?.()
  offRealtime = null
  offRemoteStream?.()
  offRemoteStream = null
  stopStatsMonitor()
  videoCap = null
  snapshotSentTo.clear()
  realtime?.dispose()
  realtime = null
}

function stopLocalMedia() {
  offSpeaking?.()
  offSpeaking = null
  offStream?.()
  offStream = null
  stopPresenceMonitor()
  stopReconnectMonitor()
  stopAutoExpire()
  cleanupTransport()
  mediaEngine.dispose()
  useCallStore.getState().reset()
}

function fullTeardown() {
  if (requestRetryTimer !== null) window.clearInterval(requestRetryTimer)
  requestRetryTimer = null
  if (activeRoomId && store().self) decParticipantCount(activeRoomId)
  stopLocalMedia()
  joinApproved = false
  store().reset()
}

function wireSelfMedia() {
  offSpeaking?.()
  offStream?.()

  offSpeaking = mediaEngine.onSpeakingChange((speaking) => {
    const self = store().self
    if (!self) return
    store().flagSpeaking(self.id, speaking)
    realtime?.emit({ type: 'peer-update', participantId: self.id, patch: { isSpeaking: speaking } })
  })

  offStream = mediaEngine.onStreamChange(() => {
    useCallStore.getState().setHasLocalVideo(mediaEngine.hasVideoTrack())
    syncSelf()
    pushOutgoingStream()
  })
}

function handleRemoteStream(stream: MediaStream | null, peerId: string) {
  const call = useCallStore.getState()
  if (stream) call.setRemoteStream(peerId, stream)
  else call.removeRemoteStream(peerId)
}

function pushOutgoingStream() {
  const call = useCallStore.getState()
  const stream = call.sharing ? mediaEngine.getScreenStream() : mediaEngine.getStream()
  realtime?.sendStream(stream)
}

function adaptVideoCap() {
  const call = useCallStore.getState()
  const quality = qualityController.getStats().quality
  const base = call.lowBandwidth ? LOW_BANDWIDTH_CAP_KBPS : VIDEO_CAP_KBPS[quality]
  const current = videoCap
  let next: number | null

  if (base === null) {
    // excellent: ramp back up steadily, then remove the cap entirely
    next = current === null || current >= 1500 ? null : Math.round(current * 1.35)
  } else if (current === null || base < current) {
    // degrade drops immediately so the call stays smooth
    next = base
  } else if (base === 1100 && current >= 1100) {
    next = current
  } else {
    // recovered quality: raise in gentle steps to avoid oscillation
    next = Math.min(base, Math.round(current * 1.35))
  }

  videoCap = next
  // Re-apply even when unchanged so peers that joined since the last tick also
  // receive the current ceiling.
  applyVideoBitrate()
}

/** Outbound video ceiling: the connection-driven cap clamped by the room setting. */
function applyVideoBitrate() {
  if (!realtime) return
  const roomCap = VIDEO_QUALITY_CAP_KBPS[store().room?.settings.av.videoQuality ?? 'auto']
  const effective = roomCap === null ? videoCap : videoCap === null ? roomCap : Math.min(videoCap, roomCap)
  realtime.setVideoMaxBitrate(effective)
}

/** Pushes the room's audio/video quality ceilings to the live peer connections. */
function applyRoomQualityCaps() {
  if (!realtime) return
  realtime.setAudioMaxBitrate(AUDIO_QUALITY_CAP_KBPS[store().room?.settings.av.audioQuality ?? 'auto'])
  applyVideoBitrate()
}

/**
 * Re-applies room audio/video settings when the host changes them mid-call:
 * capture resolution, audio sample rate and the outbound bitrate ceilings.
 * A locally-locked audio preference (set in Device settings) is left untouched.
 */
function applyRoomAvSettings() {
  const av = store().room?.settings.av
  if (!av) return
  if (!mediaEngine.isPrefsLocked()) {
    mediaEngine.setPreferences({
      echoCancellation: av.echoCancellation,
      noiseSuppression: av.noiseFilter !== 'off',
      autoGainControl: av.noiseFilter !== 'off',
      videoQuality: av.videoQuality,
      audioQuality: av.audioQuality,
    })
    void mediaEngine.applyVideoQuality()
    void mediaEngine.reapplyAudio()
  }
  applyRoomQualityCaps()
}

function startStatsMonitor() {
  if (statsTimer !== null) return
  statsTimer = window.setInterval(() => {
    void (async () => {
      try {
        const sample = await realtime?.measureStats()
        if (sample) {
          qualityController.report(sample)
          adaptVideoCap()
        }
      } catch {
        // measurement is best-effort
      }
    })()
  }, STATS_INTERVAL_MS)
}

function stopStatsMonitor() {
  if (statsTimer !== null) window.clearInterval(statsTimer)
  statsTimer = null
}

/**
 * Records proof-of-life for a participant. Anyone a session last heard from at
 * least STALE_EVICT_MS ago is treated as gone (tab killed, network dropped)
 * and evicted — without waiting for a peer-level disconnect notice.
 */
function touchParticipant(participantId: ID) {
  lastSeen.set(participantId, Date.now())
}

function evictSilentPeers() {
  const state = store()
  const now = Date.now()
  for (const participant of state.participants) {
    if (participant.isSelf) continue
    const seen = lastSeen.get(participant.id)
    if (seen === undefined || now - seen <= STALE_EVICT_MS) continue
    lastSeen.delete(participant.id)
    if (participant.peerId) realtime?.forcePeerLeave(participant.id)
    state.removeParticipant(participant.id)
    droppedPeersBySilence = true
  }
}

function noteRemotePresence() {
  const remote = store().participants.some((participant) => !participant.isSelf)
  if (!remote) return
  remotePeerSeen = true
  droppedPeersBySilence = false
  reconnectAttempts = 0
  hardReconnects = 0
  if (!store().connected) store().setConnected(true)
}

/**
 * Tears the signaling session down and rebuilds it in place, keeping our
 * participant identity. Used when we've lost everyone without a graceful leave
 * (relay/ICE death), so the call can heal instead of sitting on "Reconnecting…"
 * forever.
 */
function reconnectRealtime() {
  const self = store().self
  if (!realtime || !self || !activeRoomId || !joinApproved) return
  realtime.disconnect()
  realtime.connect(activeRoomId, self)
  realtime.announce()
  pushOutgoingStream()
  snapshotSentTo.clear()
  store().setConnected(true)
  touchAllPeers()
}

function maybeReconnect() {
  if (!joinApproved || document.hidden || !store().self) return
  if (!remotePeerSeen) return

  const remoteCount = store().participants.filter((participant) => !participant.isSelf).length
  if (remoteCount > 0) {
    reconnectAttempts = 0
    return
  }
  // Everyone vanished by going silent (network/relay drop) rather than leaving
  // gracefully — treat it as a dropped connection and try to come back.
  if (!droppedPeersBySilence) return
  if (hardReconnects >= 3) {
    // Given up: stop flashing "Reconnecting…" and let an 'online' event retry.
    store().setConnected(true)
    return
  }
  store().setConnected(false)
  reconnectAttempts++
  if (reconnectAttempts >= 3) {
    hardReconnects++
    reconnectAttempts = 0
    reconnectRealtime()
  } else {
    realtime?.announce()
  }
}

function startReconnectMonitor() {
  if (reconnectTimer !== null) return
  reconnectTimer = window.setInterval(maybeReconnect, RECONNECT_INTERVAL_MS)
}

function stopReconnectMonitor() {
  if (reconnectTimer !== null) window.clearInterval(reconnectTimer)
  reconnectTimer = null
  remotePeerSeen = false
  droppedPeersBySilence = false
  reconnectAttempts = 0
  hardReconnects = 0
}

function startPresenceMonitor() {
  if (presenceTimer !== null) return
  const tick = () => {
    sendHeartbeat()
    // Don't evict on stale clocks while we're backgrounded: the browser throttles
    // our timers there, so our view of everyone's liveness goes stale and we'd
    // drop perfectly healthy peers.
    if (!document.hidden) evictSilentPeers()
    noteRemotePresence()
  }
  tick()
  presenceTimer = window.setInterval(tick, PRESENCE_INTERVAL_MS)
}

function stopPresenceMonitor() {
  if (presenceTimer !== null) window.clearInterval(presenceTimer)
  presenceTimer = null
  lastSeen.clear()
}

async function refreshDevices() {
  try {
    const devices = await mediaEngine.enumerateDevices()
    useCallStore.getState().setDevices(devices)
  } catch {
    // device enumeration is best-effort
  }
}

async function prepareMedia(audio: boolean, camera: boolean, silent: boolean) {
  const call = useCallStore.getState()
  if (!mediaEngine.isPrefsLocked()) {
    const av = store().room?.settings.av
    const noiseFilter = av?.noiseFilter ?? 'light'
    mediaEngine.setPreferences({
      echoCancellation: av?.echoCancellation ?? true,
      noiseSuppression: noiseFilter !== 'off',
      autoGainControl: noiseFilter !== 'off',
      videoQuality: av?.videoQuality ?? 'auto',
      audioQuality: av?.audioQuality ?? 'auto',
    })
  }

  if (audio || camera) {
    const result = await mediaEngine.prepare({ audio, video: camera })
    const permissionPatch: { audioPermission?: typeof result.audio; videoPermission?: typeof result.video } = {}
    if (audio) permissionPatch.audioPermission = result.audio
    if (camera) permissionPatch.videoPermission = result.video
    call.setPermissions(permissionPatch)

    if (audio) {
      const micReady = result.audio === 'granted'
      call.setMic(micReady)
      mediaEngine.setMic(micReady)
      if (!micReady && !silent) {
        notify({
          title: result.audio === 'denied' ? t('Microphone access denied') : t('No microphone found'),
          description: t('You can still watch and chat in this room.'),
          variant: 'warning',
        })
      }
    }

    if (camera) {
      const camReady = result.video === 'granted'
      call.setCamera(camReady)
      mediaEngine.setCamera(camReady)
      if (!camReady && !silent) {
        notify({
          title: result.video === 'denied' ? t('Camera access denied') : t('No camera found'),
          description: t('You can still join with audio only.'),
          variant: 'warning',
        })
      }
    }

    call.setHasLocalVideo(mediaEngine.hasVideoTrack())
    await refreshDevices()
  }

  const self = store().self
  if (self) syncSelf()
}

function syncSelf() {
  const state = store()
  const call = useCallStore.getState()
  if (!state.self) return
  const next: Participant = {
    ...state.self,
    micOn: call.micOn,
    cameraOn: call.cameraOn,
    screenSharing: call.sharing,
  }
  state.setSelf(next)
  realtime?.updateSelf(next)
}

/**
 * A peer-announced participant is only trusted for identity, not privileges:
 * the host role is derived from the room's host id and any permissions a peer
 * claims for itself are dropped (the host grants them later via peer-update).
 */
function sanitizeParticipant(participant: Participant): Participant {
  const room = store().room
  const role: Participant['role'] = room && participant.id === room.hostId ? 'host' : 'guest'
  return { ...participant, isSelf: false, role, permissions: undefined }
}

/** True when the event was sent by the device that owns the room's host id. */
function senderIsHost(event: { senderId?: ID }): boolean {
  const room = store().room
  return Boolean(room && event.senderId !== undefined && event.senderId === room.hostId)
}

/** Grants carried by the host: check whether a known sender may moderate/manage. */
function senderCanModerate(senderId?: ID): boolean {
  if (!senderId) return false
  const room = store().room
  if (room && senderId === room.hostId) return true
  return Boolean(store().participants.find((p) => p.id === senderId)?.permissions?.canModerate)
}

function senderCanManage(senderId?: ID): boolean {
  if (!senderId) return false
  const room = store().room
  if (room && senderId === room.hostId) return true
  return Boolean(store().participants.find((p) => p.id === senderId)?.permissions?.canManageRoom)
}

/**
 * Validates an inbound chat payload. Peers may not forge another sender's id or
 * emit `system` messages, and oversized/malformed fields are dropped so a
 * malicious peer cannot exhaust memory or impersonate the host in chat.
 */
function sanitizeIncomingMessage(
  message: ChatMessage | null | undefined,
  senderId?: ID,
  allowAnyAuthor = false,
): ChatMessage | null {
  if (!message || typeof message !== 'object') return null
  if (!senderId) return null
  const authorId = typeof message.senderId === 'string' ? message.senderId : senderId
  if (!allowAnyAuthor && authorId !== senderId) return null
  if (message.kind === 'system' || authorId === 'system') return null
  let file: ChatMessage['file']
  if (message.kind === 'file') {
    const incoming = message.file
    if (!incoming || typeof incoming.url !== 'string' || !incoming.url.startsWith('data:')) return null
    if (incoming.url.length > 3_000_000) return null
    file = {
      name: String(incoming.name ?? 'file').slice(0, 200),
      size: Number.isFinite(incoming.size) ? Number(incoming.size) : 0,
      type: String(incoming.type ?? 'application/octet-stream').slice(0, 120),
      url: incoming.url,
    }
  }
  return {
    id: typeof message.id === 'string' && message.id ? message.id.slice(0, 80) : generateId('msg'),
    roomId: store().room?.id ?? message.roomId ?? '',
    senderId: authorId,
    senderName: typeof message.senderName === 'string' ? message.senderName.slice(0, 60) : '',
    avatarColor: typeof message.avatarColor === 'string' ? message.avatarColor.slice(0, 40) : '#717689',
    kind: file ? 'file' : 'text',
    text: typeof message.text === 'string' ? message.text.slice(0, 2000) : '',
    file,
    reactions: {},
    createdAt: Number.isFinite(message.createdAt) ? Number(message.createdAt) : Date.now(),
  }
}

function sanitizeIncomingActivities(input: {
  polls: Poll[]
  tasks: ActivityTask[]
  todos: TodoItem[]
  timer: RoomTimer | null
}): { polls: Poll[]; tasks: ActivityTask[]; todos: TodoItem[]; timer: RoomTimer | null } | null {
  if (!Array.isArray(input.polls) || !Array.isArray(input.tasks) || !Array.isArray(input.todos)) return null
  if (input.polls.length > 100 || input.tasks.length > 300 || input.todos.length > 800) return null
  return {
    polls: input.polls,
    tasks: input.tasks,
    todos: input.todos,
    timer: input.timer ?? null,
  }
}

function normalizeName(name: string) {
  return name.trim().toLowerCase()
}

/**
 * Returns the existing room name that clashes with `name`, or null when the
 * name is free. `excludeParticipantId` lets a participant check against
 * everyone but themselves (used when renaming).
 */
export function nameTakenBy(name: string, excludeParticipantId?: ID): string | null {
  const s = store()
  const n = normalizeName(name)
  if (!n) return null
  const isHostSelf = !!s.room && !!s.self && s.self.id === s.room.hostId
  if (s.room && !isHostSelf && normalizeName(s.room.hostName) === n) {
    return s.room.hostName
  }
  for (const p of s.participants) {
    if (p.id === excludeParticipantId) continue
    if (normalizeName(p.name) === n) return p.name
  }
  return null
}

function flagNameClash(clashName: string, participantId: ID) {
  realtime?.emit({ type: 'name-taken', participantId, name: clashName })
}

/**
 * Change your display name while inside a room. Rejects (and reports) names
 * that are already used by someone else in the room.
 */
export function renameSelf(name: string): boolean {
  const s = store()
  const trimmed = name.trim()
  if (!trimmed || !s.self) return false
  const clash = nameTakenBy(trimmed, s.self.id)
  if (clash) {
    s.setNameTaken(clash)
    notify({
      title: t('Name is already taken'),
      description: t('“{name}” is used by someone else here. Pick a different name.', { name: clash }),
      variant: 'danger',
      duration: 5000,
    })
    return false
  }
  useSessionStore.getState().setName(trimmed)
  const next: Participant = { ...s.self, name: trimmed }
  s.setSelf(next)
  realtime?.updateSelf(next)
  realtime?.announce()
  s.setNameTaken(null)
  return true
}

/**
 * Sends the current room state (chat, pinned message, activities, settings) to
 * a newly-arrived peer so late joiners/reconnectors see history instead of an
 * empty room. Only the host serves snapshots so the payload is trusted.
 */
function sendSnapshot(participantId: ID) {
  const state = store()
  if (!state.room || snapshotSentTo.has(participantId)) return
  snapshotSentTo.add(participantId)
  realtime?.sendTarget(
    {
      type: 'snapshot',
      messages: state.messages.slice(-200),
      pinned: state.pinnedMessage,
      polls: state.polls,
      tasks: state.tasks,
      todos: state.todos,
      timer: state.timer,
      settings: state.room.settings,
    },
    participantId,
  )
}

function handleRealtimeEvent(event: RoomEvent) {
  const state = store()
  const selfId = state.self?.id

  switch (event.type) {
    case 'peer-hello': {
      if (event.participant.id === selfId) return
      touchParticipant(event.participant.id)
      state.addParticipant(sanitizeParticipant(event.participant))
      if (isAuthenticatedHost()) sendSnapshot(event.participant.id)
      if (state.self?.role === 'host') {
        const clash = nameTakenBy(event.participant.name, event.participant.id)
        if (clash) flagNameClash(clash, event.participant.id)
      }
      break
    }
    case 'peer-ack': {
      if (event.participant.id === selfId) return
      touchParticipant(event.participant.id)
      state.addParticipant(sanitizeParticipant(event.participant))
      if (isAuthenticatedHost()) sendSnapshot(event.participant.id)
      if (state.self?.role === 'host') {
        const clash = nameTakenBy(event.participant.name, event.participant.id)
        if (clash) flagNameClash(clash, event.participant.id)
      }
      break
    }
    case 'heartbeat': {
      if (event.participantId === selfId) break
      touchParticipant(event.participantId)
      if (!state.participants.some((p) => p.id === event.participantId)) {
        state.addParticipant(sanitizeParticipant(event.participant))
      }
      break
    }
    case 'peer-update': {
      // A peer may always update *itself* (name/mic/camera). The host may update
      // anyone, and a granted moderator may drive others' mic/camera — but only
      // the host may change role/permissions (privilege escalation guard).
      const fromHost = senderIsHost(event)
      const selfUpdate = event.senderId !== undefined && event.participantId === event.senderId
      if (!fromHost && !selfUpdate && !senderCanModerate(event.senderId) && !senderCanManage(event.senderId)) break
      const patch: Partial<Participant> = { ...event.patch }
      if (!fromHost) {
        delete patch.role
        delete patch.permissions
      }
      if (event.participantId === selfId) {
        if (!state.self) break
        const call = useCallStore.getState()
        if (patch.micOn !== undefined) {
          call.setMic(patch.micOn)
          mediaEngine.setMic(patch.micOn)
        }
        if (patch.cameraOn !== undefined) {
          call.setCamera(patch.cameraOn)
          mediaEngine.setCamera(patch.cameraOn)
        }
        const promoted = patch.role === 'host' && state.self.role !== 'host'
        const grantedPermissions = patch.permissions !== undefined && !state.self.permissions
        state.setSelf({ ...state.self, ...patch, isSelf: true })
        if (promoted) notify({ title: t('You are now the host of this room'), variant: 'success' })
        if (grantedPermissions) notify({ title: t('The host granted you new permissions'), variant: 'success', duration: 4000 })
        break
      }
      touchParticipant(event.participantId)
      state.updateParticipant(event.participantId, { ...patch, isSelf: false })
      if (state.self?.role === 'host' && patch.name !== undefined) {
        const clash = nameTakenBy(patch.name, event.participantId)
        if (clash) flagNameClash(clash, event.participantId)
      }
      break
    }
    case 'peer-leave': {
      if (event.participantId === selfId) return
      lastSeen.delete(event.participantId)
      state.removeParticipant(event.participantId)
      break
    }
    case 'snapshot': {
      // Room history is only trusted from the host. Apply it once, when we are
      // still empty, so a late joiner/reconnector isn't left staring at a blank
      // room (events only travel forward otherwise).
      if (!senderIsHost(event)) break
      const incoming = Array.isArray(event.messages) ? event.messages : []
      if (incoming.length > 0) {
        const merged = new Map<ID, ChatMessage>()
        for (const m of incoming) {
          const clean = sanitizeIncomingMessage(m, m?.senderId, true)
          if (clean) merged.set(clean.id, clean)
        }
        for (const m of state.messages) merged.set(m.id, m)
        if (merged.size > 0) {
          const messages = [...merged.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-300)
          state.setMessages(messages)
        }
      }
      if (!state.pinnedMessage && event.pinned) {
        const pinned = sanitizeIncomingMessage(event.pinned, event.pinned?.senderId, true)
        if (pinned) state.setPinnedMessage(pinned)
      }
      if (state.polls.length === 0 && state.tasks.length === 0 && state.todos.length === 0 && !state.timer) {
        const activities = sanitizeIncomingActivities(event)
        if (activities) state.setActivities(activities)
      }
      if (event.settings) {
        state.applySettingsPatch(event.settings)
        if (event.settings.av) applyRoomAvSettings()
      }
      break
    }
    case 'chat': {
      const message = sanitizeIncomingMessage(event.message, event.senderId)
      if (message) state.addMessage(message)
      break
    }
    case 'pin': {
      // Hosts/moderators may pin anyone's message; everyone else only their own.
      const moderator = senderCanModerate(event.senderId)
      if (event.message) {
        const message = sanitizeIncomingMessage(event.message, event.senderId, moderator)
        if (message) state.setPinnedMessage(message)
      } else {
        if (!moderator && state.pinnedMessage?.senderId !== event.senderId) break
        state.setPinnedMessage(null)
      }
      break
    }
    case 'activity': {
      const activities = sanitizeIncomingActivities(event)
      if (!activities) break
      const previousTasks = new Map(state.tasks.map((task) => [task.id, task] as const))
      const selfAssigned = selfId
        ? activities.tasks.filter(
            (task) => task.assigneeId === selfId && previousTasks.get(task.id)?.assigneeId !== selfId,
          )
        : []
      const pollsGrew = activities.polls.length > state.polls.length
      state.setActivities(activities)
      if (selfAssigned.length > 0) {
        notify({ title: t('New task assigned to you: "{title}"', { title: selfAssigned[0].title }), variant: 'info', duration: 5000 })
      }
      if (selfAssigned.length > 0 || pollsGrew) state.bumpActivitiesUnread()
      break
    }
    case 'reaction': {
      if (!state.room?.settings.chat.allowReactions) break
      if (!event.senderId || event.userId !== event.senderId) break
      if (typeof event.emoji !== 'string' || event.emoji.length === 0 || event.emoji.length > 16) break
      state.toggleReaction(event.messageId, event.emoji, event.userId)
      break
    }
    case 'hand': {
      if (!event.senderId || event.participantId !== event.senderId) break
      state.updateParticipant(event.participantId, { handRaised: Boolean(event.raised) })
      const raiser = store().participants.find((participant) => participant.id === event.participantId)
      if (event.raised && raiser && !raiser.isSelf) {
        notify({ title: t('{name} raised their hand', { name: raiser.name }), variant: 'info', duration: 4000 })
      }
      break
    }
    case 'float': {
      if (!event.senderId || event.participantId !== event.senderId) break
      if (typeof event.emoji !== 'string' || event.emoji.length === 0 || event.emoji.length > 16) break
      const name = typeof event.name === 'string' ? event.name.slice(0, 40) : ''
      state.pushFloatingReaction(event.emoji, name)
      break
    }
    case 'request': {
      if (!isAuthenticatedHost()) return
      // "Block join requests" pauses the waiting room: politely turn the joiner
      // away instead of letting them hang, without locking the room outright.
      if (store().room?.settings.security.blockJoinRequests) {
        realtime?.emit({
          type: 'request-resolved',
          requestId: event.request.id,
          participantId: event.request.participantId,
          accepted: false,
        })
        return
      }
      const rosterClash = nameTakenBy(event.request.name, event.request.participantId)
      const requestClash =
        store()
          .requests.find(
            (r) =>
              r.participantId !== event.request.participantId &&
              normalizeName(r.name) === normalizeName(event.request.name),
          )?.name ?? null
      const clash = rosterClash ?? requestClash
      if (clash) {
        realtime?.emit({ type: 'name-taken', participantId: event.request.participantId, name: clash })
        return
      }
      state.addRequest(event.request)
      notify({
        title: t('{name} wants to join', { name: event.request.name }),
        description: t('Open Participants to review the request.'),
        variant: 'info',
        duration: 6000,
      })
      break
    }
    case 'request-resolved': {
      if (event.participantId !== useSessionStore.getState().userId) return
      // Only the room's host may resolve join requests (fail closed: an unknown
      // sender is rejected).
      if (!senderIsHost(event)) return
      if (event.accepted) void approveSelf()
      else state.setStatus('rejected', 'Your request was declined by the host.')
      break
    }
    case 'settings': {
      if (!senderIsHost(event) && !senderCanManage(event.senderId)) break
      state.applySettingsPatch(event.patch)
      if (event.patch.av) applyRoomAvSettings()
      if (event.patch.security) scheduleAutoExpire()
      if (event.patch.access?.lockRoom !== undefined) {
        state.addMessage(
          buildSystemMessage(activeRoomId ?? '', event.patch.access.lockRoom ? t('Room was locked') : t('Room was unlocked')),
        )
      }
      break
    }
    case 'kick': {
      if (!senderCanModerate(event.senderId)) break
      if (event.participantId === selfId) {
        // Being removed is not a clean leave: the target device must drop its
        // own connection too, otherwise it keeps heartbeating and the host
        // re-adds it to the roster (the "kicked user is still in the room" bug).
        if (activeRoomId) decParticipantCount(activeRoomId)
        activeRoomId = null
        if (state.self) realtime?.emit({ type: 'peer-leave', participantId: state.self.id })
        stopLocalMedia()
        state.setStatus('kicked')
        return
      }
      state.removeParticipant(event.participantId)
      break
    }
    case 'name-taken': {
      if (!senderIsHost(event)) break
      if (event.participantId !== selfId) break
      const self = state.self
      if (!self || normalizeName(self.name) !== normalizeName(event.name)) break
      if (state.nameTaken && normalizeName(state.nameTaken) === normalizeName(event.name)) break
      state.setNameTaken(event.name)
      notify({
        title: t('Name is already taken'),
        description: t('“{name}” belongs to someone else here. Choose another name to join.', { name: event.name }),
        variant: 'danger',
        duration: 6000,
      })
      break
    }
    case 'end': {
      // A room can only be ended by the device holding the host role.
      if (!senderIsHost(event)) break
      stopLocalMedia()
      state.setStatus('ended')
      if (activeRoomId) {
        useRoomsStore.getState().removeRoom(activeRoomId)
      }
      break
    }
    case 'host-transfer': {
      // The host token is a secret: only accept it from the current host.
      if (!senderIsHost(event)) break
      if (event.to !== selfId || !activeRoomId) break
      useSessionStore.getState().setHostToken(activeRoomId, event.token)
      break
    }
  }
}

export interface JoinOptions {
  name: string
  micOn: boolean
  cameraOn: boolean
}

export async function preparePreview(audio: boolean, camera: boolean) {
  await prepareMedia(audio, camera, false)
}

export async function requestJoin(options: JoinOptions) {
  const state = store()
  const room = state.room
  if (!room) return

  const session = useSessionStore.getState()
  session.setName(options.name)

  let call = useCallStore.getState()
  if (call.audioPermission === 'unknown' || call.videoPermission === 'unknown') {
    await prepareMedia(options.micOn && call.audioPermission === 'unknown', options.cameraOn && call.videoPermission === 'unknown', false)
    call = useCallStore.getState()
  }

  call.setMic(options.micOn && call.audioPermission === 'granted')
  call.setCamera(options.cameraOn && call.videoPermission === 'granted')
  mediaEngine.setMic(call.micOn)
  mediaEngine.setCamera(call.cameraOn)

  const self = buildSelfParticipant({
    id: session.userId,
    name: options.name,
    role:
      room.hostId === session.userId && session.hostTokens[room.id] !== undefined ? 'host' : 'guest',
    avatarColor: session.avatarColor,
  })
  self.micOn = call.micOn
  self.cameraOn = call.cameraOn
  state.setSelf(self)
  state.setStatus('awaiting')

  if (!room.settings.access.requireApproval || room.hostId === session.userId) {
    await approveSelf()
    return
  }

  connectAsSelf()
  const request: JoinRequest = {
    id: `req_${session.userId}`,
    participantId: session.userId,
    name: options.name,
    avatarColor: session.avatarColor,
    requestedAt: Date.now(),
    micOn: call.micOn,
    cameraOn: call.cameraOn,
  }
  realtime?.emit({ type: 'request', request })

  // Re-send the join request until the host resolves it. The first send can
  // race with peer discovery (no direct link to the host yet), so the request
  // is echoed a few times instead of being lost silently.
  if (requestRetryTimer !== null) window.clearInterval(requestRetryTimer)
  requestRetryTimer = window.setInterval(() => {
    if (store().status !== 'awaiting' || !realtime) {
      if (requestRetryTimer !== null) {
        window.clearInterval(requestRetryTimer)
        requestRetryTimer = null
      }
      return
    }
    realtime.emit({ type: 'request', request })
  }, 6000)
}

async function approveSelf() {
  const state = store()
  if (state.status !== 'awaiting' || joinApproved) return
  joinApproved = true

  state.join()
  connectAsSelf()
  realtime?.announce()
  wireSelfMedia()
  startStatsMonitor()
  startPresenceMonitor()
  await refreshDevices()
  pushOutgoingStream()
  applyRoomQualityCaps()
}

export function acceptRequest(requestId: ID) {
  const state = store()
  const request = state.resolveRequest(requestId)
  if (!request) return

  const participant: Participant = {
    id: request.participantId,
    name: request.name,
    role: 'guest',
    avatarColor: request.avatarColor,
    isSelf: false,
    micOn: request.micOn,
    cameraOn: request.cameraOn,
    screenSharing: false,
    isSpeaking: false,
    quality: 'excellent',
    joinedAt: Date.now(),
  }
  state.addParticipant(participant)
  realtime?.emit({ type: 'request-resolved', requestId, participantId: request.participantId, accepted: true })
      notify({ title: t('{name} joined the room', { name: request.name }), variant: 'success', duration: 2600 })
}

export function rejectRequest(requestId: ID) {
  const state = store()
  const request = state.resolveRequest(requestId)
  if (!request) return
  realtime?.emit({ type: 'request-resolved', requestId, participantId: request.participantId, accepted: false })
}

export function acceptAllRequests() {
  const ids = store().requests.map((request) => request.id)
  for (const id of ids) acceptRequest(id)
}

export function leaveRoom() {
  fullTeardown()
}

export function sendChatMessage(text: string) {
  const state = store()
  if (!state.room || !state.self) return
  if (!state.room.settings.chat.enabled) {
    notify({ title: t('Chat is disabled in this room'), variant: 'warning' })
    return
  }
  const message = buildTextMessage({
    roomId: state.room.id,
    senderId: state.self.id,
    senderName: state.self.name,
    avatarColor: state.self.avatarColor,
    text,
  })
  state.addMessage(message)
  realtime?.emit({ type: 'chat', message })
}

export async function sendFileMessage(file: File) {
  const state = store()
  if (!state.room || !state.self) return
  if (!state.room.settings.chat.enabled || !state.room.settings.chat.allowFiles) {
    notify({ title: t('File sharing is disabled in this room'), variant: 'warning' })
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    notify({
      title: t('File is too large'),
      description: t('Maximum file size is 2 MB in peer-to-peer chat.'),
      variant: 'danger',
    })
    return
  }

  let dataUrl = ''
  try {
    dataUrl = await readFileAsDataURL(file)
  } catch {
    notify({ title: t('Could not read this file'), variant: 'danger' })
    return
  }

  const message = buildFileMessage({
    roomId: state.room.id,
    senderId: state.self.id,
    senderName: state.self.name,
    avatarColor: state.self.avatarColor,
    file: {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      url: dataUrl,
    },
  })
  state.addMessage(message)
  realtime?.emit({ type: 'chat', message })
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function toggleReaction(messageId: ID, emoji: string) {
  const state = store()
  const self = state.self
  if (!self || !state.room) return
  if (!state.room.settings.chat.enabled || !state.room.settings.chat.allowReactions) {
    notify({ title: t('Reactions are disabled in this room'), variant: 'warning' })
    return
  }
  state.toggleReaction(messageId, emoji, self.id)
  realtime?.emit({ type: 'reaction', messageId, emoji, userId: self.id })
}

/**
 * Raises or lowers the local participant's hand. The raised state is part of
 * the participant record, so it rides along with heartbeats and self-updates
 * and stays correct for late joiners.
 */
export function toggleHand() {
  const state = store()
  const self = state.self
  if (!self || !state.room) return
  const raised = !self.handRaised
  state.updateParticipant(self.id, { handRaised: raised })
  realtime?.emit({ type: 'hand', participantId: self.id, raised })
  realtime?.updateSelf({ ...self, handRaised: raised })
}

/** Broadcasts a short-lived floating reaction to everyone in the room. */
export function sendFloatingReaction(emoji: string) {
  const state = store()
  const self = state.self
  if (!self || !state.room) return
  state.pushFloatingReaction(emoji, self.name)
  realtime?.emit({ type: 'float', emoji, participantId: self.id, name: self.name })
}

export function pinMessage(message: ChatMessage | null) {
  const state = store()
  const self = state.self
  if (!self) return
  const canModerateSelf = self.role === 'host' || Boolean(self.permissions?.canModerate)
  if (message) {
    if (message.kind === 'system') return
    if (!canModerateSelf && message.senderId !== self.id) return
  } else if (!canModerateSelf && state.pinnedMessage?.senderId !== self.id) {
    return
  }
  state.setPinnedMessage(message)
  realtime?.emit({ type: 'pin', message })
}

function currentActivities() {
  const state = store()
  return { polls: state.polls, tasks: state.tasks, todos: state.todos, timer: state.timer }
}

function publishActivities(activities: ReturnType<typeof currentActivities>) {
  realtime?.emit({ type: 'activity', ...activities })
}

function canEditActivity(self: Participant, createdBy: ID) {
  return self.role === 'host' || Boolean(self.permissions?.canModerate) || self.id === createdBy
}

export function addPoll(question: string, optionTexts: string[], note = '') {
  const state = store()
  const self = state.self
  if (!self) return
  const trimmedQuestion = question.trim()
  const texts = optionTexts.map((text) => text.trim()).filter(Boolean)
  if (!trimmedQuestion || texts.length < 2) return
  const poll: Poll = {
    id: generateId('poll'),
    question: trimmedQuestion,
    note: note.trim(),
    options: texts.map((text) => ({ id: generateId('opt'), text, votes: [] })),
    createdBy: self.id,
    createdAt: Date.now(),
    closed: false,
  }
  const activities = { ...currentActivities(), polls: [...state.polls, poll] }
  state.setActivities(activities)
  publishActivities(activities)
}

export function votePoll(pollId: ID, optionId: ID) {
  const state = store()
  const self = state.self
  if (!self) return
  const polls = state.polls.map((poll) => {
    if (poll.id !== pollId || poll.closed) return poll
    const votedOptionId = poll.options.find((option) => option.votes.includes(self.id))?.id ?? null
    const changeVote = votedOptionId === optionId
    return {
      ...poll,
      options: poll.options.map((option) => {
        const votes = option.votes.filter((userId) => userId !== self.id)
        if (option.id === optionId && !changeVote) votes.push(self.id)
        return { ...option, votes }
      }),
    }
  })
  const activities = { ...currentActivities(), polls }
  state.setActivities(activities)
  publishActivities(activities)
}

export function closePoll(pollId: ID) {
  const state = store()
  const self = state.self
  if (!self) return
  const polls = state.polls.map((poll) => (poll.id === pollId ? { ...poll, closed: true } : poll))
  const activities = { ...currentActivities(), polls }
  state.setActivities(activities)
  publishActivities(activities)
}

export function deletePoll(pollId: ID) {
  const state = store()
  const self = state.self
  const target = state.polls.find((poll) => poll.id === pollId)
  if (!self || !target || !canEditActivity(self, target.createdBy)) return
  const activities = { ...currentActivities(), polls: state.polls.filter((poll) => poll.id !== pollId) }
  state.setActivities(activities)
  publishActivities(activities)
}

export function addTask(title: string, assigneeId: ID | null = null, note = '') {
  const state = store()
  const self = state.self
  if (!self || !title.trim()) return
  const task: ActivityTask = {
    id: generateId('task'),
    title: title.trim(),
    note: note.trim(),
    assigneeId,
    done: false,
    createdBy: self.id,
    createdAt: Date.now(),
  }
  const activities = { ...currentActivities(), tasks: [...state.tasks, task] }
  state.setActivities(activities)
  publishActivities(activities)
}

function patchTask(taskId: ID, patch: Partial<ActivityTask>) {
  const state = store()
  const self = state.self
  if (!self) return
  const target = state.tasks.find((task) => task.id === taskId)
  if (!target) return

  // Completing a task is the assignee's job. Unassigned tasks fall back to the
  // host/moderator/creator so they don't get stuck forever.
  if (patch.done !== undefined && patch.done !== target.done) {
    const canToggle =
      target.assigneeId != null ? target.assigneeId === self.id : canEditActivity(self, target.createdBy)
    if (!canToggle) return
  }
  // Reassigning (or leaving a note on) a task stays with the host, moderators,
  // and whoever created it.
  if ((patch.assigneeId !== undefined || patch.note !== undefined) && !canEditActivity(self, target.createdBy)) {
    return
  }

  const activities = {
    ...currentActivities(),
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
  }
  state.setActivities(activities)
  publishActivities(activities)
}

export function toggleTask(taskId: ID) {
  const state = store()
  const target = state.tasks.find((task) => task.id === taskId)
  if (!target) return
  patchTask(taskId, { done: !target.done })
}

export function setTaskAssignee(taskId: ID, assigneeId: ID | null) {
  patchTask(taskId, { assigneeId })
}

export function setTaskNote(taskId: ID, note: string) {
  patchTask(taskId, { note })
}

/**
 * Locks (or unlocks) a task against deletion. Only the host or a moderator may
 * flip this; while locked, `deleteTask` refuses for everyone.
 */
export function setTaskLocked(taskId: ID, locked: boolean) {
  const state = store()
  const self = state.self
  if (!self || !(self.role === 'host' || self.permissions?.canModerate)) return
  const target = state.tasks.find((task) => task.id === taskId)
  if (!target) return
  const activities = {
    ...currentActivities(),
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, locked } : task)),
  }
  state.setActivities(activities)
  publishActivities(activities)
}

export function deleteTask(taskId: ID) {
  const state = store()
  const self = state.self
  const target = state.tasks.find((task) => task.id === taskId)
  if (!self || !target || target.locked || !canEditActivity(self, target.createdBy)) return
  const activities = { ...currentActivities(), tasks: state.tasks.filter((task) => task.id !== taskId) }
  state.setActivities(activities)
  publishActivities(activities)
}

export function addTodo(text: string, note = '') {
  const state = store()
  const self = state.self
  if (!self || !text.trim()) return
  const item: TodoItem = {
    id: generateId('todo'),
    text: text.trim(),
    note: note.trim(),
    done: false,
    createdBy: self.id,
    createdAt: Date.now(),
  }
  const activities = { ...currentActivities(), todos: [...state.todos, item] }
  state.setActivities(activities)
  publishActivities(activities)
}

export function toggleTodo(todoId: ID) {
  const state = store()
  const self = state.self
  const target = state.todos.find((todo) => todo.id === todoId)
  // To-do lists are personal: only their owner can tick an item.
  if (!self || !target || target.createdBy !== self.id) return
  const activities = {
    ...currentActivities(),
    todos: state.todos.map((todo) => (todo.id === todoId ? { ...todo, done: !todo.done } : todo)),
  }
  state.setActivities(activities)
  publishActivities(activities)
}

export function deleteTodo(todoId: ID) {
  const state = store()
  const self = state.self
  const target = state.todos.find((todo) => todo.id === todoId)
  if (!self || !target || target.createdBy !== self.id) return
  const activities = { ...currentActivities(), todos: state.todos.filter((todo) => todo.id !== todoId) }
  state.setActivities(activities)
  publishActivities(activities)
}

export function startTimer(durationMs: number, note = '') {
  const state = store()
  const self = state.self
  if (!self || durationMs <= 0) return
  const timer: RoomTimer = {
    endsAt: Date.now() + durationMs,
    remainingMs: durationMs,
    running: true,
    startedBy: self.id,
    note: note.trim(),
  }
  const activities = { ...currentActivities(), timer }
  state.setActivities(activities)
  publishActivities(activities)
}

export function pauseTimer() {
  const state = store()
  const timer = state.timer
  if (!timer?.running || !timer.endsAt) return
  const activities = {
    ...currentActivities(),
    timer: { ...timer, endsAt: null, remainingMs: Math.max(0, timer.endsAt - Date.now()), running: false },
  }
  state.setActivities(activities)
  publishActivities(activities)
}

export function resumeTimer() {
  const state = store()
  const timer = state.timer
  if (!timer || timer.running || timer.remainingMs <= 0) return
  const activities = {
    ...currentActivities(),
    timer: { ...timer, endsAt: Date.now() + timer.remainingMs, running: true },
  }
  state.setActivities(activities)
  publishActivities(activities)
}

export function resetTimer() {
  const state = store()
  if (!state.timer) return
  const activities = { ...currentActivities(), timer: null }
  state.setActivities(activities)
  publishActivities(activities)
}

export async function toggleMic() {
  const call = useCallStore.getState()
  if (call.audioPermission === 'unknown') {
    await prepareMedia(true, false, true)
  }
  const current = useCallStore.getState()
  if (current.audioPermission !== 'granted' || !mediaEngine.hasAudioTrack()) {
    notify({
      title: t('No microphone available'),
      description: t('Check your device settings and browser permissions.'),
      variant: 'warning',
    })
    return
  }
  current.setMic(!current.micOn)
  mediaEngine.setMic(!current.micOn)
  syncSelf()
  pushOutgoingStream()
}

export async function toggleCamera() {
  const call = useCallStore.getState()
  if (call.videoPermission === 'unknown') {
    await prepareMedia(call.micOn, true, true)
  }
  const current = useCallStore.getState()
  if (current.videoPermission !== 'granted' || !mediaEngine.hasVideoTrack()) {
    notify({
      title: t('No camera available'),
      description: t('Check your device settings and browser permissions.'),
      variant: 'warning',
    })
    return
  }
  current.setCamera(!current.cameraOn)
  mediaEngine.setCamera(!current.cameraOn)
  syncSelf()
  pushOutgoingStream()
}

export async function toggleScreenShare() {
  const state = store()
  const room = state.room
  const self = state.self
  const call = useCallStore.getState()
  if (!room || !self) return

  if (!room.settings.screenShare.allow) {
    notify({ title: t('Screen sharing is disabled by the host'), variant: 'warning' })
    return
  }
  if (!isAuthenticatedHost() && !self.permissions?.canShareScreen && !room.settings.screenShare.allowParticipants) {
    notify({ title: t('Only the host can share their screen'), variant: 'warning' })
    return
  }

  if (call.sharing) {
    mediaEngine.stopScreenShare()
    call.setSharing(false)
    syncSelf()
    pushOutgoingStream()
    return
  }

  const activeShares = state.participants.filter((participant) => participant.screenSharing).length
  if (activeShares >= room.settings.screenShare.maxScreens) {
    notify({
      title: t('Screen share limit reached'),
      description: t('The host allows up to {count} simultaneous screens.', {
        count: room.settings.screenShare.maxScreens,
      }),
      variant: 'warning',
    })
    return
  }

  const started = await mediaEngine.startScreenShare()
  if (!started) {
    notify({
      title: t('Screen sharing is not supported on this device'),
      description: t('This browser cannot capture your screen. You can still share your camera.'),
      variant: 'warning',
      duration: 5000,
    })
    return
  }
  call.setSharing(true)
  syncSelf()
  pushOutgoingStream()
}

export async function switchDevice(kind: 'audio' | 'video', deviceId: string) {
  const call = useCallStore.getState()
  call.setActiveDevice(kind, deviceId)
  const status =
    kind === 'audio'
      ? await mediaEngine.switchAudioDevice(deviceId)
      : await mediaEngine.switchVideoDevice(deviceId)

  if (kind === 'audio') {
    call.setPermissions({ audioPermission: status })
    call.setMic(status === 'granted')
    mediaEngine.setMic(status === 'granted')
  } else {
    call.setPermissions({ videoPermission: status })
    call.setCamera(status === 'granted')
    mediaEngine.setCamera(status === 'granted')
  }
  await refreshDevices()
  syncSelf()
  pushOutgoingStream()
}

export function applyLocalAudioPreferences(prefs: { noiseFilter: NoiseFilter; echoCancellation: boolean }) {
  const av = store().room?.settings.av
  mediaEngine.setPreferences(
    {
      echoCancellation: prefs.echoCancellation,
      noiseSuppression: prefs.noiseFilter !== 'off',
      autoGainControl: prefs.noiseFilter !== 'off',
      videoQuality: av?.videoQuality ?? 'auto',
      audioQuality: av?.audioQuality ?? 'auto',
    },
    true,
  )
  void (async () => {
    const status = await mediaEngine.reapplyAudio()
    const call = useCallStore.getState()
    call.setPermissions({ audioPermission: status })
    const granted = status === 'granted'
    call.setMic(granted && call.micOn)
    mediaEngine.setMic(granted && call.micOn)
    syncSelf()
    pushOutgoingStream()
  })()
}

export function applyHostSettings(patch: RoomSettingsPatch) {
  const state = store()
  const self = state.self
  if (!self || (!isAuthenticatedHost() && !self.permissions?.canManageRoom)) return
  state.applySettingsPatch(patch)
  realtime?.emit({ type: 'settings', patch })
  if (patch.av) applyRoomAvSettings()
  if (patch.security) scheduleAutoExpire()
}

/**
 * Grants (or clears, with an empty object) a set of rights for one participant.
 * Only the host can do this; the grant is broadcast so every device — including
 * the recipient — picks it up through the regular `peer-update` self handler.
 */
export function grantParticipantPermissions(participantId: ID, permissions: ParticipantPermissions) {
  const state = store()
  const self = state.self
  if (!isAuthenticatedHost() || !self) return
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.id === self.id || target.role === 'host') return
  state.updateParticipant(participantId, { permissions })
  realtime?.emit({ type: 'peer-update', participantId, patch: { permissions } })
}

/** Host rights: the device must be an authenticated host, or be a granted moderator. */
function canModerate(): boolean {
  const self = store().self
  if (!self) return false
  return Boolean(self.permissions?.canModerate) || isAuthenticatedHost()
}

export function hostMuteParticipant(participantId: ID) {
  const state = store()
  if (!canModerate()) return
  if (state.room && !state.room.settings.participants.allowMuteOthers) {
    notify({ title: t('Muting others is disabled in this room'), variant: 'warning' })
    return
  }
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.role === 'host') return
  state.updateParticipant(participantId, { micOn: false })
  realtime?.emit({ type: 'peer-update', participantId, patch: { micOn: false } })
  notify({ title: t('Muted {name}', { name: target.name }), duration: 2200 })
}

export function hostDisableCamera(participantId: ID) {
  const state = store()
  if (!canModerate()) return
  if (state.room && !state.room.settings.participants.allowMuteOthers) {
    notify({ title: t('The host disabled turning off others’ cameras'), variant: 'warning' })
    return
  }
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.role === 'host') return
  state.updateParticipant(participantId, { cameraOn: false })
  realtime?.emit({ type: 'peer-update', participantId, patch: { cameraOn: false } })
  notify({ title: t("Turned off {name}'s camera", { name: target.name }), duration: 2200 })
}

export function hostRemoveParticipant(participantId: ID) {
  const state = store()
  if (!canModerate()) return
  if (state.room && !state.room.settings.participants.allowRemoveOthers) {
    notify({ title: t('The host disabled removing others'), variant: 'warning' })
    return
  }
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.role === 'host') return
  state.removeParticipant(participantId)
  realtime?.emit({ type: 'kick', participantId })
  state.addMessage(buildSystemMessage(state.room?.id ?? '', t('{name} was removed by the host', { name: target.name })))
  notify({ title: t('Removed {name}', { name: target.name }), duration: 2600 })
}

export function hostTransferHost(participantId: ID) {
  const state = store()
  const self = state.self
  const roomId = activeRoomId
  if (!self || !isAuthenticatedHost() || !roomId) return
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.id === self.id) return

  // Hand the host token to the new host over their peer connection ONLY, then
  // revoke ours. Broadcast role patches promote the new host for everyone, but
  // authority stays with whichever device holds the token.
  const token = createHostToken()
  realtime?.sendTarget({ type: 'host-transfer', token, to: target.id }, target.id)
  useSessionStore.getState().clearHostToken(roomId)

  state.updateParticipant(self.id, { role: 'guest' })
  state.updateParticipant(target.id, { role: 'host' })
  realtime?.emit({ type: 'peer-update', participantId: self.id, patch: { role: 'guest' } })
  realtime?.emit({ type: 'peer-update', participantId: target.id, patch: { role: 'host' } })
  state.addMessage(buildSystemMessage(state.room?.id ?? '', t('{name} is now the host', { name: target.name })))
  notify({ title: t('Host transferred to {name}', { name: target.name }), variant: 'success' })
}

/**
 * The host hands the host role to another participant and leaves the room.
 * Peers pick up the role change through the regular `peer-update` self handler
 * (which promotes the new host), and an optional note is posted to the room.
 */
export function hostLeaveWithDelegate(participantId: ID, note?: string) {
  const state = store()
  const self = state.self
  const roomId = activeRoomId
  if (!self || !isAuthenticatedHost() || !roomId) return
  const target = state.participants.find((participant) => participant.id === participantId)
  if (target && target.id !== self.id) {
    const token = createHostToken()
    realtime?.sendTarget({ type: 'host-transfer', token, to: target.id }, target.id)
    state.updateParticipant(target.id, { role: 'host' })
    realtime?.emit({ type: 'peer-update', participantId: target.id, patch: { role: 'host' } })
    state.addMessage(buildSystemMessage(state.room?.id ?? '', t('{name} is now the host of this room', { name: target.name })))
  }
  useSessionStore.getState().clearHostToken(roomId)
  if (note && note.trim()) {
    state.addMessage(buildSystemMessage(state.room?.id ?? '', note.trim()))
  }
  leaveRoom()
}

/**
 * (Re)schedules the temporary-room countdown. Only the authenticated host arms
 * it, since ending the room is a host action; changing the setting cancels the
 * previous timer first so the schedule always matches the saved settings.
 */
function scheduleAutoExpire() {
  if (expireTimer !== null) {
    window.clearTimeout(expireTimer)
    expireTimer = null
  }
  const room = store().room
  if (!room || !isAuthenticatedHost()) return
  const { temporary, autoExpireMinutes } = room.settings.security
  if (!temporary || autoExpireMinutes <= 0) return
  expireTimer = window.setTimeout(() => {
    expireTimer = null
    if (isAuthenticatedHost() && store().room?.settings.security.temporary) {
      notify({ title: t('This temporary room has ended'), variant: 'info', duration: 5000 })
      hostEndRoom()
    }
  }, autoExpireMinutes * 60_000)
}

function stopAutoExpire() {
  if (expireTimer !== null) window.clearTimeout(expireTimer)
  expireTimer = null
}

export function hostEndRoom() {
  const state = store()
  if (!isAuthenticatedHost()) return
  stopAutoExpire()
  realtime?.emit({ type: 'end' })
  stopLocalMedia()
  state.setStatus('ended')
  const roomId = activeRoomId
  if (roomId) {
    useRoomsStore.getState().removeRoom(roomId)
    announceRoomDeletion(roomId)
  }
}

export function hostToggleLock(locked: boolean) {
  const state = store()
  const self = state.self
  if (!self || (!isAuthenticatedHost() && !self.permissions?.canManageRoom)) return
  applyHostSettings({ access: { lockRoom: locked } })
  if (state.room) {
    state.addMessage(buildSystemMessage(state.room.id, locked ? t('Room was locked') : t('Room was unlocked')))
  }
}

function handleDeviceChange() {
  void refreshDevices()
  const call = useCallStore.getState()
  if (call.audioPermission === 'granted' && !mediaEngine.hasAudioTrack()) {
    call.setMic(false)
  }
  if (call.videoPermission === 'granted' && !mediaEngine.hasVideoTrack()) {
    call.setCamera(false)
  }
}