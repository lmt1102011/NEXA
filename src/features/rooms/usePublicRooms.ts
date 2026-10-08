import { useMemo } from 'react'
import type { Room } from '@/types'
import { useRoomsStore } from '@/stores/rooms'
import { useDirectoryStore } from '@/stores/directory'

/**
 * Public rooms visible on this device: locally hosted/discovered rooms plus
 * rooms other devices are broadcasting right now. Local copies win over the
 * remote snapshot for the same room id.
 */
export function usePublicRooms(): Room[] {
  const local = useRoomsStore((state) => state.rooms)
  const directory = useDirectoryStore((state) => state.entries)
  return useMemo(() => {
    const map = new Map<string, Room>()
    for (const room of directory) {
      if (room.visibility === 'public') map.set(room.id, room)
    }
    for (const room of local) {
      if (room.visibility === 'public') map.set(room.id, room)
    }
    return [...map.values()]
  }, [local, directory])
}