import type { RoomSettings, ThemeMode, AccentName } from '@/types'

export function defaultRoomSettings(): RoomSettings {
  return {
    general: {
      name: '',
      description: '',
      visibility: 'public',
    },
    access: {
      requireApproval: true,
      lockRoom: false,
      allowJoinByCode: true,
    },
    participants: {
      maxParticipants: 12,
      defaultMic: true,
      defaultCamera: true,
      allowMuteOthers: true,
      allowRemoveOthers: true,
    },
    av: {
      videoQuality: 'auto',
      audioQuality: 'auto',
      echoCancellation: true,
      noiseFilter: 'light',
      autoAdjustQuality: true,
      lowBandwidth: false,
    },
    chat: {
      enabled: true,
      allowFiles: true,
      allowReactions: true,
    },
    screenShare: {
      allow: true,
      allowParticipants: true,
      maxScreens: 2,
    },
    security: {
      temporary: false,
      autoExpireMinutes: 0,
      blockJoinRequests: false,
    },
    appearance: {
      theme: 'dark',
      accent: 'violet',
      background: 'default',
    },
  }
}

type Section<K extends keyof RoomSettings> = Partial<RoomSettings[K]>

export interface RoomSettingsPatch {
  general?: Section<'general'>
  access?: Section<'access'>
  participants?: Section<'participants'>
  av?: Section<'av'>
  chat?: Section<'chat'>
  screenShare?: Section<'screenShare'>
  security?: Section<'security'>
  appearance?: Section<'appearance'>
}

export function mergeRoomSettings(base: RoomSettings, patch: RoomSettingsPatch): RoomSettings {
  return {
    general: { ...base.general, ...patch.general },
    access: { ...base.access, ...patch.access },
    participants: { ...base.participants, ...patch.participants },
    av: { ...base.av, ...patch.av },
    chat: { ...base.chat, ...patch.chat },
    screenShare: { ...base.screenShare, ...patch.screenShare },
    security: { ...base.security, ...patch.security },
    appearance: { ...base.appearance, ...patch.appearance },
  }
}

export function autoRoomName(hostName: string): string {
  const trimmed = hostName.trim()
  if (!trimmed) return 'Untitled Room'
  return `Room by ${trimmed}`
}

export function defaultTheme(): ThemeMode {
  return 'dark'
}

export function defaultAccent(): AccentName {
  return 'violet'
}
