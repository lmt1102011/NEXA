import { Clapperboard, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t, useT } from '@/lib/i18n'
import { useUiStore } from '@/stores/ui'
import { ChatPanel } from '@/features/room/panels/ChatPanel'
import { ParticipantsPanel } from '@/features/room/panels/ParticipantsPanel'
import { ActivitiesPanel } from '@/features/room/panels/ActivitiesPanel'
import type { RoomPanel as RoomPanelKey } from '@/types'

const TABS: { key: RoomPanelKey; label: string; icon: React.ReactNode }[] = [
  { key: 'chat', label: t('Chat'), icon: <MessageSquare className="h-4 w-4" /> },
  { key: 'activities', label: t('Activities'), icon: <Clapperboard className="h-4 w-4" /> },
]

export function RoomPanel({ className, embedded = true }: { className?: string; embedded?: boolean }) {
  const t = useT()
  const panel = useUiStore((state) => state.panel)
  const setPanel = useUiStore((state) => state.setPanel)
  const active: RoomPanelKey = panel && panel !== 'settings' ? panel : 'chat'

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-surface', className)}>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2.5">
        <div className="flex flex-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setPanel(tab.key)}
              aria-pressed={active === tab.key}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors',
                active === tab.key ? 'bg-accent-soft text-accent' : 'text-ink-subtle hover:bg-surface-3 hover:text-ink',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        {embedded ? (
          <button
            type="button"
            aria-label={t('Close panel')}
            onClick={() => setPanel(null)}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {active === 'chat' ? (
          <ChatPanel />
        ) : active === 'participants' ? (
          <ParticipantsPanel />
        ) : (
          <ActivitiesPanel />
        )}
      </div>
    </div>
  )
}
