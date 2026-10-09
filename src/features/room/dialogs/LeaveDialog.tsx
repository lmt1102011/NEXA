import { useMemo, useState } from 'react'
import { ArrowRight, LogOut, PhoneOff, PowerOff, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { useT } from '@/lib/i18n'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'
import { hostEndRoom, hostLeaveWithDelegate, leaveRoom } from '@/features/room/session/sessionController'

export function LeaveDialog() {
  const modal = useUiStore((state) => state.modal)
  const setModal = useUiStore((state) => state.setModal)
  const self = useRoomSessionStore((state) => state.self)
  const room = useRoomSessionStore((state) => state.room)
  const participants = useRoomSessionStore((state) => state.participants)
  const participantCount = useRoomSessionStore((state) => state.participants.length)
  const navigate = useNavigate()
  const t = useT()

  const [pickMode, setPickMode] = useState(false)
  const [delegateId, setDelegateId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const isHost = self?.role === 'host'
  const others = useMemo(
    () => participants.filter((participant) => !participant.isSelf),
    [participants],
  )
  const defaultDelegate = others[0]?.id ?? null

  function close() {
    setPickMode(false)
    setDelegateId(null)
    setNote('')
    setModal(null)
  }

  function handleLeaveOnly() {
    if (isHost && others.length > 0) {
      setDelegateId(defaultDelegate)
      setPickMode(true)
      return
    }
    close()
    leaveRoom()
    navigate('/')
  }

  function handleConfirmDelegate() {
    const target = delegateId ?? defaultDelegate
    close()
    if (target) hostLeaveWithDelegate(target, note)
    else leaveRoom()
    navigate('/')
  }

  function handleEndForAll() {
    close()
    hostEndRoom()
  }

  return (
    <Dialog
      open={modal === 'leave'}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent className="max-w-sm">
        {pickMode ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-accent" />
                {t('Who takes over this room?')}
              </DialogTitle>
              <DialogDescription>
                {t('Pick the new host and, if you want, leave a note for the room before you step out.')}
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="pb-4">
              <div className="space-y-2">
                {others.map((participant) => (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => setDelegateId(participant.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      (delegateId ?? defaultDelegate) === participant.id
                        ? 'border-accent/60 bg-accent-soft'
                        : 'border-line bg-surface-2 hover:border-line-strong'
                    }`}
                  >
                    <Avatar name={participant.name} color={participant.avatarColor} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{participant.name}</span>
                      <span className="block text-[12px] text-ink-subtle">
                        {participant.role === 'host' ? t('Host') : t('Guest')}
                      </span>
                    </span>
                    <span
                      className={`h-4 w-4 shrink-0 rounded-full border ${
                        (delegateId ?? defaultDelegate) === participant.id
                          ? 'border-accent bg-accent'
                          : 'border-line-strong'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-[12.5px] font-medium text-ink-muted" htmlFor="handoff-note">
                {t('Note for the room (optional)')}
              </label>
              <Input
                id="handoff-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("e.g. I'll be back in 10 minutes…")}
                maxLength={140}
                className="mt-1.5"
              />
            </DialogBody>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setPickMode(false)}>
                {t('Back')}
              </Button>
              <Button variant="danger" onClick={handleConfirmDelegate}>
                <LogOut className="h-4 w-4" />
                {t('Transfer & leave')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PhoneOff className="h-4 w-4 text-danger" />
                {t('Leave “{name}”?', { name: room?.name ?? 'room' })}
              </DialogTitle>
              <DialogDescription>
                {isHost
                  ? t(
                      'You are the host of {count} people. End the room for everyone, or hand it off and step out yourself.',
                      { count: participantCount },
                    )
                  : t('Your camera and microphone will turn off right away. The room keeps going without you.')}
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
                    <span className="block text-[13.5px] font-medium text-danger">{t('End room for everyone')}</span>
                    <span className="block text-[12px] text-ink-subtle">
                      {t('Disconnects all {count} people and closes the room.', { count: participantCount })}
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
                    {isHost ? t('Leave only me') : t('Leave room')}
                  </span>
                  <span className="block text-[12px] text-ink-subtle">
                    {isHost
                      ? t('Hand the room to someone else and step out yourself.')
                      : t('You can rejoin later if the room is still open.')}
                  </span>
                </span>
              </button>
            </DialogBody>

            <DialogFooter>
              <Button variant="secondary" onClick={close}>
                <Users className="h-4 w-4" />
                {t('Stay in room')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}