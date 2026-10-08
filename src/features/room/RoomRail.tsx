import { Keyboard, MessageSquare, Settings, Users, Wrench } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'
import type { RoomPanel } from '@/types'

interface RailItem {
  panel?: RoomPanel
  icon: React.ReactNode
  label: string
  badge?: number
  onClick: () => void
}

export function RoomRail() {
  const navigate = useNavigate()
  const { roomId } = useParams()
  const panel = useUiStore((state) => state.panel)
  const setPanel = useUiStore((state) => state.setPanel)
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)
  const unread = useRoomSessionStore((state) => state.unread)
  const requests = useRoomSessionStore((state) => state.requests.length)
  const self = useRoomSessionStore((state) => state.self)

  const items: RailItem[] = [
    {
      panel: 'chat',
      icon: <MessageSquare className="h-[18px] w-[18px]" />,
      label: 'Chat',
      badge: unread,
      onClick: () => setPanel('chat'),
    },
    {
      panel: 'participants',
      icon: <Users className="h-[18px] w-[18px]" />,
      label: 'People',
      badge: requests,
      onClick: () => setPanel('participants'),
    },
    {
      panel: 'tools',
      icon: <Wrench className="h-[18px] w-[18px]" />,
      label: 'Tools',
      onClick: () => setPanel('tools'),
    },
    self?.role === 'host'
      ? {
          icon: <Settings className="h-[18px] w-[18px]" />,
          label: 'Room',
          onClick: () => navigate(`/room/${roomId}/settings`),
        }
      : {
          icon: <Keyboard className="h-[18px] w-[18px]" />,
          label: 'Keys',
          onClick: () => setShortcutsOpen(true),
        },
  ]

  return (
    <nav aria-label="Room navigation" className="hidden w-[72px] shrink-0 flex-col items-center gap-2 border-r border-line bg-surface/50 py-4 lg:flex">
      {items.map((item) => {
        const active = item.panel ? panel === item.panel : false
        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            aria-label={item.label}
            aria-pressed={item.panel ? active : undefined}
            className={cn(
              'group relative flex w-[56px] flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              active ? 'bg-accent-soft text-accent' : 'text-ink-subtle hover:bg-surface-3 hover:text-ink',
            )}
          >
            <span className="relative">
              {item.icon}
              {item.badge ? (
                <span
                  className={cn(
                    'absolute -right-2.5 -top-1.5 grid min-w-[16px] place-items-center rounded-full px-1 font-mono text-[10px] font-semibold leading-4 text-white',
                    item.panel === 'participants' ? 'bg-warning' : 'bg-accent-solid',
                  )}
                >
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
            </span>
            <span className="text-[10.5px] font-medium">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
