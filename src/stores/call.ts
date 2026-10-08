import { create } from 'zustand'
import type { CallStats, DeviceOption } from '@/types'

export type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'unavailable'

interface CallState {
  micOn: boolean
  cameraOn: boolean
  sharing: boolean
  hasLocalVideo: boolean
  lowBandwidth: boolean
  autoQualityReduced: boolean
  stats: CallStats
  remoteStreams: Record<string, MediaStream>
  audioPermission: PermissionStatus
  videoPermission: PermissionStatus
  devices: {
    audio: DeviceOption[]
    video: DeviceOption[]
    output: DeviceOption[]
  }
  activeAudioId: string
  activeVideoId: string
  activeOutputId: string
  setMic: (on: boolean) => void
  setCamera: (on: boolean) => void
  setSharing: (sharing: boolean) => void
  setHasLocalVideo: (value: boolean) => void
  setLowBandwidth: (value: boolean) => void
  setAutoQualityReduced: (value: boolean) => void
  setStats: (stats: CallStats) => void
  setRemoteStream: (peerId: string, stream: MediaStream) => void
  removeRemoteStream: (peerId: string) => void
  setPermissions: (patch: Partial<Pick<CallState, 'audioPermission' | 'videoPermission'>>) => void
  setDevices: (devices: CallState['devices']) => void
  setActiveDevice: (
    kind: 'audio' | 'video' | 'output',
    deviceId: string,
  ) => void
  reset: () => void
}

const initialStats: CallStats = {
  ping: 0,
  jitter: 0,
  loss: 0,
  bitrate: 0,
  quality: 'excellent',
}

export const useCallStore = create<CallState>()((set) => ({
  micOn: true,
  cameraOn: true,
  sharing: false,
  hasLocalVideo: false,
  lowBandwidth: false,
  autoQualityReduced: false,
  stats: initialStats,
  remoteStreams: {},
  audioPermission: 'unknown',
  videoPermission: 'unknown',
  devices: { audio: [], video: [], output: [] },
  activeAudioId: '',
  activeVideoId: '',
  activeOutputId: '',

  setMic: (on) => set({ micOn: on }),
  setCamera: (on) => set({ cameraOn: on }),
  setSharing: (sharing) => set({ sharing }),
  setHasLocalVideo: (hasLocalVideo) => set({ hasLocalVideo }),
  setLowBandwidth: (lowBandwidth) => set({ lowBandwidth }),
  setAutoQualityReduced: (autoQualityReduced) => set({ autoQualityReduced }),
  setStats: (stats) => set({ stats }),
  setRemoteStream: (peerId, stream) =>
    set((state) => ({ remoteStreams: { ...state.remoteStreams, [peerId]: stream } })),
  removeRemoteStream: (peerId) =>
    set((state) => {
      if (!(peerId in state.remoteStreams)) return state
      const remoteStreams = { ...state.remoteStreams }
      delete remoteStreams[peerId]
      return { remoteStreams }
    }),
  setPermissions: (patch) => set(patch),
  setDevices: (devices) => set({ devices }),
  setActiveDevice: (kind, deviceId) =>
    set(
      kind === 'audio'
        ? { activeAudioId: deviceId }
        : kind === 'video'
          ? { activeVideoId: deviceId }
          : { activeOutputId: deviceId },
    ),
  reset: () =>
    set({
      micOn: true,
      cameraOn: true,
      sharing: false,
      hasLocalVideo: false,
      lowBandwidth: false,
      autoQualityReduced: false,
      stats: initialStats,
      remoteStreams: {},
    }),
}))
