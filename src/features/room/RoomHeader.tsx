import { Lock, Settings, UserPlus, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, LiveDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogoMark } from '@/components/brand/logo'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'
import { ConnectionRadar } from '@/features/room/ConnectionRadar'

export function RoomHeader() {
  const navigate = useNavigate()
  const room = useRoomSessionStore((state) => state.room)
  const self = useRoomSessionStore((state) => state.self)
  const participantCount = useRoomSessionStore((state) => state.participants.length)
  const setPanel = useUiStore((state) => state.setPanel)
  const setModal = useUiStore((state) => state.setModal)

  if (!room) return null
  const isHost = self?.role === 'host'

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-2.5 border-b border-line bg-surface/85 px-3 backdrop-blur sm:px-4">
      <Link
        to="/"
        aria-label="NEXA home"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors hover:bg-surface-3"
      >
        <LogoMark size={22} />
      </Link>

      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-sm font-medium text-ink max-w-[38vw] sm:max-w-[280px]">{room.name}</h1>
        <Badge variant="outline" className="hidden font-mono sm:inline-flex">
          {room.code}
        </Badge>
        <Badge variant="success" className="hidden md:inline-flex">
          <LiveDot />
          Live
        </Badge>
        {room.settings.access.lockRoom ? (
          <Badge variant="warning">
            <Lock className="h-3 w-3" />
            <span className="hidden sm:inline">Locked</span>
          </Badge>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ConnectionRadar className="hidden sm:inline-flex" />

        <button
          type="button"
          onClick={() => setPanel('participants')}
          aria-label="Show participants"
          className="hidden h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink sm:inline-flex"
        >
          <Users className="h-4 w-4" />
          {participantCount}
        </button>

        {isHost ? (
          <button
            type="button"
            onClick={() => navigate(`/room/${room.id}/settings`)}
            aria-label="Room settings"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2 text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <Settings className="h-4 w-4" />
          </button>
        ) : null}

        <Button size="sm" variant="secondary" className="hidden md:inline-flex" onClick={() => setModal('invite')}>
          <UserPlus className="h-4 w-4" />
          Invite
        </Button>
      </div>
    </header>
  )
}
