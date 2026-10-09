import { Keyboard, Link2, LogOut, MessageSquare, MonitorUp, Settings, SlidersHorizontal, Users } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useCallStore } from '@/stores/call'
import { useUiStore } from '@/stores/ui'
import { toggleScreenShare } from '@/features/room/session/sessionController'

export function MoreSheet() {
  const modal = useUiStore((state) => state.modal)
  const setModal = useUiStore((state) => state.setModal)
  const setPanel = useUiStore((state) => state.setPanel)
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)
  const self = useRoomSessionStore((state) => state.self)
  const requests = useRoomSessionStore((state) => state.requests.length)
  const sharing = useCallStore((state) => state.sharing)
  const navigate = useNavigate()
  const { roomId } = useParams()
  const t = useT()

  const isHost = self?.role === 'host'

  const entries = [
    { icon: <MessageSquare className="h-4.5 w-4.5" />, label: t('Chat'), onClick: () => setPanel('chat') },
    {
      icon: <Users className="h-4.5 w-4.5" />,
      label: t('People'),
      badge: requests,
      onClick: () => setPanel('participants'),
    },
    {
      icon: <MonitorUp className="h-4.5 w-4.5" />,
      label: sharing ? t('Stop sharing') : t('Share screen'),
      tone: 'danger',
      active: sharing,
      onClick: () => void toggleScreenShare(),
    },
    { icon: <SlidersHorizontal className="h-4.5 w-4.5" />, label: t('Devices'), onClick: () => setModal('devices') },
    { icon: <Link2 className="h-4.5 w-4.5" />, label: t('Invite'), onClick: () => setModal('invite') },
    { icon: <Keyboard className="h-4.5 w-4.5" />, label: t('Shortcuts'), onClick: () => setShortcutsOpen(true) },
    ...(isHost
      ? [
          {
            icon: <Settings className="h-4.5 w-4.5" />,
            label: t('Room settings'),
            onClick: () => navigate(`/room/${roomId}/settings`),
          },
        ]
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
      <SheetContent side="bottom" title={t('Room menu')} description={t('Everything else you can do here.')}>
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
                'flex flex-col items-center gap-2 rounded-xl border px-2 py-3.5 text-center transition-colors',
                'active' in entry && entry.active && 'tone' in entry && entry.tone === 'danger'
                  ? 'border-danger/40 bg-danger-soft text-danger'
                  : 'active' in entry && entry.active
                    ? 'border-accent/40 bg-accent-soft text-accent'
                    : 'border-line bg-surface-2 hover:border-line-strong hover:bg-surface-3',
              )}
            >
              <span
                className={cn(
                  'relative',
                  'active' in entry && entry.active && 'tone' in entry && entry.tone === 'danger'
                    ? 'text-danger'
                    : 'active' in entry && entry.active
                      ? 'text-accent'
                      : 'text-ink-muted',
                )}
              >
                {entry.icon}
                {'dot' in entry && entry.dot ? (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger-solid ring-2 ring-surface" aria-hidden />
                ) : null}
                {'badge' in entry && entry.badge && entry.badge > 0 ? (
                  <span className="absolute -right-2 -top-1.5 grid min-w-[16px] place-items-center rounded-full bg-accent-solid px-1 font-mono text-[9px] font-semibold leading-4 text-white">
                    {entry.badge > 9 ? '9+' : entry.badge}
                  </span>
                ) : null}
              </span>
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
          {t('Leave room')}
        </button>
      </SheetContent>
    </Sheet>
  )
}
