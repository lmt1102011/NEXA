import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Radio, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LiveDot } from '@/components/ui/badge'
import { useT } from '@/lib/i18n'
import { usePublicRooms } from '@/features/rooms/usePublicRooms'
import { RoomCard, RoomCardSkeleton } from '@/features/rooms/RoomCard'
import { NexaLogoLockup } from '@/components/brand/nexa-logo-lockup'

const heroMotion = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
}

export default function HomePage() {
  const t = useT()
  const rooms = usePublicRooms()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 480)
    return () => window.clearTimeout(timer)
  }, [])

  const stats = useMemo(() => {
    const liveRooms = rooms.filter((room) => room.status === 'live')
    const people = liveRooms.reduce((total, room) => total + room.participantCount, 0)
    return { roomCount: liveRooms.length, people }
  }, [rooms])

  const visibleRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return rooms
    return rooms.filter(
      (room) =>
        room.name.toLowerCase().includes(normalized) ||
        room.code.toLowerCase().includes(normalized) ||
        room.hostName.toLowerCase().includes(normalized),
    )
  }, [rooms, query])

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 nx-grid-bg" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{
            background: 'radial-gradient(58% 62% at 50% 0%, rgba(124,116,255,0.16), transparent 72%)',
          }}
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
          <motion.div
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.07, delayChildren: 0.05 }}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.div variants={heroMotion} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-[12.5px] text-ink-muted backdrop-blur-sm">
                <LiveDot />
                {t('{count} people online in {rooms} rooms', { count: stats.people, rooms: stats.roomCount })}
              </span>
            </motion.div>

            <motion.div
              variants={heroMotion}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7"
            >
              <NexaLogoLockup className="mx-auto block h-auto w-full max-w-[460px] select-none text-ink" />
            </motion.div>

            <motion.p
              variants={heroMotion}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-subtle"
            >
              Made By LMT
            </motion.p>

            <motion.p
              variants={heroMotion}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 text-xl font-medium text-ink sm:text-2xl"
            >
              {t('Talk. Share. Connect.')}
            </motion.p>

            <motion.p
              variants={heroMotion}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="nx-text-balance mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-muted"
            >
              {t('Create a room, share a link, and start talking. No account required.')}
            </motion.p>

            <motion.div
              variants={heroMotion}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Link to="/create" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  {t('Create Room')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/rooms" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  <Search className="h-4 w-4" />
                  {t('Find a Room')}
                </Button>
              </Link>
            </motion.div>

            <motion.p
              variants={heroMotion}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 text-[12.5px] text-ink-subtle"
            >
              {t('Works in your browser · Desktop & mobile · No download')}
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Radio className="h-4.5 w-4.5 text-accent" />
              {t('Active Public Rooms')}
            </h2>
            <p className="mt-1 text-[13.5px] text-ink-subtle">
              {t('Jump into a live room, or search by name or room code.')}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Search rooms...')}
              aria-label={t('Search rooms')}
              className="pl-10"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => <RoomCardSkeleton key={index} />)
            : visibleRooms.slice(0, 6).map((room, index) => <RoomCard key={room.id} room={room} index={index} />)}
        </div>

        {!loading && visibleRooms.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line py-12 text-center">
            <p className="text-[14px] text-ink-muted">{t('No rooms match “{query}”.', { query })}</p>
            <Link to="/rooms" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">
                {t('Browse all rooms')}
              </Button>
            </Link>
          </div>
        ) : null}

        {!loading && visibleRooms.length > 6 ? (
          <div className="mt-7 flex justify-center">
            <Link to="/rooms">
              <Button variant="ghost">
                {t('View all rooms')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : null}
      </section>

      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {[
            {
              title: t('Create in seconds'),
              body: t('Name your room, pick visibility, share the link. Guests join without an account.'),
            },
            {
              title: t('Host controls'),
              body: t('Approve join requests, mute, remove, lock the room or transfer hosting anytime.'),
            },
            {
              title: t('Built for clarity'),
              body: t('Adaptive video grid, connection radar, low bandwidth mode and crisp room chat.'),
            },
          ].map((item) => (
            <div key={item.title}>
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-accent">
                <Users className="h-4 w-4" />
              </div>
              <h3 className="text-[14.5px] font-semibold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-subtle">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
