import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import type { Room } from '@/types'
import { Avatar } from '@/components/ui/avatar'
import { Badge, LiveDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { avatarColorFor, timeAgo } from '@/lib/utils'

export function RoomCard({ room, index = 0 }: { room: Room; index?: number }) {
  const isLive = room.status === 'live'
  const isFull = room.participantCount >= room.settings.participants.maxParticipants

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition-[border-color,box-shadow,transform] duration-200 ease-out-soft hover:-translate-y-[3px] hover:border-accent/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-[15px] font-semibold text-ink" title={room.name}>
          {room.name}
        </h3>
        {isFull ? (
          <Badge variant="warning" className="shrink-0">
            Full
          </Badge>
        ) : isLive ? (
          <Badge variant="success" className="shrink-0">
            <LiveDot />
            Live
          </Badge>
        ) : (
          <Badge className="shrink-0">Idle</Badge>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Avatar name={room.hostName} size="xs" color={avatarColorFor(room.hostName)} />
        <span className="truncate text-[13px] text-ink-muted">
          Hosted by <span className="font-medium text-ink-muted">{room.hostName}</span>
        </span>
      </div>

      {room.description ? (
        <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-ink-subtle">
          {room.description}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5">
        <div className="flex min-w-0 items-center gap-3 text-[12.5px] text-ink-subtle">
          <span className="inline-flex items-center gap-1.5 font-mono" title={`${room.participantCount} of ${room.settings.participants.maxParticipants} seats`}>
            <Users className="h-3.5 w-3.5" />
            {room.participantCount}/{room.settings.participants.maxParticipants}
          </span>
          {room.visibility === 'private' ? (
            <Badge variant="outline" className="h-5 px-1.5 text-[10.5px]">
              Private
            </Badge>
          ) : (
            <span className="hidden truncate sm:inline">{timeAgo(room.lastActiveAt)}</span>
          )}
        </div>
        <Link to={`/room/${room.id}`} className="shrink-0">
          <Button
            size="sm"
            variant={isFull ? 'secondary' : 'primary'}
            aria-label={isFull ? `View ${room.name}` : `Join ${room.name}`}
          >
            {isFull ? 'View' : 'Join'}
          </Button>
        </Link>
      </div>
    </motion.article>
  )
}

export function RoomCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="nx-skeleton h-4 w-32" />
        <div className="nx-skeleton h-5 w-14 rounded-full" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="nx-skeleton h-6 w-6 rounded-full" />
        <div className="nx-skeleton h-3.5 w-28" />
      </div>
      <div className="nx-skeleton mt-3 h-3.5 w-full" />
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3.5">
        <div className="nx-skeleton h-3.5 w-20" />
        <div className="nx-skeleton h-8 w-16" />
      </div>
    </div>
  )
}
