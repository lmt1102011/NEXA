import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Room, RoomVisibility } from '@/types'
import { defaultRoomSettings, mergeRoomSettings, type RoomSettingsPatch } from '@/lib/defaults'
import { autoRoomName } from '@/lib/defaults'
import { generateRoomCode, generateRoomId } from '@/lib/utils'

export interface CreateRoomInput {
  hostId: string
  hostName: string
  name?: string
  visibility: RoomVisibility
  requireApproval?: boolean
  maxParticipants?: number
  defaultMic?: boolean
  defaultCamera?: boolean
  allowChat?: boolean
}

interface RoomsState {
  rooms: Room[]
  createRoom: (input: CreateRoomInput) => Room
  addRoom: (room: Room) => void
  findRoom: (idOrCode: string) => Room | undefined
  publicRooms: () => Room[]
  updateSettings: (roomId: string, patch: RoomSettingsPatch) => void
  updateMeta: (
    roomId: string,
    patch: Partial<Pick<Room, 'name' | 'description' | 'visibility' | 'status' | 'participantCount'>>,
  ) => void
  touchRoom: (roomId: string) => void
  removeRoom: (roomId: string) => void
}

export const useRoomsStore = create<RoomsState>()(
  persist(
    (set, get) => ({
      rooms: [],

      createRoom: (input) => {
        const settings = defaultRoomSettings()
        const name = input.name?.trim() || autoRoomName(input.hostName)
        settings.general.name = name
        settings.general.visibility = input.visibility
        if (input.requireApproval !== undefined) settings.access.requireApproval = input.requireApproval
        if (input.maxParticipants !== undefined) {
          settings.participants.maxParticipants = input.maxParticipants
        }
        if (input.defaultMic !== undefined) settings.participants.defaultMic = input.defaultMic
        if (input.defaultCamera !== undefined) settings.participants.defaultCamera = input.defaultCamera
        if (input.allowChat !== undefined) settings.chat.enabled = input.allowChat

        const room: Room = {
          id: generateRoomId(),
          code: generateRoomCode(),
          name,
          description: '',
          hostId: input.hostId,
          hostName: input.hostName,
          visibility: input.visibility,
          status: 'live',
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          participantCount: 1,
          settings,
          tags: [],
        }
        set((state) => ({ rooms: [room, ...state.rooms] }))
        return room
      },

      addRoom: (room) =>
        set((state) => ({
          rooms: state.rooms.some((existing) => existing.id === room.id)
            ? state.rooms
            : [room, ...state.rooms],
        })),

      findRoom: (idOrCode) => {
        const needle = idOrCode.trim().toLowerCase()
        if (!needle) return undefined
        return (
          get().rooms.find((room) => room.id.toLowerCase() === needle) ??
          get().rooms.find((room) => room.code.toLowerCase() === needle)
        )
      },

      publicRooms: () =>
        get()
          .rooms.filter((room) => room.visibility === 'public')
          .sort((a, b) => {
            if (a.status !== b.status) return a.status === 'live' ? -1 : 1
            if (b.participantCount !== a.participantCount) return b.participantCount - a.participantCount
            return b.lastActiveAt - a.lastActiveAt
          }),

      updateSettings: (roomId, patch) =>
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === roomId
              ? { ...room, settings: mergeRoomSettings(room.settings, patch), lastActiveAt: Date.now() }
              : room,
          ),
        })),

      updateMeta: (roomId, patch) =>
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === roomId ? { ...room, ...patch, lastActiveAt: Date.now() } : room,
          ),
        })),

      touchRoom: (roomId) =>
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === roomId ? { ...room, lastActiveAt: Date.now(), status: 'live' } : room,
          ),
        })),

      removeRoom: (roomId) =>
        set((state) => ({ rooms: state.rooms.filter((room) => room.id !== roomId) })),
    }),
    {
      name: 'nexa.rooms',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ rooms: state.rooms }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<RoomsState> | undefined
        if (!persistedState?.rooms) return current
        return { ...current, rooms: persistedState.rooms.length ? persistedState.rooms : [] }
      },
    },
  ),
)
