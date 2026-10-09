import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AccentName, ThemeMode } from '@/types'
import { generateId, randomAvatarColor } from '@/lib/utils'

interface SessionState {
  userId: string
  displayName: string
  avatarColor: string
  theme: ThemeMode
  accent: AccentName
  recentRoomIds: string[]
  hostTokens: Record<string, string>
  setName: (name: string) => void
  setAvatarColor: (color: string) => void
  setTheme: (theme: ThemeMode) => void
  setAccent: (accent: AccentName) => void
  pushRecentRoom: (roomId: string) => void
  setHostToken: (roomId: string, token: string) => void
  clearHostToken: (roomId: string) => void
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle('light', theme === 'light')
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  localStorage.setItem('nexa.theme', theme)
}

function applyAccent(accent: AccentName) {
  document.documentElement.dataset.accent = accent
  localStorage.setItem('nexa.accent', accent)
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      userId: generateId('user'),
      displayName: '',
      avatarColor: randomAvatarColor(),
      theme: 'dark',
      accent: 'violet',
      recentRoomIds: [],
      hostTokens: {},

      setName: (name) => set({ displayName: name.slice(0, 32) }),

      setAvatarColor: (color) => set({ avatarColor: color }),

      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },

      setAccent: (accent) => {
        applyAccent(accent)
        set({ accent })
      },

      pushRecentRoom: (roomId) =>
        set((state) => ({
          recentRoomIds: [roomId, ...state.recentRoomIds.filter((id) => id !== roomId)].slice(0, 8),
        })),

      setHostToken: (roomId, token) =>
        set((state) => ({ hostTokens: { ...state.hostTokens, [roomId]: token } })),

      clearHostToken: (roomId) =>
        set((state) => {
          if (!(roomId in state.hostTokens)) return state
          const hostTokens = { ...state.hostTokens }
          delete hostTokens[roomId]
          return { hostTokens }
        }),
    }),
    {
      name: 'nexa.session',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        userId: state.userId,
        displayName: state.displayName,
        avatarColor: state.avatarColor,
        theme: state.theme,
        accent: state.accent,
        recentRoomIds: state.recentRoomIds,
        hostTokens: state.hostTokens,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        applyTheme(state.theme)
        applyAccent(state.accent)
      },
    },
  ),
)

export function initSessionAppearance() {
  const { theme, accent } = useSessionStore.getState()
  applyTheme(theme)
  applyAccent(accent)
}
