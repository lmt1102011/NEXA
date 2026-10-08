import { joinRoom, type DataPayload } from 'trystero'
import { ICE_SERVERS } from '@/services/realtime/iceServers'
import type { Room } from '@/types'
import { useRoomsStore } from '@/stores/rooms'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'

const APP_ID = 'nexa-dir-v2'
const DIRECTORY_ROOM = 'public-rooms'
const ANNOUNCE_MS = 10_000
const PRUNE_MS = 5_000
const STALE_MS = 30_000

interface DirectoryMessage {
  deviceId: string
  at: number
  rooms: Room[]
  endedRoomIds?: string[]
}

let started = false
let sendRoomEnded: ((roomId: string) => void) | null = null

/**
 * Tells every online NEXA install that a room was deleted by its host, so the
 * room vanishes from directories and local room lists immediately instead of
 * lingering until the next announce cycle.
 */
export function announceRoomDeletion(roomId: string) {
  sendRoomEnded?.(roomId)
}

function deviceId(): string {
  let id = localStorage.getItem('nexa.deviceId')
  if (!id) {
    id =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : String(Math.random()).slice(2) + Date.now().toString(36)
    localStorage.setItem('nexa.deviceId', id)
  }
  return id
}

/**
 * Serverless public-room directory. Every NEXA install joins a single shared
 * Trystero room and broadcasts the public rooms it is hosting — immediately
 * whenever its own roster changes and periodically as a heartbeat. Listeners
 * merge those announcements into a transient store, so the "Active Public
 * Rooms" lists on Home and Rooms pages show live rooms from every device
 * without waiting for a slow polling interval.
 */
export function startPublicRoomsDirectory() {
  if (started || typeof window === 'undefined') return
  started = true

  const directory = joinRoom({ appId: APP_ID, turnConfig: ICE_SERVERS }, DIRECTORY_ROOM, {
    onJoinError: () => {},
  })
  const action = directory.makeAction<DataPayload>('nexa:dir', {
    onMessage: (payload) => {
      const message = payload as unknown as DirectoryMessage
      if (!message || message.deviceId === deviceId()) return

      if (message.endedRoomIds?.length) {
        const directoryStore = useDirectoryStore.getState()
        const roomsStore = useRoomsStore.getState()
        for (const id of message.endedRoomIds) {
          directoryStore.removeRoom(id)
          roomsStore.removeRoom(id)
        }
        return
      }

      if (message.rooms.length === 0) return
      const now = message.at
      useDirectoryStore.getState().upsertRooms(
        message.rooms.map((room) => ({ ...room, lastActiveAt: now })),
      )
    },
  })

  const announce = () => {
    const mine = useRoomsStore
      .getState()
      .rooms.filter(
        (room) =>
          room.visibility === 'public' &&
          room.status === 'live' &&
          room.hostId === useSessionStore.getState().userId,
      )
    if (mine.length === 0) return
    void action
      .send({ deviceId: deviceId(), at: Date.now(), rooms: mine } as unknown as DataPayload)
      .catch(() => {})
  }

  const myPublicKey = () =>
    useRoomsStore
      .getState()
      .rooms.filter(
        (room) =>
          room.visibility === 'public' &&
          room.status === 'live' &&
          room.hostId === useSessionStore.getState().userId,
      )
      .map((room) => `${room.id}:${room.status}:${room.participantCount}`)
      .sort()
      .join('|')

  let lastKey = myPublicKey()

  sendRoomEnded = (roomId) => {
    void action
      .send({
        deviceId: deviceId(),
        at: Date.now(),
        rooms: [],
        endedRoomIds: [roomId],
      } as unknown as DataPayload)
      .catch(() => {})
  }

  const prune = () => useDirectoryStore.getState().pruneRooms(Date.now() - STALE_MS)

  announce()
  useRoomsStore.subscribe(() => {
    const key = myPublicKey()
    if (key === lastKey) return
    lastKey = key
    announce()
  })
  window.setInterval(announce, ANNOUNCE_MS)
  window.setInterval(prune, PRUNE_MS)
}