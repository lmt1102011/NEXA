import { memo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Crown, Mic, MicOff, MoreVertical, Trash, VideoOff, VolumeX, Volume1, Volume2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { Avatar } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { mediaEngine } from '@/services/media/MediaEngine'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useVolumesStore } from '@/stores/volumes'
import { hostDisableCamera, hostMuteParticipant, hostRemoveParticipant } from '@/features/room/session/sessionController'
import type { Participant } from '@/types'

export const VideoTile = memo(function VideoTile({
  participant,
  compact = false,
  className,
}: {
  participant: Participant
  compact?: boolean
  className?: string
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const t = useT()
  const isSelf = participant.isSelf
  const self = useRoomSessionStore((state) => state.self)
  const canModerateSelf = self?.role === 'host' || Boolean(self?.permissions?.canModerate)
  const hasLocalVideo = useCallStore((state) => state.hasLocalVideo)
  const remoteStream = useCallStore((state) =>
    !isSelf && participant.peerId ? state.remoteStreams[participant.peerId] : undefined,
  )
  const volume = useVolumesStore((state) => state.volumes[participant.id] ?? 100)
  const setVolume = useVolumesStore((state) => state.setVolume)

  const showLocalVideo = isSelf && participant.cameraOn && hasLocalVideo
  const remoteHasLiveVideo = Boolean(
    remoteStream?.getVideoTracks().some((track) => track.readyState === 'live'),
  )
  const showRemoteVideo = !isSelf && participant.cameraOn && remoteHasLiveVideo

  useEffect(() => {
    if (!isSelf || !showLocalVideo) return
    const attach = () => {
      const video = localVideoRef.current
      if (!video) return
      const stream = mediaEngine.getStream()
      video.srcObject = stream
      if (stream) void video.play().catch(() => undefined)
    }
    attach()
    return mediaEngine.onStreamChange(attach)
  }, [isSelf, showLocalVideo])

  useEffect(() => {
    if (!remoteStream) return
    const video = remoteVideoRef.current
    if (video) {
      video.srcObject = remoteStream
      void video.play().catch(() => undefined)
    }
    const audio = remoteAudioRef.current
    if (audio) {
      audio.srcObject = remoteStream
      audio.volume = Math.min(1, volume / 100)
      void audio.play().catch(() => undefined)
    }
  }, [remoteStream, showRemoteVideo, volume])

  const hasLiveMedia = showLocalVideo || showRemoteVideo

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative min-h-0 overflow-hidden rounded-xl border bg-surface-2 transition-shadow duration-200 sm:rounded-2xl',
        participant.isSpeaking
          ? 'border-success/70 shadow-[0_0_0_1.5px_rgba(61,220,151,0.65),0_0_32px_-10px_rgba(61,220,151,0.5)]'
          : 'border-line',
        className,
      )}
      style={
        hasLiveMedia
          ? undefined
          : {
              background: `radial-gradient(130% 130% at 28% 22%, ${participant.avatarColor}2e, transparent 58%), var(--nx-surface-2)`,
            }
      }
    >
      {showLocalVideo ? (
        <video
          ref={localVideoRef}
          muted
          playsInline
          autoPlay
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
      ) : showRemoteVideo ? (
        <video
          ref={remoteVideoRef}
          muted
          playsInline
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Avatar
            name={participant.name}
            color={participant.avatarColor}
            size={compact ? 'md' : 'xl'}
            className="shadow-md"
          />
        </div>
      )}

      {!isSelf && remoteStream ? (
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      ) : null}

      {!isSelf && remoteStream ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('Adjust volume for {name}', { name: participant.name })}
              className={cn(
                'absolute z-10 grid place-items-center rounded-lg bg-black/45 text-white/85 backdrop-blur-sm transition-colors hover:bg-black/65 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                compact ? 'bottom-1.5 right-1.5 h-6 w-6' : 'bottom-2 right-2 h-7 w-7',
              )}
            >
              {volume <= 0 ? (
                <VolumeX className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              ) : volume < 100 ? (
                <Volume1 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              ) : (
                <Volume2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-48 p-3">
            <div className="space-y-2.5">
              <p className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-ink">
                {t('Adjust volume for {name}', { name: participant.name })}
                <span className="font-mono text-ink-subtle">{volume}%</span>
              </p>
              <Slider
                min={0}
                max={150}
                step={5}
                value={[volume]}
                onValueChange={(value) => setVolume(participant.id, value[0] ?? 100)}
                aria-label={t('Volume')}
              />
              <div className="flex justify-between text-[10.5px] text-ink-subtle">
                <button
                  type="button"
                  onClick={() => setVolume(participant.id, 0)}
                  className="rounded px-1 py-0.5 transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  {t('Mute')}
                </button>
                <button
                  type="button"
                  onClick={() => setVolume(participant.id, 100)}
                  className="rounded px-1 py-0.5 transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  {t('Reset')}
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      <div
        className={cn(
          'absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg bg-black/50 px-2 py-1 backdrop-blur-sm',
          compact && 'bottom-1.5 left-1.5 px-1.5 py-0.5',
        )}
      >
        {!participant.micOn ? (
          <MicOff className="h-3.5 w-3.5 shrink-0 text-danger" />
        ) : participant.isSpeaking ? (
          <span className="flex h-3.5 w-3.5 items-end justify-center gap-[2px]" aria-label={t('Speaking')}>
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="w-[2.5px] rounded-full bg-success"
                animate={{ height: ['4px', '12px', '5px', '10px', '4px'] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: index * 0.16, ease: 'easeInOut' }}
              />
            ))}
          </span>
        ) : (
          <Mic className="h-3.5 w-3.5 shrink-0 text-white/85" />
        )}
        <span className="truncate text-[11.5px] font-medium text-white">
          {participant.isSelf ? t('{name} (You)', { name: participant.name }) : participant.name}
        </span>
        {participant.role === 'host' ? <Crown className="h-3.5 w-3.5 shrink-0 text-warning" /> : null}
      </div>

      {!compact && !participant.isSelf && canModerateSelf && participant.role !== 'host' ? (
        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t('Actions for {name}', { name: participant.name })}
                className="grid h-7 w-7 place-items-center rounded-lg bg-black/45 text-white/85 backdrop-blur-sm transition-colors hover:bg-black/65 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{participant.name}</DropdownMenuLabel>
              <DropdownMenuItem disabled={!participant.micOn} onSelect={() => hostMuteParticipant(participant.id)}>
                <MicOff className="h-4 w-4" />
                {t('Mute mic')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!participant.cameraOn}
                onSelect={() => hostDisableCamera(participant.id)}
              >
                <VideoOff className="h-4 w-4" />
                {t('Turn off camera')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => hostRemoveParticipant(participant.id)}>
                <Trash className="h-4 w-4" />
                {t('Remove from room')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      {!compact && participant.quality !== 'excellent' && !participant.isSelf ? (
        <div
          className={
            'absolute top-2 rounded-md bg-black/45 px-1.5 py-0.5 font-mono text-[10px] text-white/90 backdrop-blur-sm ' +
            (canModerateSelf && !participant.isSelf ? 'right-10' : 'right-2')
          }
        >
          {participant.quality}
        </div>
      ) : null}
    </motion.div>
  )
})