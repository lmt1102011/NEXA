import { useEffect, useState } from 'react'
import {
  AlarmClock,
  BarChart3,
  Clapperboard,
  ClipboardList,
  ListTodo,
  Lock,
  Maximize,
  Minimize,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, LiveDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogoMark } from '@/components/brand/logo'
import { useT } from '@/lib/i18n'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'
import { ConnectionRadar } from '@/features/room/ConnectionRadar'

interface ActivityIcon {
  key: string
  icon: 'timer' | 'poll' | 'task' | 'todo'
  mine: boolean
}

function ActivityIconGlyph({ type, mine }: { type: ActivityIcon['icon']; mine: boolean }) {
  const cls = mine ? 'h-3.5 w-3.5 text-accent' : 'h-3.5 w-3.5 text-ink-subtle'
  if (type === 'timer') return <AlarmClock className={cls} />
  if (type === 'poll') return <BarChart3 className={cls} />
  if (type === 'task') return <ClipboardList className={cls} />
  return <ListTodo className={cls} />
}

export function RoomHeader() {
  const t = useT()
  const navigate = useNavigate()
  const room = useRoomSessionStore((state) => state.room)
  const self = useRoomSessionStore((state) => state.self)
  const participantCount = useRoomSessionStore((state) => state.participants.length)
  const polls = useRoomSessionStore((state) => state.polls)
  const tasks = useRoomSessionStore((state) => state.tasks)
  const todos = useRoomSessionStore((state) => state.todos)
  const timer = useRoomSessionStore((state) => state.timer)
  const activitiesUnread = useRoomSessionStore((state) => state.activitiesUnread)
  const setPanel = useUiStore((state) => state.setPanel)
  const setModal = useUiStore((state) => state.setModal)

  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const fullscreenSupported =
    typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen)

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen()
    } catch {
      // fullscreen is best-effort per device
    }
  }

  if (!room) return null
  const isHost = self?.role === 'host'

  const activityIcons: ActivityIcon[] = []
  if (timer) activityIcons.push({ key: 'timer', icon: 'timer', mine: false })
  for (const poll of polls) activityIcons.push({ key: `poll-${poll.id}`, icon: 'poll', mine: false })
  for (const task of tasks)
    activityIcons.push({ key: `task-${task.id}`, icon: 'task', mine: Boolean(self && task.assigneeId === self.id) })
  for (const todo of todos) activityIcons.push({ key: `todo-${todo.id}`, icon: 'todo', mine: false })
  const visibleIcons = activityIcons.slice(0, 9)
  const hiddenCount = activityIcons.length - visibleIcons.length

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-2.5 border-b border-line bg-surface/85 px-3 backdrop-blur sm:px-4">
      <Link
        to="/"
        aria-label={t('NEXA home')}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors hover:bg-surface-3"
      >
        <LogoMark size={22} />
      </Link>

      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-sm font-medium text-ink max-w-[34vw] sm:max-w-[280px]">{room.name}</h1>
        <Badge variant="outline" className="hidden font-mono sm:inline-flex">
          {room.code}
        </Badge>
        <Badge variant="success" className="hidden md:inline-flex">
          <LiveDot />
          {t('Live')}
        </Badge>
        {room.settings.access.lockRoom ? (
          <Badge variant="warning">
            <Lock className="h-3 w-3" />
            <span className="hidden sm:inline">{t('Locked')}</span>
          </Badge>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ConnectionRadar className="hidden sm:inline-flex" />

        <button
          type="button"
          onClick={() => setPanel('activities')}
          aria-label={
            activityIcons.length > 0
              ? t('{count} activities', { count: activityIcons.length })
              : t('Activities')
          }
          title={
            activityIcons.length > 0
              ? t('{count} activities', { count: activityIcons.length })
              : t('Activities')
          }
          className="relative flex h-9 items-center gap-1 rounded-lg border border-line bg-surface-2 px-2 text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          {activityIcons.length === 0 ? (
            <span className="grid gap-0.5">
              <Clapperboard className="h-4 w-4 text-ink-subtle" />
            </span>
          ) : (
            <span className="flex items-center gap-[3px]">
              {visibleIcons.map((entry) => (
                <span
                  key={entry.key}
                  className={entry.mine ? 'grid h-5 w-5 place-items-center rounded-md bg-accent/15' : 'grid place-items-center'}
                >
                  <ActivityIconGlyph type={entry.icon} mine={entry.mine} />
                </span>
              ))}
              {hiddenCount > 0 ? (
                <span className="pl-0.5 font-mono text-[10.5px] text-ink-subtle">+{hiddenCount}</span>
              ) : null}
            </span>
          )}
          {activitiesUnread > 0 ? (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger-solid ring-2 ring-surface" aria-hidden />
          ) : null}
        </button>

        {fullscreenSupported ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? t('Exit fullscreen') : t('Fullscreen')}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2 text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setPanel('participants')}
          aria-label={t('Show participants')}
          className="hidden h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink sm:inline-flex"
        >
          <Users className="h-4 w-4" />
          {participantCount}
        </button>

        {isHost ? (
          <button
            type="button"
            onClick={() => navigate(`/room/${room.id}/settings`)}
            aria-label={t('Room settings')}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2 text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <Settings className="h-4 w-4" />
          </button>
        ) : null}

        <Button size="sm" variant="secondary" className="hidden md:inline-flex" onClick={() => setModal('invite')}>
          <UserPlus className="h-4 w-4" />
          {t('Invite')}
        </Button>
      </div>
    </header>
  )
}