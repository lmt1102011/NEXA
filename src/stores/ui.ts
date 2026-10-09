import { create } from 'zustand'
import type { RoomModal, RoomPanel, ToastInput } from '@/types'
import { generateId } from '@/lib/utils'

export interface Toast extends ToastInput {
  id: string
  createdAt: number
}

export type ActivitiesTab = 'polls' | 'tasks' | 'todos' | 'timer'

interface UiState {
  toasts: Toast[]
  panel: RoomPanel | null
  modal: RoomModal | null
  shortcutsOpen: boolean
  activitiesTab: ActivitiesTab
  pushToast: (toast: ToastInput) => string
  dismissToast: (id: string) => void
  setPanel: (panel: RoomPanel | null) => void
  setModal: (modal: RoomModal | null) => void
  setShortcutsOpen: (open: boolean) => void
  setActivitiesTab: (tab: ActivitiesTab) => void
}

export const useUiStore = create<UiState>()((set, get) => ({
  toasts: [],
  panel: null,
  modal: null,
  shortcutsOpen: false,
  activitiesTab: 'polls',

  pushToast: (toast) => {
    const id = generateId('toast')
    const duration = toast.duration ?? (toast.variant === 'danger' ? 6000 : 4200)
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, createdAt: Date.now() }].slice(-4),
    }))
    window.setTimeout(() => {
      if (get().toasts.some((t) => t.id === id)) get().dismissToast(id)
    }, duration)
    return id
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setPanel: (panel) => set((state) => ({ panel: state.panel === panel ? null : panel })),

  setModal: (modal) => set({ modal }),

  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

  setActivitiesTab: (tab) => set({ activitiesTab: tab, panel: 'activities' }),
}))

export function toast(input: ToastInput) {
  return useUiStore.getState().pushToast(input)
}
