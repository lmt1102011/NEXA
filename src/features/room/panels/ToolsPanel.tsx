import {
  Copy,
  Gauge,
  Keyboard,
  Link2,
  Palette,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { useCopy } from '@/hooks'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'
import { applyHostSettings } from '@/features/room/session/sessionController'
import { buildInviteLink } from '@/lib/invite'
import type { RoomBackground } from '@/types'

const BACKGROUNDS: { value: RoomBackground; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'grid', label: 'Grid' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'solid', label: 'Solid' },
]

export function ToolsPanel() {
  const navigate = useNavigate()
  const { roomId } = useParams()
  const room = useRoomSessionStore((state) => state.room)
  const self = useRoomSessionStore((state) => state.self)
  const setModal = useUiStore((state) => state.setModal)
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)
  const lowBandwidth = useCallStore((state) => state.lowBandwidth)
  const setLowBandwidth = useCallStore((state) => state.setLowBandwidth)
  const { copied, copy } = useCopy()

  if (!room) return null
  const isHost = self?.role === 'host'
  const link = typeof window !== 'undefined' ? buildInviteLink(room) : ''

  return (
    <div className="h-full space-y-5 overflow-y-auto nx-scroll px-3 py-3.5">
      <section>
        <SectionTitle icon={<UserPlus className="h-3.5 w-3.5" />} title="Invite & share" />
        <div className="mt-2 space-y-2">
          <ToolRow
            icon={<UserPlus className="h-4 w-4" />}
            title="Invite people"
            description="Share a link or room code."
            action="Open"
            onClick={() => setModal('invite')}
          />
          <ToolRow
            icon={copied ? <Copy className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
            title={copied ? 'Link copied' : 'Copy room link'}
            description={link.replace(/^https?:\/\//, '')}
            action={copied ? 'Copied' : 'Copy'}
            onClick={() => void copy(link)}
          />
        </div>
      </section>

      <section>
        <SectionTitle icon={<SlidersHorizontal className="h-3.5 w-3.5" />} title="Call controls" />
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-muted">
              <Gauge className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-ink">Low bandwidth mode</p>
              <p className="text-[12px] text-ink-subtle">Caps video quality to save data.</p>
            </div>
            <Switch checked={lowBandwidth} onCheckedChange={setLowBandwidth} aria-label="Low bandwidth mode" />
          </div>
          <ToolRow
            icon={<SlidersHorizontal className="h-4 w-4" />}
            title="Devices"
            description="Microphone, camera and speaker."
            action="Adjust"
            onClick={() => setModal('devices')}
          />
          <ToolRow
            icon={<Keyboard className="h-4 w-4" />}
            title="Keyboard shortcuts"
            description="Mute, camera, chat and more."
            action="View"
            onClick={() => setShortcutsOpen(true)}
          />
        </div>
      </section>

      <section>
        <SectionTitle icon={<Palette className="h-3.5 w-3.5" />} title="Room background" />
        <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3">
          <div className={isHost ? undefined : 'pointer-events-none opacity-60'}>
            <Segmented
              ariaLabel="Room background"
              value={room.settings.appearance.background}
              onChange={(value) => applyHostSettings({ appearance: { background: value } })}
              options={BACKGROUNDS}
              size="sm"
              className="w-full"
            />
          </div>
          <p className="mt-2 text-[12px] text-ink-subtle">
            {isHost ? 'Applies to the video stage for everyone.' : 'Only the host can change this.'}
          </p>
        </div>
      </section>

      <section>
        <SectionTitle icon={<Sparkles className="h-3.5 w-3.5" />} title="Host" />
        <div className="mt-2 space-y-2">
          {isHost ? (
            <ToolRow
              icon={<Settings className="h-4 w-4" />}
              title="Room settings"
              description="Access, AV, chat, security."
              action="Open"
              onClick={() => navigate(`/room/${roomId}/settings`)}
            />
          ) : (
            <ToolRow
              icon={<Settings className="h-4 w-4" />}
              title={`Hosted by ${room.hostName}`}
              description="Settings are controlled by the host."
              action=""
              onClick={() => undefined}
            />
          )}
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-subtle">
      {icon}
      {title}
    </h3>
  )
}

function ToolRow({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-3"
    >
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-muted')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-ink">{title}</span>
        <span className="block truncate text-[12px] text-ink-subtle">{description}</span>
      </span>
      {action ? <span className="shrink-0 text-[12.5px] font-medium text-accent">{action}</span> : null}
    </button>
  )
}
