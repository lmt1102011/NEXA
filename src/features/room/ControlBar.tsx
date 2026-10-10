import { useState } from 'react'
import {
  Camera,
  CameraOff,
  Disc3,
  Ellipsis,
  Hand,
  Keyboard,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Settings,
  SmilePlus,
  UserPlus,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { Kbd } from '@/components/ui/feedback'
import { useBreakpoint } from '@/hooks'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'
import {
  sendFloatingReaction,
  toggleCamera,
  toggleHand,
  toggleMic,
  toggleRecording,
  toggleScreenShare,
} from '@/features/room/session/sessionController'

type Tone = 'default' | 'muted' | 'accent' | 'danger'

interface ControlItem {
  key: string
  icon: React.ReactNode
  label: string
  tone?: Tone
  active?: boolean
  badge?: number
  dot?: boolean
  shortcut?: string
  ariaLabel: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

function toneClass(item: ControlItem, mobile: boolean) {
  if (item.tone === 'muted') return 'border-transparent bg-danger-solid text-white hover:brightness-110'
  if (item.danger || item.tone === 'danger')
    return 'border-transparent bg-danger-soft text-danger hover:bg-danger-solid hover:text-white'
  if (item.tone === 'accent' || item.active)
    return 'border-accent/30 bg-accent-soft text-accent hover:bg-accent hover:text-white'
  return mobile
    ? 'border-line bg-surface-2 text-ink'
    : 'border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface-3'
}

function BadgeCount({ item, ringClass }: { item: ControlItem; ringClass: string }) {
  if (item.badge) {
    return (
      <span
        className={cn(
          'absolute grid min-w-[16px] place-items-center rounded-full bg-accent-solid px-1 font-mono text-[9.5px] font-semibold leading-4 text-white',
          ringClass,
        )}
      >
        {item.badge > 9 ? '9+' : item.badge}
      </span>
    )
  }
  if (item.dot) {
    return (
      <span
        className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger-solid ring-2 ring-surface"
        aria-hidden
      />
    )
  }
  return null
}

function DesktopControl({ item }: { item: ControlItem }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      aria-label={item.ariaLabel}
      aria-pressed={item.active}
      disabled={item.disabled}
      className={cn(
        'relative inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-[13px] font-medium transition-[background-color,border-color,color,filter] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.97] xl:px-3.5',
        toneClass(item, false),
        item.disabled && 'cursor-not-allowed opacity-40 hover:brightness-100',
      )}
    >
      <span className="relative">
        {item.icon}
        <BadgeCount item={item} ringClass="-right-2 -top-2 ring-surface" />
      </span>
      <span className="hidden items-center gap-1.5 lg:inline-flex">
        {item.label}
        {item.shortcut ? <Kbd className="opacity-70">{item.shortcut}</Kbd> : null}
      </span>
    </button>
  )
}

function MobileControl({ item }: { item: ControlItem }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      aria-label={item.ariaLabel}
      aria-pressed={item.active}
      disabled={item.disabled}
      className={cn(
        'relative flex h-[52px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-1 transition-[background-color,border-color,color] duration-150 active:scale-95',
        toneClass(item, true),
        item.disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      <span className="relative">
        {item.icon}
        <BadgeCount item={item} ringClass="-right-2.5 -top-2 ring-surface" />
      </span>
    </button>
  )
}

const FLOATING_EMOJIS = ['👍', '👏', '❤️', '😂', '🎉', '😮', '🔥', '🙌']

function ReactionPicker({ mobile = false }: { mobile?: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('Send a reaction')}
          className={cn(
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            mobile
              ? 'relative flex h-[52px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface-2 px-1 text-ink transition-colors active:scale-95'
              : 'relative inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-[13px] font-medium text-ink transition-[background-color,border-color,color] duration-150 hover:border-line-strong hover:bg-surface-3 active:scale-[0.97] xl:px-3.5',
          )}
        >
          <SmilePlus className="h-[18px] w-[18px]" />
          {mobile ? null : <span className="hidden lg:inline">{t('React')}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div className="grid grid-cols-4 gap-1">
          {FLOATING_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={emoji}
              className="grid h-9 w-9 place-items-center rounded-lg text-xl transition-transform hover:scale-125 hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              onClick={() => {
                sendFloatingReaction(emoji)
                setOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ControlBar() {
  const t = useT()
  const { isMobile } = useBreakpoint()

  const panel = useUiStore((state) => state.panel)
  const setPanel = useUiStore((state) => state.setPanel)
  const setModal = useUiStore((state) => state.setModal)
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)

  const micOn = useCallStore((state) => state.micOn)
  const cameraOn = useCallStore((state) => state.cameraOn)
  const sharing = useCallStore((state) => state.sharing)
  const recording = useCallStore((state) => state.recording)
  const audioPermission = useCallStore((state) => state.audioPermission)
  const videoPermission = useCallStore((state) => state.videoPermission)

  const unread = useRoomSessionStore((state) => state.unread)
  const requests = useRoomSessionStore((state) => state.requests.length)
  const self = useRoomSessionStore((state) => state.self)
  const room = useRoomSessionStore((state) => state.room)

  const micBlocked = audioPermission === 'denied' || audioPermission === 'unavailable'
  const camBlocked = videoPermission === 'denied' || videoPermission === 'unavailable'
  const micAvailable = micOn && !micBlocked
  const camAvailable = cameraOn && !camBlocked
  const canShare = room
    ? room.settings.screenShare.allow &&
      (self?.role === 'host' ||
        Boolean(self?.permissions?.canShareScreen) ||
        room.settings.screenShare.allowParticipants)
    : false

  const items: ControlItem[] = [
    {
      key: 'mic',
      icon: micAvailable ? <Mic className="h-[18px] w-[18px]" /> : <MicOff className="h-[18px] w-[18px]" />,
      label: micAvailable ? t('Mute') : t('Unmute'),
      tone: micAvailable ? 'default' : 'muted',
      shortcut: 'M',
      ariaLabel: micAvailable ? t('Mute microphone') : t('Unmute microphone'),
      onClick: () => void toggleMic(),
    },
    {
      key: 'camera',
      icon: camAvailable ? <Camera className="h-[18px] w-[18px]" /> : <CameraOff className="h-[18px] w-[18px]" />,
      label: camAvailable ? t('Stop video') : t('Start video'),
      tone: camAvailable ? 'default' : 'muted',
      shortcut: 'V',
      ariaLabel: camAvailable ? t('Turn camera off') : t('Turn camera on'),
      onClick: () => void toggleCamera(),
    },
    {
      key: 'share',
      icon: <MonitorUp className="h-[18px] w-[18px]" />,
      label: sharing ? t('Stop share') : t('Share'),
      tone: sharing ? 'danger' : 'default',
      danger: sharing,
      active: sharing,
      shortcut: 'S',
      ariaLabel: sharing ? t('Stop screen sharing') : t('Share your screen'),
      onClick: () => void toggleScreenShare(),
      disabled: !sharing && !canShare,
    },
    {
      key: 'hand',
      icon: <Hand className="h-[18px] w-[18px]" />,
      label: self?.handRaised ? t('Lower hand') : t('Raise hand'),
      tone: self?.handRaised ? 'accent' : 'default',
      active: Boolean(self?.handRaised),
      ariaLabel: self?.handRaised ? t('Lower hand') : t('Raise hand'),
      onClick: () => toggleHand(),
    },
    { key: 'divider-1', icon: null, label: '', ariaLabel: '', onClick: () => undefined },
    {
      key: 'chat',
      icon: <MessageSquare className="h-[18px] w-[18px]" />,
      label: t('Chat'),
      active: panel === 'chat',
      badge: unread,
      shortcut: 'C',
      ariaLabel: t('Open chat'),
      onClick: () => setPanel('chat'),
    },
    { key: 'divider-2', icon: null, label: '', ariaLabel: '', onClick: () => undefined },
    {
      key: 'record',
      icon: <Disc3 className="h-[18px] w-[18px]" />,
      label: recording ? t('Stop recording') : t('Record'),
      tone: recording ? 'danger' : 'default',
      danger: recording,
      active: recording,
      ariaLabel: recording ? t('Stop recording') : t('Start recording'),
      onClick: () => toggleRecording(),
    },
    {
      key: 'devices',
      icon: <Settings className="h-[18px] w-[18px]" />,
      label: t('Devices'),
      ariaLabel: t('Device settings'),
      onClick: () => setModal('devices'),
    },
    {
      key: 'invite',
      icon: <UserPlus className="h-[18px] w-[18px]" />,
      label: t('Invite'),
      ariaLabel: t('Invite people'),
      onClick: () => setModal('invite'),
    },
    {
      key: 'shortcuts',
      icon: <Keyboard className="h-[18px] w-[18px]" />,
      label: t('Keys'),
      ariaLabel: t('Keyboard shortcuts'),
      onClick: () => setShortcutsOpen(true),
    },
  ]

  const leaveItem: ControlItem = {
    key: 'leave',
    icon: <PhoneOff className="h-[18px] w-[18px]" />,
    label: t('Leave'),
    tone: 'danger',
    ariaLabel: t('Leave room'),
    danger: true,
    onClick: () => setModal('leave'),
  }

  const moreItem: ControlItem = {
    key: 'more',
    icon: <Ellipsis className="h-[19px] w-[19px]" />,
    label: t('More'),
    badge: requests,
    ariaLabel: t('More options'),
    onClick: () => setModal('more'),
  }

  if (isMobile) {
    const mobileKeys = ['mic', 'camera', 'share', 'hand', 'chat']
    const mobileItems = items.filter((item) => mobileKeys.includes(item.key))
    return (
      <div className="relative z-20 flex shrink-0 items-center gap-1 border-t border-line bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur">
        {mobileItems.map((item) => (
          <MobileControl key={item.key} item={item} />
        ))}
        <ReactionPicker mobile />
        <MobileControl item={moreItem} />
        <MobileControl item={leaveItem} />
      </div>
    )
  }

  return (
    <div className="relative z-20 flex h-[76px] shrink-0 items-center border-t border-line bg-surface/85 px-4 backdrop-blur">
      <div className="flex flex-1 justify-start">
        <span className="hidden items-center gap-2 text-[12.5px] text-ink-subtle xl:flex">
          {room?.visibility === 'private' ? t('Private room') : t('Public room')} ·{' '}
          {self?.role === 'host'
            ? t('You are the host')
            : t('Hosted by {name}', { name: room?.hostName ?? '' })}
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {items
          .filter((item) => ['mic', 'camera', 'share', 'hand'].includes(item.key))
          .map((item) => (
            <DesktopControl key={item.key} item={item} />
          ))}
        <span className="mx-1 h-7 w-px bg-line" aria-hidden />
        {items
          .filter((item) => ['chat', 'record'].includes(item.key))
          .map((item) => (
            <DesktopControl key={item.key} item={item} />
          ))}
        <ReactionPicker />
        <span className="mx-1 hidden h-7 w-px bg-line sm:block lg:hidden" aria-hidden />
        <DesktopControl item={moreItem} />
      </div>

      <div className="flex flex-1 justify-end">
        <DesktopControl item={leaveItem} />
      </div>
    </div>
  )
}
