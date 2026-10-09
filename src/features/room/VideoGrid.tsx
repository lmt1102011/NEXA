import { useMemo, useState } from 'react'
import { ChevronDown, Mic, MicOff, Users, VideoOff, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { useBreakpoint, useMediaQuery } from '@/hooks'
import { Avatar } from '@/components/ui/avatar'
import { VideoTile } from '@/features/room/VideoTile'
import type { Participant } from '@/types'

const MAX_VISIBLE_TILES = 6

interface Layout {
  cols: number
  rows: number
  spanLast?: boolean
}

function computeLayout(count: number, landscape: boolean, isMobile: boolean): Layout {
  if (count <= 1) return { cols: 1, rows: 1 }
  if (isMobile) {
    if (!landscape) {
      if (count <= 2) return { cols: 1, rows: count }
      return { cols: 2, rows: Math.ceil(count / 2) }
    }
    if (count <= 2) return { cols: 2, rows: 1 }
    if (count <= 4) return { cols: 2, rows: Math.ceil(count / 2) }
    return { cols: 3, rows: Math.ceil(count / 3) }
  }
  if (count === 2) return { cols: 2, rows: 1 }
  if (count === 3) return { cols: 2, rows: 2, spanLast: true }
  if (count === 4) return { cols: 2, rows: 2 }
  if (count <= 6) return { cols: 3, rows: Math.ceil(count / 3) }
  if (count <= 9) return { cols: 3, rows: Math.ceil(count / 3) }
  return { cols: 4, rows: Math.ceil(count / 4) }
}

export function VideoGrid({ participants }: { participants: Participant[] }) {
  const t = useT()
  const { isMobile, isDesktop } = useBreakpoint()
  const landscape = useMediaQuery('(orientation: landscape)')
  const [expanded, setExpanded] = useState(false)

  const ordered = useMemo(() => {
    const others = participants.filter((participant) => !participant.isSelf)
    const self = participants.filter((participant) => participant.isSelf)
    return [...others, ...self]
  }, [participants])

  const hiddenCount = Math.max(0, ordered.length - MAX_VISIBLE_TILES)
  const visible = hiddenCount > 0 ? ordered.slice(0, MAX_VISIBLE_TILES - 1) : ordered
  const gridCount = visible.length + (hiddenCount > 0 ? 1 : 0)

  const layout = computeLayout(gridCount, landscape, isMobile)
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
    gap: isDesktop ? 12 : 8,
  }

  return (
    <div className="relative h-full w-full">
      <div className="h-full w-full overflow-y-auto nx-scroll p-2 sm:p-3" style={gridStyle}>
        {visible.map((participant, index) => {
          const span = layout.spanLast && index === gridCount - 1 && layout.cols > 1
          return (
            <VideoTile
              key={participant.id}
              participant={participant}
              className={span ? 'col-span-2' : undefined}
            />
          )
        })}

        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={t('Show all participants ({count})', { count: ordered.length })}
            className={cn(
              'group flex min-h-0 flex-col items-center justify-center gap-2 rounded-xl border border-line border-dashed bg-surface/40 transition-colors hover:border-accent/50 hover:bg-accent-soft/40',
              layout.spanLast && !layout.cols ? '' : '',
            )}
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-3 text-[15px] font-semibold text-ink transition-transform group-hover:scale-105">
              +{hiddenCount}
            </span>
            <span className="text-[11.5px] font-medium text-ink-muted">{t('More')}</span>
          </button>
        ) : null}
      </div>

      {expanded ? (
        <ParticipantsOverlay participants={ordered} onClose={() => setExpanded(false)} />
      ) : null}
    </div>
  )
}

function ParticipantsOverlay({
  participants,
  onClose,
}: {
  participants: Participant[]
  onClose: () => void
}) {
  const t = useT()
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-bg/95 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <Users className="h-4 w-4 text-accent" />
          {t('{count} people in the room', { count: participants.length })}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Close')}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto nx-scroll p-2">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5"
          >
            <Avatar name={participant.name} color={participant.avatarColor} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink">
                {participant.name}
                {participant.isSelf ? <span className="text-ink-subtle"> ({t('You')})</span> : null}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-subtle">
                {participant.screenSharing ? (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <ChevronDown className="h-3 w-3 -rotate-90" />
                    {t('Sharing screen')}
                  </span>
                ) : null}
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-ink-subtle">
              {participant.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-danger" />}
              {participant.cameraOn ? null : <VideoOff className="h-4 w-4 text-danger" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}