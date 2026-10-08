import { useMemo } from 'react'
import { useBreakpoint, useMediaQuery } from '@/hooks'
import { VideoTile } from '@/features/room/VideoTile'
import type { Participant } from '@/types'

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
  const { isMobile, isDesktop } = useBreakpoint()
  const landscape = useMediaQuery('(orientation: landscape)')

  const ordered = useMemo(() => {
    const others = participants.filter((participant) => !participant.isSelf)
    const self = participants.filter((participant) => participant.isSelf)
    return [...others, ...self]
  }, [participants])

  const layout = computeLayout(ordered.length, landscape, isMobile)
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
    gap: isDesktop ? 12 : 8,
  }

  return (
    <div className="h-full w-full overflow-y-auto nx-scroll p-2 sm:p-3" style={gridStyle}>
      {ordered.map((participant, index) => {
        const span = layout.spanLast && index === ordered.length - 1 && layout.cols > 1
        return (
          <VideoTile
            key={participant.id}
            participant={participant}
            className={span ? 'col-span-2' : undefined}
          />
        )
      })}
    </div>
  )
}
