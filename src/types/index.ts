export type ID = string

export type ThemeMode = 'dark' | 'light'
export type AccentName = 'violet' | 'blue' | 'emerald' | 'rose' | 'amber'
export type RoomBackground = 'default' | 'grid' | 'aurora' | 'solid'

export type RoomVisibility = 'public' | 'private'
export type RoomStatus = 'live' | 'idle'
export type VideoQuality = 'auto' | '720p' | '1080p' | '360p' | '180p'
export type AudioQuality = 'auto' | 'high' | 'medium' | 'low'
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor'

export interface RoomSettings {
  general: {
    name: string
    description: string
    visibility: RoomVisibility
  }
  access: {
    requireApproval: boolean
    lockRoom: boolean
    allowJoinByCode: boolean
  }
  participants: {
    maxParticipants: number
    defaultMic: boolean
    defaultCamera: boolean
    allowMuteOthers: boolean
    allowRemoveOthers: boolean
  }
  av: {
    videoQuality: VideoQuality
    audioQuality: AudioQuality
    echoCancellation: boolean
    noiseSuppression: boolean
    autoAdjustQuality: boolean
    lowBandwidth: boolean
  }
  chat: {
    enabled: boolean
    allowFiles: boolean
    allowReactions: boolean
  }
  screenShare: {
    allow: boolean
    allowParticipants: boolean
    maxScreens: number
  }
  security: {
    temporary: boolean
    autoExpireMinutes: number
    blockJoinRequests: boolean
  }
  appearance: {
    theme: ThemeMode
    accent: AccentName
    background: RoomBackground
  }
}

export interface Room {
  id: ID
  code: string
  name: string
  description: string
  hostId: ID
  hostName: string
  visibility: RoomVisibility
  status: RoomStatus
  createdAt: number
  lastActiveAt: number
  participantCount: number
  settings: RoomSettings
  tags: string[]
}

export type ParticipantRole = 'host' | 'guest'

export interface Participant {
  id: ID
  name: string
  role: ParticipantRole
  avatarColor: string
  isSelf: boolean
  micOn: boolean
  cameraOn: boolean
  screenSharing: boolean
  isSpeaking: boolean
  quality: ConnectionQuality
  joinedAt: number
  peerId?: string
}

export interface JoinRequest {
  id: ID
  participantId: ID
  name: string
  avatarColor: string
  requestedAt: number
  micOn: boolean
  cameraOn: boolean
}

export interface ChatFile {
  name: string
  size: number
  type: string
  url: string
}

export type ChatMessageKind = 'text' | 'system' | 'file'

export interface ChatMessage {
  id: ID
  roomId: ID
  senderId: ID
  senderName: string
  avatarColor: string
  kind: ChatMessageKind
  text: string
  file?: ChatFile
  reactions: Record<string, ID[]>
  createdAt: number
}

export interface CallStats {
  ping: number
  jitter: number
  loss: number
  bitrate: number
  quality: ConnectionQuality
}

export interface DeviceOption {
  deviceId: string
  label: string
}

export interface ToastInput {
  title: string
  description?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  duration?: number
}

export type RoomPanel = 'chat' | 'participants' | 'tools' | 'settings'
export type RoomModal = 'invite' | 'shortcuts' | 'devices' | 'leave' | 'more'

export type SessionStatus =
  | 'loading'
  | 'prejoin'
  | 'awaiting'
  | 'joined'
  | 'rejected'
  | 'locked'
  | 'full'
  | 'not-found'
  | 'ended'
  | 'error'
