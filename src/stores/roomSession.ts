import { create } from 'zustand'
import type {
  ActivityTask,
  ChatMessage,
  ID,
  JoinRequest,
  Participant,
  Poll,
  Room,
  RoomTimer,
  SessionStatus,
  TodoItem,
} from '@/types'
import { mergeRoomSettings, type RoomSettingsPatch } from '@/lib/defaults'
import { t } from '@/lib/i18n'
import { useRoomsStore } from '@/stores/rooms'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'

export interface FloatingReaction {
  id: string
  emoji: string
  name: string
  x: number
}

interface RoomSessionState {
  status: SessionStatus
  statusDetail: string
  room: Room | null
  self: Participant | null
  participants: Participant[]
  requests: JoinRequest[]
  nameTaken: string | null
  messages: ChatMessage[]
  pinnedMessage: ChatMessage | null
  polls: Poll[]
  tasks: ActivityTask[]
  todos: TodoItem[]
  timer: RoomTimer | null
  activitiesUnread: number
  unread: number
  connected: boolean
  floatingReactions: FloatingReaction[]

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
  setNameTaken: (name: string | null) => void

  addMessage: (message: ChatMessage) => void
  setMessages: (messages: ChatMessage[]) => void
  setPinnedMessage: (message: ChatMessage | null) => void
  setActivities: (activities: {
    polls: Poll[]
    tasks: ActivityTask[]
    todos: TodoItem[]
    timer: RoomTimer | null
  }) => void
  bumpActivitiesUnread: () => void
  markActivitiesRead: () => void
  toggleReaction: (messageId: ID, emoji: string, userId: ID) => void
  markRead: () => void

  pushFloatingReaction: (emoji: string, name: string) => void
  removeFloatingReaction: (id: string) => void

  applySettingsPatch: (patch: RoomSettingsPatch) => void
}

const initialState = {
  status: 'loading' as SessionStatus,
  statusDetail: '',
  room: null,
  self: null,
  participants: [] as Participant[],
  requests: [] as JoinRequest[],
  nameTaken: null,
  messages: [] as ChatMessage[],
  pinnedMessage: null as ChatMessage | null,
  polls: [] as Poll[],
  tasks: [] as ActivityTask[],
  todos: [] as TodoItem[],
  timer: null as RoomTimer | null,
  activitiesUnread: 0,
  unread: 0,
  connected: false,
  floatingReactions: [] as FloatingReaction[],
}

const speakingFlags = new Set<ID>()

export const useRoomSessionStore = create<RoomSessionState>()((set, get) => ({
  ...initialState,

  reset: () => {
    speakingFlags.clear()
    queuedMessages.length = 0
    const { self, room } = get()
    if (self?.role === 'host' && room) clearPersistedRequests(room.id)
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
      requests: loadPersistedRequests(room.id),
    })
    pushSystemMessage(room, t('{name} created the room', { name: self.name }))
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
    pushSystemMessage(room, t('{name} was accepted by the host', { name: self.name }))
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
        queueSystemMessage(state.room, t('{name} joined the room', { name: participant.name }))
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
      queueSystemMessage(state.room, t('{name} left the room', { name: target.name }))
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
      const existingIndex = state.requests.findIndex(
        (r) => r.id === request.id || r.participantId === request.participantId,
      )
      const requests =
        existingIndex >= 0
          ? state.requests.map((r) => (r.participantId === request.participantId ? { ...request } : r))
          : [...state.requests, request]
      persistRequests(state.room?.id ?? null, requests)
      return { requests }
    }),

  resolveRequest: (requestId) => {
    const request = get().requests.find((r) => r.id === requestId)
    if (!request) return undefined
    const requests = get().requests.filter((r) => r.id !== requestId)
    set({ requests })
    persistRequests(get().room?.id ?? null, requests)
    return request
  },

  clearRequests: () => {
    set({ requests: [] })
    persistRequests(get().room?.id ?? null, [])
  },

  setNameTaken: (name) => set({ nameTaken: name }),

  addMessage: (message) =>
    set((state) => {
      if (state.messages.some((m) => m.id === message.id)) return state
      const isOwn = message.senderId === state.self?.id
      const chatOpen = useUiStore.getState().panel === 'chat'
      const unread = !isOwn && message.kind !== 'system' && !chatOpen ? state.unread + 1 : state.unread
      const messages = [...state.messages, message]
      return { messages: messages.slice(-300), unread }
    }),

  setMessages: (messages) =>
    set((state) => ({
      messages,
      pinnedMessage:
        state.pinnedMessage && messages.some((m) => m.id === state.pinnedMessage?.id) ? state.pinnedMessage : null,
    })),

  setPinnedMessage: (message) => set({ pinnedMessage: message }),

  setActivities: (activities) => set(activities),

  bumpActivitiesUnread: () => set((state) => ({ activitiesUnread: state.activitiesUnread + 1 })),

  markActivitiesRead: () => set({ activitiesUnread: 0 }),

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

  pushFloatingReaction: (emoji, name) =>
    set((state) => ({
      floatingReactions: [
        ...state.floatingReactions,
        {
          id: `fl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          emoji,
          name,
          x: 12 + Math.random() * 76,
        },
      ].slice(-16),
    })),

  removeFloatingReaction: (id) =>
    set((state) => ({ floatingReactions: state.floatingReactions.filter((reaction) => reaction.id !== id) })),

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
    handRaised: false,
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

function requestsKey(roomId: ID) {
  return `nexa.requests:${roomId}`
}

function loadPersistedRequests(roomId: ID): JoinRequest[] {
  try {
    const raw = localStorage.getItem(requestsKey(roomId))
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    if (Array.isArray(data)) return data as JoinRequest[]
  } catch {
    // corrupt storage is treated as no requests
  }
  return []
}

function persistRequests(roomId: ID | null, requests: JoinRequest[]) {
  if (!roomId) return
  try {
    if (requests.length === 0) localStorage.removeItem(requestsKey(roomId))
    else localStorage.setItem(requestsKey(roomId), JSON.stringify(requests))
  } catch {
    // persistence is best-effort
  }
}

function clearPersistedRequests(roomId: ID) {
  try {
    localStorage.removeItem(requestsKey(roomId))
  } catch {
    // persistence is best-effort
  }
}
