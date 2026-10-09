import { useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MonitorUp, UserPlus, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { mediaEngine } from '@/services/media/MediaEngine'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'
import { acceptRequest, rejectRequest } from '@/features/room/session/sessionController'
import { VideoGrid } from '@/features/room/VideoGrid'
import { VideoTile } from '@/features/room/VideoTile'
import type { Participant } from '@/types'

export default function RoomStage() {
  const participants = useRoomSessionStore((state) => state.participants)
  const sharing = useCallStore((state) => state.sharing)
  const remoteStreams = useCallStore((state) => state.remoteStreams)
  const background = useRoomSessionStore((state) => state.room?.settings.appearance.background ?? 'default')

  const presenter = useMemo(() => {
    const activeRemote = participants.find(
      (participant) =>
        !participant.isSelf &&
        participant.screenSharing &&
        participant.peerId &&
        remoteStreams[participant.peerId]?.getVideoTracks().some((track) => track.readyState === 'live'),
    )
    if (sharing) {
      const self = participants.find((participant) => participant.isSelf)
      return { stream: () => mediaEngine.getScreenStream(), name: self?.name ?? '', selfPresenting: true }
    }
    if (activeRemote) {
      const stream = remoteStreams[activeRemote.peerId as string]
      return {
        stream: () => stream,
        name: activeRemote.name,
        selfPresenting: false,
      }
    }
    return null
  }, [participants, sharing, remoteStreams])

  const stageStyle: React.CSSProperties | undefined =
    background === 'aurora'
      ? {
          background:
            'radial-gradient(55% 70% at 18% 12%, rgba(124,116,255,0.16), transparent 60%), radial-gradient(45% 60% at 82% 88%, rgba(61,220,151,0.1), transparent 62%), var(--nx-bg)',
        }
      : undefined

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden',
        background === 'grid' && 'nx-grid-bg',
        background === 'solid' ? 'bg-surface-2' : 'bg-bg',
      )}
      style={stageStyle}
    >
      {presenter ? <SharingLayout presenter={presenter} participants={participants} /> : <VideoGrid participants={participants} />}
      <JoinRequestBanner />
    </div>
  )
}

interface Presenter {
  stream: () => MediaStream | null
  name: string
  selfPresenting: boolean
}

function SharingLayout({ presenter, participants }: { presenter: Presenter; participants: Participant[] }) {
  const others = participants.filter((participant) => !participant.isSelf)
  const self = participants.find((participant) => participant.isSelf)

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2 sm:gap-3 sm:p-3">
      <div className="relative min-h-0 flex-1">
        <ScreenTile presenter={presenter} />
      </div>
      <div className="flex h-[84px] shrink-0 gap-2 sm:h-[120px] sm:gap-3">
        {[self, ...others]
          .filter((participant): participant is Participant => Boolean(participant))
          .map((participant) => (
            <div key={participant.id} className="h-full w-[128px] shrink-0 sm:w-[180px]">
              <VideoTile participant={participant} compact className="h-full" />
            </div>
          ))}
      </div>
    </div>
  )
}

function ScreenTile({ presenter }: { presenter: Presenter }) {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const stream = presenter.stream()
    video.srcObject = stream
    if (stream) void video.play().catch(() => undefined)
  }, [presenter])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-line bg-[#07080d] sm:rounded-2xl">
      <video ref={videoRef} playsInline autoPlay className="h-full w-full object-contain" />

      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur">
        <MonitorUp className="h-3.5 w-3.5" />
        {presenter.selfPresenting
          ? t('You are presenting')
          : t('{name} is presenting', { name: presenter.name })}
      </span>
    </div>
  )
}

function JoinRequestBanner() {
  const t = useT()
  const requests = useRoomSessionStore((state) => state.requests)
  const self = useRoomSessionStore((state) => state.self)
  const setPanel = useUiStore((state) => state.setPanel)

  const visible = self?.role === 'host' ? requests[0] : undefined
  const extra = Math.max(0, requests.length - 1)

  return (
    <AnimatePresence mode="wait">
      {visible ? (
        <motion.div
          key={visible.id}
          initial={{ opacity: 0, y: -14, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -14, x: '-50%' }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-1/2 top-3 z-10 w-[min(440px,calc(100%-1.5rem))] rounded-xl border border-warning/40 bg-surface/95 p-3 shadow-lg backdrop-blur"
        >
          <div className="flex items-center gap-2 text-[12px] font-medium text-warning">
            <Users className="h-3.5 w-3.5" />
            {requests.length === 1
              ? t('1 person wants to join')
              : t('{count} people want to join', { count: requests.length })}
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <Avatar name={visible.name} color={visible.avatarColor} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{visible.name}</p>
              <p className="text-[12px] text-ink-subtle">
                {visible.micOn ? t('Mic on') : t('Mic off')} ·{' '}
                {visible.cameraOn ? t('camera on') : t('camera off')}
                {extra > 0 ? ` · ${t('+{count} more waiting', { count: extra })}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => rejectRequest(visible.id)}
                aria-label={t('Decline {name}', { name: visible.name })}
              >
                {t('Decline')}
              </Button>
              <Button size="sm" onClick={() => acceptRequest(visible.id)}>
                <UserPlus className="h-4 w-4" />
                {t('Accept')}
              </Button>
            </div>
          </div>

          {extra > 0 ? (
            <button
              type="button"
              className="mt-2.5 w-full rounded-lg border border-line bg-surface-2 py-1.5 text-[12.5px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
              onClick={() => setPanel('participants')}
            >
              {t('Review all requests in People')}
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}