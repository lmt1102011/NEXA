import { joinRoom, type DataPayload } from 'trystero'
import { ICE_SERVERS } from '@/services/realtime/iceServers'
import type { Room } from '@/types'
import { useRoomsStore } from '@/stores/rooms'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'

const APP_ID = 'nexa-dir-v2'
const DIRECTORY_ROOM = 'public-rooms'
const ANNOUNCE_MS = 20_000
const PRUNE_MS = 8_000
const STALE_MS = 60_000

interface DirectoryMessage {
  deviceId: string
  at: number
  rooms: Room[]
}

let started = false

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
 * Trystero room and broadcasts the public rooms it is hosting a few times per
 * minute. Listeners merge those announcements into a transient store, so the
 * "Active Public Rooms" lists on Home and Rooms pages show live rooms from
 * every device — not just whatever this browser happens to know about.
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
      if (!message || message.deviceId === deviceId() || message.rooms.length === 0) return
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

  const prune = () => useDirectoryStore.getState().pruneRooms(Date.now() - STALE_MS)

  announce()
  window.setInterval(announce, ANNOUNCE_MS)
  window.setInterval(prune, PRUNE_MS)
}