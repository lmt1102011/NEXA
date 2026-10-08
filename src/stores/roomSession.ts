import { create } from 'zustand'
import type {
  ChatMessage,
  ID,
  JoinRequest,
  Participant,
  Room,
  SessionStatus,
} from '@/types'
import { mergeRoomSettings, type RoomSettingsPatch } from '@/lib/defaults'
import { useRoomsStore } from '@/stores/rooms'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'

interface RoomSessionState {
  status: SessionStatus
  statusDetail: string
  room: Room | null
  self: Participant | null
  participants: Participant[]
  requests: JoinRequest[]
  messages: ChatMessage[]
  unread: number
  connected: boolean

  reset: () => void
  bootstrap: (roomId: string) => SessionStatus
  setStatus: (status: SessionStatus, detail?: string) => void
  setRoom: (room: Room) => void
  setSelf: (self: Participant) => void
  setConnected: (connected: boolean) => void
  join: () => void
  leave: () => void

  addParticipant: (participant: Participant) => void
  removeParticipant: (id: ID) => void
  updateParticipant: (id: ID, patch: Partial<Participant>) => void
  setParticipants: (participants: Participant[]) => void
  flagSpeaking: (id: ID, on: boolean) => void

  addRequest: (request: JoinRequest) => void
  resolveRequest: (requestId: ID) => JoinRequest | undefined
  clearRequests: () => void

  addMessage: (message: ChatMessage) => void
  setMessages: (messages: ChatMessage[]) => void
  toggleReaction: (messageId: ID, emoji: string, userId: ID) => void
  markRead: () => void

  applySettingsPatch: (patch: RoomSettingsPatch) => void
}

const initialState = {
  status: 'loading' as SessionStatus,
  statusDetail: '',
  room: null,
  self: null,
  participants: [] as Participant[],
  requests: [] as JoinRequest[],
  messages: [] as ChatMessage[],
  unread: 0,
  connected: false,
}

const speakingFlags = new Set<ID>()

