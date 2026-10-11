import type { Room } from '@/types'
import { useDirectoryStore } from '@/stores/directory'
import { useRoomsStore } from '@/stores/rooms'

/** Room codes are short and typed by hand, so matching ignores case and spaces. */
export function normalizeCode(value: string) {
  return value.replace(/\s+/g, '').toUpperCase()
}

/**
 * Resolves a room code to a room this device knows about: rooms it hosts or has
 * visited locally, and rooms other devices are announcing right now (the public
 * directory carries the code along with the rest of the room snapshot).
 *
 * A private room that nobody here has ever seen cannot be resolved — without a
 * server there is nothing to ask, so the invite link stays the way in.
 */
export function findRoomByCode(code: string): Room | null {
  const wanted = normalizeCode(code)
  if (wanted.length < 4) return null

  const local = useRoomsStore.getState().rooms.find((room) => normalizeCode(room.code) === wanted)
  if (local) return local

  const remote = useDirectoryStore.getState().entries.find((room) => normalizeCode(room.code) === wanted)
  if (remote) return remote

  return null
}
