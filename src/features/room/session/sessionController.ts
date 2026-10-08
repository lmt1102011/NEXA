import type { ID, JoinRequest, NoiseFilter, Participant, ParticipantPermissions, ToastInput } from '@/types'
import type { RoomSettingsPatch } from '@/lib/defaults'
import type { RoomEvent, RealtimeService } from '@/services/realtime'
import { createRealtimeService } from '@/services/realtime'
import { mediaEngine } from '@/services/media/MediaEngine'
import { qualityController } from '@/services/media/QualityController'
import { announceRoomDeletion } from '@/services/directory/PublicRoomsDirectory'
import { buildFileMessage, buildSystemMessage, buildTextMessage } from '@/lib/chat'
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
let enteredViaLink = false

/**
 * Marks the current session as having been entered through a shared room link
 * (or the public list). People who enter a room this way skip the approval
 * queue: they still complete the pre-join preview (name, mic, camera) but join
 * the room instantly afterwards.
 */
export function markEnteredViaRoomLink() {
  enteredViaLink = true
}

function notify(input: ToastInput) {
  toast(input)
}

function store() {
  return useRoomSessionStore.getState()
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
  realtime?.disconnect()
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
          title: result.audio === 'denied' ? 'Microphone access denied' : 'No microphone found',
          description: 'You can still watch and chat in this room.',
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
          title: result.video === 'denied' ? 'Camera access denied' : 'No camera found',
          description: 'You can still join with audio only.',
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
      title: 'Name is already taken',
      description: `“${clash}” is used by someone else here. Pick a different name.`,
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
        if (promoted) notify({ title: 'You are now the host of this room', variant: 'success' })
        if (grantedPermissions) notify({ title: 'The host granted you new permissions', variant: 'success', duration: 4000 })
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
    case 'reaction':
      state.toggleReaction(event.messageId, event.emoji, event.userId)
      break
    case 'request': {
      if (state.self?.role !== 'host') return
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
        title: `${event.request.name} wants to join`,
        description: 'Open Participants to review the request.',
        variant: 'info',
        duration: 6000,
      })
      break
    }
    case 'request-resolved': {
      if (event.participantId !== useSessionStore.getState().userId) return
      if (event.accepted) void approveSelf()
      else state.setStatus('rejected', 'Your request was declined by the host.')
      break
    }
    case 'settings': {
      state.applySettingsPatch(event.patch)
      if (event.patch.access?.lockRoom !== undefined) {
        state.addMessage(
          buildSystemMessage(activeRoomId ?? '', event.patch.access.lockRoom ? 'Room was locked' : 'Room was unlocked'),
        )
      }
      break
    }
    case 'kick': {
      if (event.participantId === selfId) {
        state.setStatus('rejected', 'The host removed you from this room.')
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
        title: 'Name is already taken',
        description: `“${event.name}” belongs to someone else here. Choose another name to join.`,
        variant: 'danger',
        duration: 6000,
      })
      break
    }
    case 'end':
      stopLocalMedia()
      state.setStatus('ended')
      if (activeRoomId) {
        useRoomsStore.getState().removeRoom(activeRoomId)
      }
      break
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
    role: room.hostId === session.userId ? 'host' : 'guest',
    avatarColor: session.avatarColor,
  })
  self.micOn = call.micOn
  self.cameraOn = call.cameraOn
  state.setSelf(self)
  state.setStatus('awaiting')

  if (!room.settings.access.requireApproval || enteredViaLink || room.hostId === session.userId) {
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
  notify({ title: `${request.name} joined the room`, variant: 'success', duration: 2600 })
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
    notify({ title: 'Chat is disabled in this room', variant: 'warning' })
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
    notify({ title: 'File sharing is disabled in this room', variant: 'warning' })
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    notify({
      title: 'File is too large',
      description: 'Maximum file size is 2 MB in peer-to-peer chat.',
      variant: 'danger',
    })
    return
  }

  let dataUrl = ''
  try {
    dataUrl = await readFileAsDataURL(file)
  } catch {
    notify({ title: 'Could not read this file', variant: 'danger' })
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

export async function toggleMic() {
  const call = useCallStore.getState()
  if (call.audioPermission === 'unknown') {
    await prepareMedia(true, false, true)
  }
  const current = useCallStore.getState()
  if (current.audioPermission !== 'granted' || !mediaEngine.hasAudioTrack()) {
    notify({
      title: 'No microphone available',
      description: 'Check your device settings and browser permissions.',
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
      title: 'No camera available',
      description: 'Check your device settings and browser permissions.',
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
    notify({ title: 'Screen sharing is disabled by the host', variant: 'warning' })
    return
  }
  if (self.role !== 'host' && !self.permissions?.canShareScreen && !room.settings.screenShare.allowParticipants) {
    notify({ title: 'Only the host can share their screen', variant: 'warning' })
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
  if (!started) return
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
  if (!self || (self.role !== 'host' && !self.permissions?.canManageRoom)) return
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
  if (state.self?.role !== 'host') return
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.id === state.self.id || target.role === 'host') return
  state.updateParticipant(participantId, { permissions })
  realtime?.emit({ type: 'peer-update', participantId, patch: { permissions } })
}

/** Host rights: the host always, or a participant granted `canModerate`. */
function canModerate(): boolean {
  const self = store().self
  if (!self) return false
  return self.role === 'host' || Boolean(self.permissions?.canModerate)
}

export function hostMuteParticipant(participantId: ID) {
  const state = store()
  if (!canModerate()) return
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.role === 'host') return
  state.updateParticipant(participantId, { micOn: false })
  realtime?.emit({ type: 'peer-update', participantId, patch: { micOn: false } })
  notify({ title: `Muted ${target.name}`, duration: 2200 })
}

export function hostDisableCamera(participantId: ID) {
  const state = store()
  if (!canModerate()) return
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.role === 'host') return
  state.updateParticipant(participantId, { cameraOn: false })
  realtime?.emit({ type: 'peer-update', participantId, patch: { cameraOn: false } })
  notify({ title: `Turned off ${target.name}'s camera`, duration: 2200 })
}

export function hostRemoveParticipant(participantId: ID) {
  const state = store()
  if (!canModerate()) return
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.role === 'host') return
  state.removeParticipant(participantId)
  realtime?.emit({ type: 'kick', participantId })
  state.addMessage(buildSystemMessage(state.room?.id ?? '', `${target.name} was removed by the host`))
  notify({ title: `Removed ${target.name}`, duration: 2600 })
}

