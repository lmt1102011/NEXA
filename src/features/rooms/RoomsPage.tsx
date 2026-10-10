import { useEffect, useMemo, useState } from 'react'
import { Lock, Search, SearchX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Segmented } from '@/components/ui/segmented'
import { useT } from '@/lib/i18n'
import { useRoomsStore } from '@/stores/rooms'
import { usePublicRooms } from '@/features/rooms/usePublicRooms'
import { RoomCard, RoomCardSkeleton } from '@/features/rooms/RoomCard'
import type { Room } from '@/types'

type SortKey = 'live' | 'people' | 'recent'

export default function RoomsPage() {
  const t = useT()
  const localRooms = useRoomsStore((state) => state.rooms)
  const rooms = usePublicRooms()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('live')
  const [loading, setLoading] = useState(true)

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'live', label: t('Live') },
    { value: 'people', label: t('Most people') },
    { value: 'recent', label: t('Recently active') },
  ]

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 520)
    return () => window.clearTimeout(timer)
  }, [])

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    let list = rooms

    if (normalized) {
      list = list.filter(
        (room) =>
          room.name.toLowerCase().includes(normalized) ||
          (room.settings.access.allowJoinByCode && room.code.toLowerCase().includes(normalized)) ||
          room.hostName.toLowerCase().includes(normalized),
      )
    }

    const sorted = [...list]
    if (sort === 'people') sorted.sort((a, b) => b.participantCount - a.participantCount)
    else if (sort === 'recent') sorted.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    else
      sorted.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'live' ? -1 : 1
        return b.participantCount - a.participantCount
      })
    return sorted
  }, [rooms, query, sort])

  const privateMatch = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return null
    return (
      localRooms.find(
        (room) =>
          room.visibility === 'private' &&
          (room.name.toLowerCase() === normalized ||
            (room.settings.access.allowJoinByCode && room.code.toLowerCase() === normalized)),
      ) ?? null
    )
  }, [localRooms, query])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">{t('Public rooms')}</h1>
        <p className="text-[14px] text-ink-subtle">
          {t('Browse live rooms, or search by room name and code.')}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search rooms...')}
            aria-label={t('Search rooms')}
            className="pl-10"
          />
        </div>
        <div className="w-full overflow-x-auto pb-1 sm:w-auto sm:pb-0">
          <Segmented
            ariaLabel={t('Sort rooms')}
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            className="min-w-max sm:min-w-[300px]"
            size="sm"
          />
        </div>
      </div>

      {privateMatch ? (
        <div className="mt-6">
          <p className="mb-2.5 flex items-center gap-2 text-[12.5px] font-medium text-ink-subtle">
            <Lock className="h-3.5 w-3.5" />
            Found by code
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <RoomCard room={privateMatch} />
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => <RoomCardSkeleton key={index} />)
          : results.map((room: Room, index) => <RoomCard key={room.id} room={room} index={index} />)}
      </div>

      {!loading && results.length === 0 && !privateMatch ? (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title={t('No rooms found')}
          description={
            query
              ? t('Nothing matches “{query}”. Try a different name or room code.', { query })
              : t('There are no public rooms right now. Why not create one?')
          }
          action={
            <div className="flex gap-2.5">
              <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                {t('Clear search')}
              </Button>
              <Button size="sm" onClick={() => navigate('/create')}>
                {t('Create Room')}
              </Button>
            </div>
          }
        />
      ) : null}
    </div>
  )
}
