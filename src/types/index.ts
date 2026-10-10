export type ID = string

export type ThemeMode = 'dark' | 'light'
export type AccentName = 'violet' | 'blue' | 'emerald' | 'rose' | 'amber'
export type RoomBackground = 'default' | 'grid' | 'aurora' | 'solid'

export type RoomVisibility = 'public' | 'private'
export type RoomStatus = 'live' | 'idle'
export type VideoQuality = 'auto' | '720p' | '1080p' | '360p' | '180p'
export type AudioQuality = 'auto' | 'high' | 'medium' | 'low'
export type NoiseFilter = 'off' | 'light' | 'strong'
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
    noiseFilter: NoiseFilter
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

/**
 * Extra rights the host can grant to a single participant (e.g. a co-host).
 * The host always has every right; guests start with none.
 */
export interface ParticipantPermissions {
  canShareScreen?: boolean
  canModerate?: boolean
  canManageRoom?: boolean
}

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
  handRaised?: boolean
  handRaisedAt?: number
  quality: ConnectionQuality
  joinedAt: number
  peerId?: string
  permissions?: ParticipantPermissions
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
  replyTo?: { id: ID; name: string; text: string }
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

export interface PollOption {
  id: ID
  text: string
  votes: ID[]
}

export interface Poll {
  id: ID
  question: string
  note: string
  options: PollOption[]
  createdBy: ID
  createdAt: number
  closed: boolean
}

export interface ActivityTask {
  id: ID
  title: string
  note: string
  assigneeId: ID | null
  done: boolean
  createdBy: ID
  createdAt: number
  /** When true the host has locked this task against deletion. */
  locked?: boolean
}

export interface TodoItem {
  id: ID
  text: string
  note: string
  done: boolean
  createdBy: ID
  createdAt: number
}

export interface RoomTimer {
  endsAt: number | null
  remainingMs: number
  running: boolean
  startedBy: ID | null
  note: string
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

export type RoomPanel = 'chat' | 'participants' | 'settings'
export type RoomModal = 'invite' | 'shortcuts' | 'devices' | 'leave' | 'more'

export type SessionStatus =
  | 'loading'
  | 'prejoin'
  | 'awaiting'
  | 'joined'
  | 'rejected'
  | 'kicked'
  | 'locked'
  | 'full'
  | 'not-found'
  | 'ended'
  | 'error'
