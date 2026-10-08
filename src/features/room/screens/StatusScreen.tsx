import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Lock, Loader2, PhoneOff, SearchX, UserX, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRoomSessionStore } from '@/stores/roomSession'

export function RoomLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface-2">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </span>
        <div>
          <p className="text-[15px] font-medium text-ink">Opening room…</p>
          <p className="mt-1 text-[13px] text-ink-subtle">Fetching room details and checking access.</p>
        </div>
      </div>
    </div>
  )
}

export default function RoomStatusScreen() {
  const navigate = useNavigate()
  const status = useRoomSessionStore((state) => state.status)
  const statusDetail = useRoomSessionStore((state) => state.statusDetail)
  const room = useRoomSessionStore((state) => state.room)
  const setStatus = useRoomSessionStore((state) => state.setStatus)

  const config = getStatusConfig(status, statusDetail)

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface-2">
          <span className="text-ink-subtle">{config.icon}</span>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          <h1 className="text-lg font-semibold text-ink">{config.title}</h1>
        </div>

        {room ? (
          <div className="mt-2 flex items-center justify-center gap-2 text-[13px] text-ink-subtle">
            <span className="truncate max-w-[220px]">{room.name}</span>
            <Badge variant="outline" className="font-mono">
              {room.code}
            </Badge>
          </div>
        ) : null}

        <p className="mx-auto mt-3 max-w-sm text-[13.5px] leading-relaxed text-ink-subtle">{config.description}</p>

        <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          {config.retry ? (
            <Button className="w-full sm:w-auto" onClick={() => setStatus('prejoin')}>
              {config.retry}
            </Button>
          ) : null}
          <Button
            variant={config.retry ? 'secondary' : 'primary'}
            className="w-full sm:w-auto"
            onClick={() => navigate(config.home ? '/' : '/rooms')}
          >
            {config.home ? 'Back to Home' : 'Browse other rooms'}
          </Button>
        </div>

        <button
          type="button"
          className="mt-4 text-[13px] text-ink-subtle underline-offset-4 transition-colors hover:text-ink hover:underline"
          onClick={() => navigate('/rooms')}
        >
          Or pick another live room
        </button>
      </div>
    </div>
  )
}

function getStatusConfig(status: string, detail: string) {
  switch (status) {
    case 'not-found':
      return {
        icon: <SearchX className="h-6 w-6" />,
        title: 'Room not found',
        description: 'This room may have been deleted, or the link is incorrect.',
        home: true,
      }
    case 'full':
      return {
        icon: <Users className="h-6 w-6" />,
        title: 'Room is full',
        description: `Every seat is taken right now. Try again in a moment, or browse other public rooms.`,
        home: false,
      }
    case 'locked':
      return {
        icon: <Lock className="h-6 w-6" />,
        title: 'Room is locked',
        description: 'The host locked this room. Ask them to let you in, or try again later.',
        home: false,
      }
    case 'rejected':
      return {
        icon: <UserX className="h-6 w-6" />,
        title: 'Request declined',
        description: detail || 'The host declined your request to join this room.',
        home: true,
        retry: 'Try again',
      }
    case 'ended':
      return {
        icon: <PhoneOff className="h-6 w-6" />,
        title: 'Room has ended',
        description: 'The host ended this room. Everyone has been disconnected.',
        home: true,
      }
    default:
      return {
        icon: <AlertTriangle className="h-6 w-6" />,
        title: 'Something went wrong',
        description: detail || 'We could not open this room. Please try again.',
        home: true,
        retry: 'Try again',
      }
  }
}
