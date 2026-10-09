import { create } from 'zustand'

const STORAGE_KEY = 'nexa.participantVolumes'

function loadVolumes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const volumes: Record<string, number> = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'number' && Number.isFinite(value)) volumes[key] = value
      }
      return volumes
    }
  } catch {
    // corrupt storage is treated as no saved volumes
  }
  return {}
}

interface VolumesState {
  volumes: Record<string, number>
  setVolume: (participantId: string, volume: number) => void
}

/** Per-participant output volume, local to this device (0-150, 100 = full). */
export const useVolumesStore = create<VolumesState>()((set) => ({
  volumes: loadVolumes(),
  setVolume: (participantId, volume) =>
    set((state) => {
      const next = Math.max(0, Math.min(150, Math.round(volume)))
      const volumes = { ...state.volumes, [participantId]: next }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes))
      } catch {
        // persistence is best-effort
      }
      return { volumes }
    }),
}))

export function participantVolume(participantId: string): number {
  return useVolumesStore.getState().volumes[participantId] ?? 100
}