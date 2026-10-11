import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, Search, SearchX, TicketPercent } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Segmented } from '@/components/ui/segmented'
import { useT } from '@/lib/i18n'
import { useRoomsStore } from '@/stores/rooms'
import { usePublicRooms } from '@/features/rooms/usePublicRooms'
import { findRoomByCode, normalizeCode } from '@/features/rooms/joinByCode'
import { RoomCard, RoomCardSkeleton } from '@/features/rooms/RoomCard'
import type { Room } from '@/types'

type SortKey = 'live' | 'people' | 'recent'

/**
 * A code is only useful if some device is announcing that room, and that
 * announcement arrives over the peer network — a freshly opened page may not
 * have heard it yet. Keep looking for a few seconds before saying no.
 */
const CODE_LOOKUP_MS = 8000
const CODE_LOOKUP_STEP_MS = 400

export default function RoomsPage() {
  const t = useT()
  const localRooms = useRoomsStore((state) => state.rooms)
  const rooms = usePublicRooms()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codePending, setCodePending] = useState(false)
  const [sort, setSort] = useState<SortKey>('live')
  const [loading, setLoading] = useState(true)
  const codeTimer = useRef<number | null>(null)

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'live', label: t('Live') },
    { value: 'people', label: t('Most people') },
    { value: 'recent', label: t('Recently active') },
  ]

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 520)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => () => {
    if (codeTimer.current !== null) window.clearTimeout(codeTimer.current)
  }, [])

  /**
   * Walks into the room a code belongs to. Keeps polling while the directory
   * is still syncing, so a code typed right after opening the page works.
   */
  function resolveCode(raw: string) {
    if (codeTimer.current !== null) window.clearTimeout(codeTimer.current)
    const wanted = normalizeCode(raw)
    const startedAt = Date.now()

    const tick = () => {
      const found = findRoomByCode(wanted)
      if (found) {
        codeTimer.current = null
        setCodePending(false)
        setCodeError(null)
        navigate(`/room/${found.id}`)
        return
      }
      if (Date.now() - startedAt >= CODE_LOOKUP_MS) {
        codeTimer.current = null
        setCodePending(false)
        setCodeError(
          t('No room matches the code “{code}”. Check it, or use the invite link for a private room.', {
            code: wanted,
          }),
        )
        return
      }
      codeTimer.current = window.setTimeout(tick, CODE_LOOKUP_STEP_MS)
    }

    setCodePending(true)
    setCodeError(null)
    tick()
  }

  // A code handed over from the home page (?code=ABC123) resolves on arrival.
  useEffect(() => {
    const incoming = searchParams.get('code')
    if (!incoming) return
    setCode(incoming.toUpperCase())
    resolveCode(incoming)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, t])

  function handleCodeSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    resolveCode(trimmed)
  }

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
        <form
          onSubmit={handleCodeSubmit}
          className="flex w-full items-center gap-2 sm:max-w-sm"
          aria-label={t('Join with a room code')}
        >
          <div className="relative w-full">
            <TicketPercent className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <Input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                setCodeError(null)
              }}
              placeholder={t('Room code')}
              aria-label={t('Join with a room code')}
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
              className="pl-10 font-mono tracking-[0.2em] uppercase"
            />
          </div>
          <Button type="submit" size="md" disabled={!code.trim()} loading={codePending}>
            {codePending ? t('Searching…') : t('Join')}
          </Button>
        </form>
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

      {codeError ? (
        <p role="alert" className="mt-3 text-[12.5px] text-danger">
          {codeError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