export function hostTransferHost(participantId: ID) {
  const state = store()
  const self = state.self
  if (!self || self.role !== 'host') return
  const target = state.participants.find((participant) => participant.id === participantId)
  if (!target || target.id === self.id) return

  state.updateParticipant(self.id, { role: 'guest' })
  state.updateParticipant(target.id, { role: 'host' })
  realtime?.emit({ type: 'peer-update', participantId: self.id, patch: { role: 'guest' } })
  realtime?.emit({ type: 'peer-update', participantId: target.id, patch: { role: 'host' } })
  state.addMessage(buildSystemMessage(state.room?.id ?? '', `${target.name} is now the host`))
  notify({ title: `Host transferred to ${target.name}`, variant: 'success' })
}

/**
 * The host hands the host role to another participant and leaves the room.
 * Peers pick up the role change through the regular `peer-update` self handler
 * (which promotes the new host), and an optional note is posted to the room.
 */
export function hostLeaveWithDelegate(participantId: ID, note?: string) {
  const state = store()
  const self = state.self
  if (!self || self.role !== 'host') return
  const target = state.participants.find((participant) => participant.id === participantId)
  if (target && target.id !== self.id) {
    state.updateParticipant(target.id, { role: 'host' })
    realtime?.emit({ type: 'peer-update', participantId: target.id, patch: { role: 'host' } })
    state.addMessage(buildSystemMessage(state.room?.id ?? '', `${target.name} is now the host of this room`))
  }
  if (note && note.trim()) {
    state.addMessage(buildSystemMessage(state.room?.id ?? '', note.trim()))
  }
  leaveRoom()
}

export function hostEndRoom() {
  const state = store()
  if (state.self?.role !== 'host') return
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
  if (!self || (self.role !== 'host' && !self.permissions?.canManageRoom)) return
  applyHostSettings({ access: { lockRoom: locked } })
  if (state.room) {
    state.addMessage(buildSystemMessage(state.room.id, locked ? 'Room was locked' : 'Room was unlocked'))
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