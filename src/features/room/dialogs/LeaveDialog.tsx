import { LogOut, PhoneOff, PowerOff, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'
import { hostEndRoom, leaveRoom } from '@/features/room/session/sessionController'

export function LeaveDialog() {
  const modal = useUiStore((state) => state.modal)
  const setModal = useUiStore((state) => state.setModal)
  const self = useRoomSessionStore((state) => state.self)
  const room = useRoomSessionStore((state) => state.room)
  const participantCount = useRoomSessionStore((state) => state.participants.length)
  const navigate = useNavigate()

  const isHost = self?.role === 'host'

  function handleLeaveOnly() {
    setModal(null)
    leaveRoom()
    navigate('/')
  }

  function handleEndForAll() {
    setModal(null)
    hostEndRoom()
  }

  return (
    <Dialog
      open={modal === 'leave'}
      onOpenChange={(open) => {
        if (!open) setModal(null)
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneOff className="h-4 w-4 text-danger" />
            Leave “{room?.name ?? 'room'}”?
          </DialogTitle>
          <DialogDescription>
            {isHost
              ? `You are the host of ${participantCount} ${participantCount === 1 ? 'person' : 'people'}. End the room for everyone, or just step out yourself.`
              : 'Your camera and microphone will turn off right away. The room keeps going without you.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-2.5 pb-4">
          {isHost ? (
            <button
              type="button"
              onClick={handleEndForAll}
              className="flex w-full items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft p-3 text-left transition-colors hover:border-danger hover:bg-danger-soft/80"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-danger-solid text-white">
                <PowerOff className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-[13.5px] font-medium text-danger">End room for everyone</span>
                <span className="block text-[12px] text-ink-subtle">
                  Disconnects all {participantCount} {participantCount === 1 ? 'person' : 'people'} and closes the room.
                </span>
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleLeaveOnly}
            className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 text-left transition-colors hover:border-line-strong"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-muted">
              <LogOut className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[13.5px] font-medium text-ink">
                {isHost ? 'Leave only me' : 'Leave room'}
              </span>
              <span className="block text-[12px] text-ink-subtle">
                {isHost
                  ? 'Hand the room to someone else and step out yourself.'
                  : 'You can rejoin later if the room is still open.'}
              </span>
            </span>
          </button>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setModal(null)}>
            <Users className="h-4 w-4" />
            Stay in room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
