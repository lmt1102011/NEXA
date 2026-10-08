import { Keyboard, Link2, LogOut, MessageSquare, Settings, SlidersHorizontal, Users, Wrench } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/cn'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'

export function MoreSheet() {
  const modal = useUiStore((state) => state.modal)
  const setModal = useUiStore((state) => state.setModal)
  const setPanel = useUiStore((state) => state.setPanel)
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)
  const self = useRoomSessionStore((state) => state.self)
  const navigate = useNavigate()
  const { roomId } = useParams()

  const isHost = self?.role === 'host'

  const entries = [
    { icon: <MessageSquare className="h-4.5 w-4.5" />, label: 'Chat', onClick: () => setPanel('chat') },
    { icon: <Users className="h-4.5 w-4.5" />, label: 'People', onClick: () => setPanel('participants') },
    { icon: <Wrench className="h-4.5 w-4.5" />, label: 'Tools', onClick: () => setPanel('tools') },
    { icon: <SlidersHorizontal className="h-4.5 w-4.5" />, label: 'Devices', onClick: () => setModal('devices') },
    { icon: <Link2 className="h-4.5 w-4.5" />, label: 'Invite', onClick: () => setModal('invite') },
    { icon: <Keyboard className="h-4.5 w-4.5" />, label: 'Shortcuts', onClick: () => setShortcutsOpen(true) },
    ...(isHost
      ? [{ icon: <Settings className="h-4.5 w-4.5" />, label: 'Room settings', onClick: () => navigate(`/room/${roomId}/settings`) }]
      : []),
  ]

  function close() {
    setModal(null)
  }

  return (
    <Sheet
      open={modal === 'more'}
      onOpenChange={(open) => {
        if (!open) setModal(null)
      }}
    >
      <SheetContent side="bottom" title="Room menu" description="Everything else you can do here.">
        <div className="grid grid-cols-3 gap-2.5">
          {entries.map((entry) => (
            <button
              key={entry.label}
              type="button"
              onClick={() => {
                entry.onClick()
                close()
              }}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border border-line bg-surface-2 px-2 py-3.5 text-center transition-colors hover:border-line-strong hover:bg-surface-3',
              )}
            >
              <span className="text-ink-muted">{entry.icon}</span>
              <span className="text-[11.5px] font-medium text-ink">{entry.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            close()
            setModal('leave')
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-danger-solid px-4 py-3 text-[14px] font-medium text-white transition hover:brightness-110"
        >
          <LogOut className="h-4 w-4" />
          Leave room
        </button>
      </SheetContent>
    </Sheet>
  )
}
