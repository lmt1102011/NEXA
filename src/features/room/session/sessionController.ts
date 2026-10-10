import type {
  ActivityTask,
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
const STALE_EVICT_MS = 12000

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

let videoCap: number | null = null

let realtime: RealtimeService | null = null
let offRealtime: (() => void) | null = null
let offRemoteStream: (() => void) | null = null
let offSpeaking: (() => void) | null = null
let offStream: (() => void) | null = null
let statsTimer: number | null = null
let presenceTimer: number | null = null
let lastSeen = new Map<ID, number>()
let activeRoomId: ID | null = null
let joinApproved = false
let requestRetryTimer: number | null = null

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
    void prepareMedia(
      store().room?.settings.participants.defaultMic ?? true,
      store().room?.settings.participants.defaultCamera ?? true,
      true,
    )
  }

  navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange)
  window.addEventListener('pagehide', handlePageHide)

  return () => {
    navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange)
    window.removeEventListener('pagehide', handlePageHide)
    fullTeardown()
  }
}

function connectAsSelf() {
  const self = store().self
  if (!realtime || !self) return
  realtime.connect(activeRoomId ?? '', self)
  store().setConnected(true)
}

function handlePageHide() {
  const self = store().self
  if (self) realtime?.emit({ type: 'peer-leave', participantId: self.id })
  if (activeRoomId) decParticipantCount(activeRoomId)
  realtime?.disconnect()
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
  realtime?.dispose()
  realtime = null
}

function stopLocalMedia() {
  offSpeaking?.()
  offSpeaking = null
  offStream?.()
  offStream = null
  stopPresenceMonitor()
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

  if (next === current) return
  videoCap = next
  realtime?.setVideoMaxBitrate(videoCap)
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
  }
}

function startPresenceMonitor() {
  if (presenceTimer !== null) return
  const tick = () => {
    const self = store().self
    if (self && realtime) {
      lastSeen.set(self.id, Date.now())
      realtime.emit({ type: 'heartbeat', participantId: self.id, participant: self })
    }
    evictSilentPeers()
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
    const noiseFilter = store().room?.settings.av.noiseFilter ?? 'light'
    mediaEngine.setPreferences({
      echoCancellation: store().room?.settings.av.echoCancellation ?? true,
      noiseSuppression: noiseFilter !== 'off',
      autoGainControl: noiseFilter !== 'off',
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

function sanitizeParticipant(participant: Participant): Participant {
  return { ...participant, isSelf: false }
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

function handleRealtimeEvent(event: RoomEvent) {
  const state = store()
  const selfId = state.self?.id

  switch (event.type) {
    case 'peer-hello': {
      if (event.participant.id === selfId) return
      touchParticipant(event.participant.id)
      state.addParticipant(sanitizeParticipant(event.participant))
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
      if (event.participantId === selfId) {
        if (!state.self) break
        const patch = event.patch
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
      state.updateParticipant(event.participantId, { ...event.patch, isSelf: false })
      if (state.self?.role === 'host' && event.patch.name !== undefined) {
        const clash = nameTakenBy(event.patch.name, event.participantId)
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
    case 'chat':
      state.addMessage(event.message)
      break
    case 'pin':
      state.setPinnedMessage(event.message)
      break
    case 'activity': {
      const previousTasks = new Map(state.tasks.map((task) => [task.id, task] as const))
      const selfAssigned = selfId
        ? event.tasks.filter(
            (task) => task.assigneeId === selfId && previousTasks.get(task.id)?.assigneeId !== selfId,
          )
        : []
      const pollsGrew = event.polls.length > state.polls.length
      state.setActivities({
        polls: event.polls,
        tasks: event.tasks,
        todos: event.todos,
        timer: event.timer,
      })
      if (selfAssigned.length > 0) {
        notify({ title: t('New task assigned to you: "{title}"', { title: selfAssigned[0].title }), variant: 'info', duration: 5000 })
      }
      if (selfAssigned.length > 0 || pollsGrew) state.bumpActivitiesUnread()
      break
    }
    case 'reaction':
      state.toggleReaction(event.messageId, event.emoji, event.userId)
      break
    case 'request': {
      if (!isAuthenticatedHost()) return
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
      // Only the room's host may resolve join requests. When the sender's
      // identity is known, a spoofed "accepted" from another peer is ignored.
      if (event.senderId !== undefined && state.room && event.senderId !== state.room.hostId) return
      if (event.accepted) void approveSelf()
      else state.setStatus('rejected', 'Your request was declined by the host.')
      break
    }
    case 'settings': {
      state.applySettingsPatch(event.patch)
      if (event.patch.access?.lockRoom !== undefined) {
        state.addMessage(
          buildSystemMessage(activeRoomId ?? '', event.patch.access.lockRoom ? t('Room was locked') : t('Room was unlocked')),
        )
      }
      break
    }
    case 'kick': {
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
      // A room can only be ended by the device holding the host role. When the
      // sender's identity is known, reject end-commands from anyone else.
      if (event.senderId !== undefined && state.room && event.senderId !== state.room.hostId) break
      stopLocalMedia()
      state.setStatus('ended')
      if (activeRoomId) {
        useRoomsStore.getState().removeRoom(activeRoomId)
      }
      break
    }
    case 'host-transfer': {
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
  if (!self) return
  state.toggleReaction(messageId, emoji, self.id)
  realtime?.emit({ type: 'reaction', messageId, emoji, userId: self.id })
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

export function deleteTask(taskId: ID) {
  const state = store()
  const self = state.self
  const target = state.tasks.find((task) => task.id === taskId)
  if (!self || !target || !canEditActivity(self, target.createdBy)) return
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
  mediaEngine.setPreferences(
    {
      echoCancellation: prefs.echoCancellation,
      noiseSuppression: prefs.noiseFilter !== 'off',
      autoGainControl: prefs.noiseFilter !== 'off',
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
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.role === 'host') return
  state.updateParticipant(participantId, { micOn: false })
  realtime?.emit({ type: 'peer-update', participantId, patch: { micOn: false } })
  notify({ title: t('Muted {name}', { name: target.name }), duration: 2200 })
}

export function hostDisableCamera(participantId: ID) {
  const state = store()
  if (!canModerate()) return
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.role === 'host') return
  state.updateParticipant(participantId, { cameraOn: false })
  realtime?.emit({ type: 'peer-update', participantId, patch: { cameraOn: false } })
  notify({ title: t("Turned off {name}'s camera", { name: target.name }), duration: 2200 })
}

export function hostRemoveParticipant(participantId: ID) {
  const state = store()
  if (!canModerate()) return
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

export function hostEndRoom() {
  const state = store()
  if (!isAuthenticatedHost()) return
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