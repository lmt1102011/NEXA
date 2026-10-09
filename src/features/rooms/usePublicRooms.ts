import { useMemo } from 'react'
import type { Room } from '@/types'
import { useRoomsStore } from '@/stores/rooms'
import { useDirectoryStore } from '@/stores/directory'

/**
 * Rooms visible on this device: locally hosted/discovered rooms plus rooms
 * other devices are broadcasting right now (public and private alike — private
 * rooms keep their "Private" badge and still require the host's approval).
 * Local copies win over the remote snapshot for the same room id.
 */
export function usePublicRooms(): Room[] {
  const local = useRoomsStore((state) => state.rooms)
  const directory = useDirectoryStore((state) => state.entries)
  return useMemo(() => {
    const map = new Map<string, Room>()
    for (const room of directory) map.set(room.id, room)
    for (const room of local) map.set(room.id, room)
    return [...map.values()]
  }, [local, directory])
}