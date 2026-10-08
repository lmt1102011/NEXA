import { create } from 'zustand'
import type { Room } from '@/types'

/**
 * Transient cache of public rooms broadcast by other devices. Nothing here is
 * persisted: rooms live in the directory only while an online device keeps
 * announcing them, so stale entries drop off naturally once their host goes
 * offline or leaves the room.
 */
interface DirectoryState {
  entries: Room[]
  upsertRooms: (rooms: Room[]) => void
  removeRoom: (id: string) => void
  pruneRooms: (cutoff: number) => void
  findRoom: (id: string) => Room | undefined
  publicRooms: () => Room[]
}

export const useDirectoryStore = create<DirectoryState>((set, get) => ({
  entries: [],

  upsertRooms: (rooms) =>
    set((state) => {
      if (rooms.length === 0) return state
      const map = new Map(state.entries.map((room) => [room.id, room]))
      for (const room of rooms) map.set(room.id, room)
      return { entries: [...map.values()] }
    }),

  removeRoom: (id) =>
    set((state) => {
      const entries = state.entries.filter((room) => room.id !== id)
      return entries.length === state.entries.length ? state : { entries }
    }),

  pruneRooms: (cutoff) =>
    set((state) => {
      const entries = state.entries.filter((room) => room.lastActiveAt >= cutoff)
      return entries.length === state.entries.length ? state : { entries }
    }),

  findRoom: (id) => get().entries.find((room) => room.id === id),

  publicRooms: () => get().entries.filter((room) => room.visibility === 'public'),
}))