export const useRoomSessionStore = create<RoomSessionState>()((set, get) => ({
  ...initialState,

  reset: () => {
    speakingFlags.clear()
    queuedMessages.length = 0
    set({ ...initialState })
  },

  bootstrap: (roomId) => {
    const room = useRoomsStore.getState().findRoom(roomId)
    if (!room) {
      set({ ...initialState, status: 'not-found' })
      return 'not-found'
    }

    const { userId } = useSessionStore.getState()
    const isHost = room.hostId === userId

    if (!isHost) {
      if (room.settings.access.lockRoom) {
        set({ ...initialState, room, status: 'locked' })
        return 'locked'
      }
      set({ ...initialState, room, status: 'prejoin' })
      return 'prejoin'
    }

    const self = buildSelfParticipant({
      id: userId,
      name: useSessionStore.getState().displayName || 'Host',
      role: 'host',
    })
    set({
      ...initialState,
      room,
      status: 'joined',
      self,
      participants: [self],
    })
    pushSystemMessage(room, `${self.name} created the room`)
    return 'joined'
  },

  setStatus: (status, detail = '') => set({ status, statusDetail: detail }),

  setRoom: (room) => set({ room }),

  setSelf: (self) =>
    set((state) => ({
      self,
      participants: state.participants.some((p) => p.id === self.id)
        ? state.participants.map((p) => (p.id === self.id ? self : p))
        : [...state.participants, self],
    })),

  setConnected: (connected) => set({ connected }),

  join: () => {
    const { self, room } = get()
    if (!self || !room) return
    set((state) => ({
      status: 'joined',
      participants: state.participants.some((p) => p.id === self.id)
        ? state.participants
        : [...state.participants, self],
    }))
    pushSystemMessage(room, `${self.name} was accepted by the host`)
    useRoomsStore.getState().updateMeta(room.id, {
      participantCount: get().participants.length,
    })
  },

  leave: () => {
    const { room, participants } = get()
    if (room) {
      useRoomsStore.getState().updateMeta(room.id, {
        participantCount: Math.max(1, participants.length || 1),
      })
    }
    set({ ...initialState })
  },

  addParticipant: (participant) =>
    set((state) => {
      if (state.participants.some((p) => p.id === participant.id)) {
        return {
          participants: state.participants.map((p) =>
            p.id === participant.id ? { ...p, ...participant } : p,
          ),
        }
      }
      if (state.room && state.room.settings.participants.maxParticipants <= state.participants.length) {
        return state
      }
      if (!participant.isSelf) {
        queueSystemMessage(state.room, `${participant.name} joined the room`)
      }
      const participants = [...state.participants, participant]
      if (state.room) {
        useRoomsStore.getState().updateMeta(state.room.id, { participantCount: participants.length })
      }
      return { participants }
    }),

  removeParticipant: (id) =>
    set((state) => {
      const target = state.participants.find((p) => p.id === id)
      if (!target || target.isSelf) return state
      const participants = state.participants.filter((p) => p.id !== id)
      queueSystemMessage(state.room, `${target.name} left the room`)
      if (state.room) {
        useRoomsStore.getState().updateMeta(state.room.id, { participantCount: participants.length })
      }
      return { participants }
    }),

  updateParticipant: (id, patch) =>
    set((state) => ({
      participants: state.participants.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      self: state.self?.id === id ? { ...state.self, ...patch } : state.self,
    })),

  setParticipants: (participants) => set({ participants }),

  flagSpeaking: (id, on) => {
    if (on) speakingFlags.add(id)
    else speakingFlags.delete(id)
    const ids = [...speakingFlags]
    set((state) => ({
      participants: state.participants.map((p) =>
        p.isSpeaking === ids.includes(p.id) ? p : { ...p, isSpeaking: ids.includes(p.id) },
      ),
      self: state.self
        ? state.self.isSpeaking === ids.includes(state.self.id)
          ? state.self
          : { ...state.self, isSpeaking: ids.includes(state.self.id) }
        : state.self,
    }))
  },

  addRequest: (request) =>
    set((state) => {
      if (state.requests.some((r) => r.id === request.id || r.participantId === request.participantId)) {
        return state
      }
      return { requests: [...state.requests, request] }
    }),

  resolveRequest: (requestId) => {
    const request = get().requests.find((r) => r.id === requestId)
    if (!request) return undefined
    set((state) => ({ requests: state.requests.filter((r) => r.id !== requestId) }))
    return request
  },

  clearRequests: () => set({ requests: [] }),

  addMessage: (message) =>
    set((state) => {
      if (state.messages.some((m) => m.id === message.id)) return state
      const isOwn = message.senderId === state.self?.id
      const chatOpen = useUiStore.getState().panel === 'chat'
      const unread = !isOwn && message.kind !== 'system' && !chatOpen ? state.unread + 1 : state.unread
      const messages = [...state.messages, message]
      return { messages: messages.slice(-300), unread }
    }),

  setMessages: (messages) => set({ messages }),

  toggleReaction: (messageId, emoji, userId) =>
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id !== messageId) return message
        const current = message.reactions[emoji] ?? []
        const has = current.includes(userId)
        const next = has ? current.filter((id) => id !== userId) : [...current, userId]
        const reactions = { ...message.reactions }
        if (next.length === 0) delete reactions[emoji]
        else reactions[emoji] = next
        return { ...message, reactions }
      }),
    })),

  markRead: () => set({ unread: 0 }),

  applySettingsPatch: (patch) =>
    set((state) => {
      if (!state.room) return state
      const room = { ...state.room, settings: mergeRoomSettings(state.room.settings, patch) }
      const meta: {
        name?: string
        description?: string
        visibility?: Room['visibility']
      } = {}
      if (patch.general?.name !== undefined) {
        room.name = patch.general.name
        meta.name = patch.general.name
      }
      if (patch.general?.description !== undefined) {
        room.description = patch.general.description
        meta.description = patch.general.description
      }
      if (patch.general?.visibility !== undefined) {
        room.visibility = patch.general.visibility
        meta.visibility = patch.general.visibility
      }
      useRoomsStore.getState().updateSettings(room.id, patch)
      if (Object.keys(meta).length > 0) useRoomsStore.getState().updateMeta(room.id, meta)
      return { room }
    }),
}))

export function buildSelfParticipant(input: {
  id: ID
  name: string
  role: Participant['role']
  avatarColor?: string
}): Participant {
  const session = useSessionStore.getState()
  const callDefaults = { micOn: true, cameraOn: true }
  return {
    id: input.id,
    name: input.name,
    role: input.role,
    avatarColor: input.avatarColor ?? session.avatarColor,
    isSelf: true,
    micOn: callDefaults.micOn,
    cameraOn: callDefaults.cameraOn,
    screenSharing: false,
    isSpeaking: false,
    quality: 'excellent',
    joinedAt: Date.now(),
  }
}

function pushSystemMessage(room: Room | null, text: string) {
  if (!room) return
  const message: ChatMessage = {
    id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    roomId: room.id,
    senderId: 'system',
    senderName: 'System',
    avatarColor: '#717689',
    kind: 'system',
    text,
    reactions: {},
    createdAt: Date.now(),
  }
  useRoomSessionStore.getState().addMessage(message)
}

const queuedMessages: ChatMessage[] = []
let flushScheduled = false

function queueSystemMessage(room: Room | null, text: string) {
  if (!room) return
  queuedMessages.push({
    id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    roomId: room.id,
    senderId: 'system',
    senderName: 'System',
    avatarColor: '#717689',
    kind: 'system',
    text,
    reactions: {},
    createdAt: Date.now(),
  })
  if (flushScheduled) return
  flushScheduled = true
  queueMicrotask(() => {
    flushScheduled = false
    const store = useRoomSessionStore.getState()
    while (queuedMessages.length > 0) {
      const next = queuedMessages.shift()
      if (next) store.addMessage(next)
    }
  })
}
