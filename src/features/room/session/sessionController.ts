import type { ID, JoinRequest, Participant, ToastInput } from '@/types'
import type { RoomSettingsPatch } from '@/lib/defaults'
import type { RoomEvent, RealtimeService } from '@/services/realtime'
import { createRealtimeService } from '@/services/realtime'
import { mediaEngine } from '@/services/media/MediaEngine'
import { qualityController } from '@/services/media/QualityController'
import { buildFileMessage, buildSystemMessage, buildTextMessage } from '@/lib/chat'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore, buildSelfParticipant } from '@/stores/roomSession'
import { useRoomsStore } from '@/stores/rooms'
import { useSessionStore } from '@/stores/session'
import { toast } from '@/stores/ui'

const STATS_INTERVAL_MS = 3000
const MAX_FILE_SIZE = 2 * 1024 * 1024

let realtime: RealtimeService | null = null
let offRealtime: (() => void) | null = null
let offRemoteStream: (() => void) | null = null
let offSpeaking: (() => void) | null = null
let offStream: (() => void) | null = null
let statsTimer: number | null = null
let activeRoomId: ID | null = null
let joinApproved = false

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
  realtime?.disconnect()
}

function cleanupTransport() {
  offRealtime?.()
  offRealtime = null
  offRemoteStream?.()
  offRemoteStream = null
  stopStatsMonitor()
  realtime?.dispose()
  realtime = null
}

function stopLocalMedia() {
  offSpeaking?.()
  offSpeaking = null
  offStream?.()
  offStream = null
  cleanupTransport()
  mediaEngine.dispose()
  useCallStore.getState().reset()
}

function fullTeardown() {
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

function startStatsMonitor() {
  if (statsTimer !== null) return
  statsTimer = window.setInterval(() => {
    void (async () => {
      try {
        const sample = await realtime?.measureStats()
        if (sample) qualityController.report(sample)
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
  mediaEngine.setPreferences({
    echoCancellation: store().room?.settings.av.echoCancellation ?? true,
    noiseSuppression: store().room?.settings.av.noiseSuppression ?? true,
  })

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

function handleRealtimeEvent(event: RoomEvent) {
  const state = store()
  const selfId = state.self?.id

  switch (event.type) {
    case 'peer-hello': {
      if (event.participant.id === selfId) return
      state.addParticipant(sanitizeParticipant(event.participant))
      break
    }
    case 'peer-ack': {
      if (event.participant.id === selfId) return
      state.addParticipant(sanitizeParticipant(event.participant))
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
        state.setSelf({ ...state.self, ...patch, isSelf: true })
        if (promoted) notify({ title: 'You are now the host of this room', variant: 'success' })
        break
      }
      state.updateParticipant(event.participantId, { ...event.patch, isSelf: false })
      break
    }
    case 'peer-leave': {
      if (event.participantId === selfId) return
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
    case 'end':
      stopLocalMedia()
      state.setStatus('ended')
      if (activeRoomId) {
        useRoomsStore.getState().updateMeta(activeRoomId, { status: 'idle', participantCount: 0 })
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

  if (!room.settings.access.requireApproval) {
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
  if (self.role !== 'host' && !room.settings.screenShare.allowParticipants) {
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

export function applyHostSettings(patch: RoomSettingsPatch) {
  const state = store()
  if (state.self?.role !== 'host') return
  state.applySettingsPatch(patch)
  realtime?.emit({ type: 'settings', patch })
}

export function hostMuteParticipant(participantId: ID) {
  const state = store()
  if (state.self?.role !== 'host') return
  state.updateParticipant(participantId, { micOn: false })
  realtime?.emit({ type: 'peer-update', participantId, patch: { micOn: false } })
  const target = state.participants.find((participant) => participant.id === participantId)
  if (target) notify({ title: `Muted ${target.name}`, duration: 2200 })
}

export function hostRemoveParticipant(participantId: ID) {
  const state = store()
  if (state.self?.role !== 'host') return
  const target = state.participants.find((participant) => participant.id === participantId)
  state.removeParticipant(participantId)
  realtime?.emit({ type: 'kick', participantId })
  if (target) {
    state.addMessage(buildSystemMessage(state.room?.id ?? '', `${target.name} was removed by the host`))
    notify({ title: `Removed ${target.name}`, duration: 2600 })
  }
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

export function hostEndRoom() {
  const state = store()
  if (state.self?.role !== 'host') return
  realtime?.emit({ type: 'end' })
  stopLocalMedia()
  state.setStatus('ended')
  if (activeRoomId) {
    useRoomsStore.getState().updateMeta(activeRoomId, { status: 'idle', participantCount: 0 })
  }
}

export function hostToggleLock(locked: boolean) {
  applyHostSettings({ access: { lockRoom: locked } })
  const state = store()
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